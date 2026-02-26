import type {
    Did,
    ModerationQueueStore,
    ModerationReportRecord,
    ReportReason,
} from '@mutual-hub/shared';

import { evaluateModeration } from './worker.js';

export type ChatModerationSignalType =
    | 'report_submitted'
    | 'abuse_keyword'
    | 'rate_limit'
    | 'duplicate_content'
    | 'suspicious_pattern'
    | 'post_rate_limit';

export interface ChatModerationSignal {
    id: string;
    type: ChatModerationSignalType;
    conversationId: string;
    targetDid: Did;
    reason: ReportReason;
    details: string;
    createdAt: string;
    moderationAction: ReturnType<typeof evaluateModeration>['action'];
    moderationExplanation: string;
}

export interface ChatRateLimitPolicy {
    windowMs: number;
    maxMessages: number;
}

export interface PostRateLimitPolicy {
    windowMs: number;
    maxPosts: number;
}

export interface DuplicateDetectionPolicy {
    windowMs: number;
    maxRepeats: number;
    minimumFingerprintLength: number;
}

export interface SuspiciousPatternPolicy {
    windowMs: number;
    maxDistinctRecipients: number;
    maxRepeatedConversationsPerFingerprint: number;
}

export interface AbuseControlMetrics {
    chatEvaluated: number;
    postsEvaluated: number;
    reportsSubmitted: number;
    blockedByKeyword: number;
    blockedByRateLimit: number;
    blockedByPostRateLimit: number;
    blockedByDuplicate: number;
    suspiciousSignals: number;
}

export interface ChatSafetyEngineOptions {
    abuseKeywords?: readonly string[];
    rateLimit?: Partial<ChatRateLimitPolicy>;
    postRateLimit?: Partial<PostRateLimitPolicy>;
    duplicateDetection?: Partial<DuplicateDetectionPolicy>;
    suspiciousPatterns?: Partial<SuspiciousPatternPolicy>;
    moderationQueueStore?: ModerationQueueStore;
    now?: () => number;
}

export interface ChatReportInput {
    reporterDid: Did;
    targetDid: Did;
    conversationId: string;
    reason: ReportReason;
    details?: string;
    createdAt?: string;
}

export interface ChatBlockInput {
    actorDid: Did;
    targetDid: Did;
    createdAt?: string;
}

export interface ChatMuteInput {
    actorDid: Did;
    targetDid: Did;
    durationMinutes: number;
    createdAt?: string;
}

export interface EvaluateChatMessageInput {
    conversationId: string;
    senderDid: Did;
    recipientDid: Did;
    text: string;
    sentAt?: string;
}

export interface EvaluatePostSubmissionInput {
    postId: string;
    authorDid: Did;
    text: string;
    submittedAt?: string;
}

export interface ChatControlResult {
    ok: boolean;
    code: string;
    message: string;
    moderationSignals: readonly ChatModerationSignal[];
}

export interface ChatMessageSafetyResult extends ChatControlResult {
    flaggedKeywords: readonly string[];
}

export interface PostSubmissionSafetyResult extends ChatControlResult {
    fingerprint: string;
}

interface ContentHistoryEntry {
    fingerprint: string;
    scope: string;
    timestamp: number;
}

interface RecipientHistoryEntry {
    recipientDid: Did;
    timestamp: number;
}

const defaultAbuseKeywords = [
    'crypto giveaway',
    'seed phrase',
    'wire money now',
    'kill yourself',
] as const;

function didPairKey(left: Did, right: Did): string {
    return `${left}->${right}`;
}

function senderConversationKey(senderDid: Did, conversationId: string): string {
    return `${senderDid}::${conversationId}`;
}

function signalId(prefix: string, value: string): string {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
    }

    return `${prefix}-${hash.toString(16).padStart(8, '0')}`;
}

export class ChatSafetyEngine {
    private readonly blockedPairs = new Set<string>();
    private readonly mutedPairsUntil = new Map<string, number>();
    private readonly sentMessageTimestamps = new Map<string, number[]>();
    private readonly postSubmissionTimestamps = new Map<string, number[]>();
    private readonly contentHistoryBySender = new Map<
        string,
        ContentHistoryEntry[]
    >();
    private readonly recipientHistoryBySender = new Map<
        string,
        RecipientHistoryEntry[]
    >();
    private readonly moderationQueue: ChatModerationSignal[] = [];
    private readonly abuseKeywords: readonly string[];
    private readonly rateLimit: ChatRateLimitPolicy;
    private readonly postRateLimit: PostRateLimitPolicy;
    private readonly duplicateDetection: DuplicateDetectionPolicy;
    private readonly suspiciousPatterns: SuspiciousPatternPolicy;
    private readonly metrics: AbuseControlMetrics = {
        chatEvaluated: 0,
        postsEvaluated: 0,
        reportsSubmitted: 0,
        blockedByKeyword: 0,
        blockedByRateLimit: 0,
        blockedByPostRateLimit: 0,
        blockedByDuplicate: 0,
        suspiciousSignals: 0,
    };

    constructor(private readonly options: ChatSafetyEngineOptions = {}) {
        this.abuseKeywords = options.abuseKeywords ?? [...defaultAbuseKeywords];
        this.rateLimit = {
            windowMs: options.rateLimit?.windowMs ?? 60_000,
            maxMessages: options.rateLimit?.maxMessages ?? 5,
        };
        this.postRateLimit = {
            windowMs: options.postRateLimit?.windowMs ?? 5 * 60_000,
            maxPosts: options.postRateLimit?.maxPosts ?? 3,
        };
        this.duplicateDetection = {
            windowMs: options.duplicateDetection?.windowMs ?? 10 * 60_000,
            maxRepeats: options.duplicateDetection?.maxRepeats ?? 2,
            minimumFingerprintLength:
                options.duplicateDetection?.minimumFingerprintLength ?? 20,
        };
        this.suspiciousPatterns = {
            windowMs: options.suspiciousPatterns?.windowMs ?? 10 * 60_000,
            maxDistinctRecipients:
                options.suspiciousPatterns?.maxDistinctRecipients ?? 4,
            maxRepeatedConversationsPerFingerprint:
                options.suspiciousPatterns
                    ?.maxRepeatedConversationsPerFingerprint ?? 2,
        };
    }

    reportParticipant(input: ChatReportInput): {
        report: ModerationReportRecord;
        moderationSignal: ChatModerationSignal;
    } {
        this.metrics.reportsSubmitted += 1;
        const createdAt = input.createdAt ?? new Date(this.now()).toISOString();
        const report: ModerationReportRecord = {
            id: signalId(
                'report',
                `${input.reporterDid}|${input.targetDid}|${input.conversationId}|${createdAt}`,
            ),
            targetUri: `at://${input.targetDid}/com.mutualaid.hub.conversationMetadata/${input.conversationId}`,
            reason: input.reason,
            reporterDid: input.reporterDid,
            details: input.details,
            createdAt,
        };

        this.options.moderationQueueStore?.submitReport(report);

        const decision = evaluateModeration({
            targetUri: report.targetUri,
            reason: report.reason,
            detailText: report.details,
        });

        const moderationSignal: ChatModerationSignal = {
            id: signalId('signal', `${report.id}|report_submitted`),
            type: 'report_submitted',
            conversationId: input.conversationId,
            targetDid: input.targetDid,
            reason: input.reason,
            details: input.details ?? 'User submitted a chat report.',
            createdAt,
            moderationAction: decision.action,
            moderationExplanation: decision.explanation,
        };

        this.moderationQueue.push(moderationSignal);
        return { report, moderationSignal };
    }

    blockParticipant(input: ChatBlockInput): ChatControlResult {
        this.blockedPairs.add(didPairKey(input.actorDid, input.targetDid));

        return {
            ok: true,
            code: 'blocked',
            message:
                'Participant blocked. New chat messages will be prevented.',
            moderationSignals: [],
        };
    }

    muteParticipant(input: ChatMuteInput): ChatControlResult {
        const mutedUntilMs =
            Date.parse(input.createdAt ?? new Date(this.now()).toISOString()) +
            Math.max(1, input.durationMinutes) * 60_000;
        this.mutedPairsUntil.set(
            didPairKey(input.actorDid, input.targetDid),
            mutedUntilMs,
        );

        return {
            ok: true,
            code: 'muted',
            message: `Participant muted for ${Math.max(1, input.durationMinutes)} minute(s).`,
            moderationSignals: [],
        };
    }

    evaluateOutgoingMessage(
        input: EvaluateChatMessageInput,
    ): ChatMessageSafetyResult {
        this.metrics.chatEvaluated += 1;

        if (
            this.blockedPairs.has(
                didPairKey(input.senderDid, input.recipientDid),
            ) ||
            this.blockedPairs.has(
                didPairKey(input.recipientDid, input.senderDid),
            )
        ) {
            return {
                ok: false,
                code: 'blocked',
                message:
                    'Message not sent because one participant has blocked the other.',
                moderationSignals: [],
                flaggedKeywords: [],
            };
        }

        const recipientMuteKey = didPairKey(
            input.recipientDid,
            input.senderDid,
        );
        const mutedUntil = this.mutedPairsUntil.get(recipientMuteKey);
        if (mutedUntil !== undefined && mutedUntil > this.now()) {
            return {
                ok: false,
                code: 'muted',
                message:
                    'Message not delivered because the recipient has muted this conversation.',
                moderationSignals: [],
                flaggedKeywords: [],
            };
        }

        const flaggedKeywords = this.findAbuseKeywords(input.text);
        if (flaggedKeywords.length > 0) {
            this.metrics.blockedByKeyword += 1;
            const signal = this.emitSignal({
                type: 'abuse_keyword',
                conversationId: input.conversationId,
                targetDid: input.senderDid,
                reason: 'unsafe_content',
                details: `Flagged keywords: ${flaggedKeywords.join(', ')}`,
                createdAt: input.sentAt,
            });

            return {
                ok: false,
                code: 'abuse_flagged',
                message:
                    'Message held for safety review because it triggered abuse detection.',
                moderationSignals: [signal],
                flaggedKeywords,
            };
        }

        const rateLimited = this.isRateLimited(input);
        if (rateLimited) {
            this.metrics.blockedByRateLimit += 1;
            const signal = this.emitSignal({
                type: 'rate_limit',
                conversationId: input.conversationId,
                targetDid: input.senderDid,
                reason: 'spam',
                details: 'Sender exceeded chat message rate limit.',
                createdAt: input.sentAt,
            });

            return {
                ok: false,
                code: 'rate_limited',
                message:
                    'Too many messages sent too quickly. Please wait before sending again.',
                moderationSignals: [signal],
                flaggedKeywords: [],
            };
        }

        const nowMs = this.toSafeTimestamp(input.sentAt);
        const fingerprint = this.normalizeContentFingerprint(input.text);
        const isDuplicate = this.isDuplicateContent({
            senderDid: input.senderDid,
            scope: `chat:${input.conversationId}`,
            fingerprint,
            timestampMs: nowMs,
        });

        if (isDuplicate) {
            this.metrics.blockedByDuplicate += 1;
            const signal = this.emitSignal({
                type: 'duplicate_content',
                conversationId: input.conversationId,
                targetDid: input.senderDid,
                reason: 'spam',
                details:
                    'Duplicate content detected across recent chat submissions.',
                createdAt: input.sentAt,
            });

            return {
                ok: false,
                code: 'duplicate_blocked',
                message:
                    'Message blocked because it matches recent repeated spam content.',
                moderationSignals: [signal],
                flaggedKeywords: [],
            };
        }

        const suspiciousSignal = this.detectSuspiciousChatPattern({
            senderDid: input.senderDid,
            recipientDid: input.recipientDid,
            conversationId: input.conversationId,
            sentAt: input.sentAt,
            timestampMs: nowMs,
            fingerprint,
        });

        if (suspiciousSignal) {
            this.metrics.suspiciousSignals += 1;
            return {
                ok: true,
                code: 'allowed_with_signal',
                message:
                    'Message accepted and queued for moderation monitoring.',
                moderationSignals: [suspiciousSignal],
                flaggedKeywords: [],
            };
        }

        return {
            ok: true,
            code: 'allowed',
            message: 'Message accepted.',
            moderationSignals: [],
            flaggedKeywords: [],
        };
    }

    evaluatePostSubmission(
        input: EvaluatePostSubmissionInput,
    ): PostSubmissionSafetyResult {
        this.metrics.postsEvaluated += 1;

        const timestampMs = this.toSafeTimestamp(input.submittedAt);
        if (this.isPostRateLimited(input.authorDid, timestampMs)) {
            this.metrics.blockedByPostRateLimit += 1;
            const signal = this.emitSignal({
                type: 'post_rate_limit',
                conversationId: `post:${input.postId}`,
                targetDid: input.authorDid,
                reason: 'spam',
                details: 'Author exceeded post submission rate limit.',
                createdAt: input.submittedAt,
            });

            return {
                ok: false,
                code: 'post_rate_limited',
                message: 'Post submission throttled due to burst activity.',
                moderationSignals: [signal],
                fingerprint: this.normalizeContentFingerprint(input.text),
            };
        }

        const fingerprint = this.normalizeContentFingerprint(input.text);
        const duplicate = this.isDuplicateContent({
            senderDid: input.authorDid,
            scope: `post:${input.postId}`,
            fingerprint,
            timestampMs,
        });

        if (duplicate) {
            this.metrics.blockedByDuplicate += 1;
            const signal = this.emitSignal({
                type: 'duplicate_content',
                conversationId: `post:${input.postId}`,
                targetDid: input.authorDid,
                reason: 'spam',
                details:
                    'Duplicate post content detected within abuse detection window.',
                createdAt: input.submittedAt,
            });

            return {
                ok: false,
                code: 'duplicate_post_blocked',
                message:
                    'Post blocked because it repeats recently submitted content.',
                moderationSignals: [signal],
                fingerprint,
            };
        }

        return {
            ok: true,
            code: 'allowed',
            message: 'Post submission accepted.',
            moderationSignals: [],
            fingerprint,
        };
    }

    getAbuseMetrics(): AbuseControlMetrics {
        return {
            ...this.metrics,
        };
    }

    drainModerationQueue(): ChatModerationSignal[] {
        const signals = [...this.moderationQueue];
        this.moderationQueue.length = 0;
        return signals;
    }

    private now(): number {
        return this.options.now ? this.options.now() : Date.now();
    }

    private findAbuseKeywords(text: string): string[] {
        const normalized = text.toLowerCase();
        return this.abuseKeywords.filter(keyword =>
            normalized.includes(keyword),
        );
    }

    private toSafeTimestamp(value: string | undefined): number {
        const timestamp = value ? Date.parse(value) : this.now();
        return Number.isNaN(timestamp) ? this.now() : timestamp;
    }

    private normalizeContentFingerprint(text: string): string {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private isDuplicateContent(input: {
        senderDid: Did;
        scope: string;
        fingerprint: string;
        timestampMs: number;
    }): boolean {
        if (
            input.fingerprint.length <
            this.duplicateDetection.minimumFingerprintLength
        ) {
            return false;
        }

        const history = this.contentHistoryBySender.get(input.senderDid) ?? [];
        const windowStart =
            input.timestampMs - this.duplicateDetection.windowMs;
        const withinWindow = history.filter(
            entry => entry.timestamp >= windowStart,
        );
        const repeats = withinWindow.filter(
            entry =>
                entry.fingerprint === input.fingerprint &&
                (entry.scope === input.scope ||
                    entry.scope.startsWith('post:') ||
                    input.scope.startsWith('post:')),
        );

        if (repeats.length >= this.duplicateDetection.maxRepeats) {
            this.contentHistoryBySender.set(input.senderDid, withinWindow);
            return true;
        }

        withinWindow.push({
            fingerprint: input.fingerprint,
            scope: input.scope,
            timestamp: input.timestampMs,
        });
        this.contentHistoryBySender.set(input.senderDid, withinWindow);
        return false;
    }

    private isRateLimited(input: EvaluateChatMessageInput): boolean {
        const key = senderConversationKey(
            input.senderDid,
            input.conversationId,
        );
        const safeNow = this.toSafeTimestamp(input.sentAt);
        const windowStart = safeNow - this.rateLimit.windowMs;
        const history = this.sentMessageTimestamps.get(key) ?? [];
        const withinWindow = history.filter(
            timestamp => timestamp >= windowStart,
        );

        if (withinWindow.length >= this.rateLimit.maxMessages) {
            this.sentMessageTimestamps.set(key, withinWindow);
            return true;
        }

        withinWindow.push(safeNow);
        this.sentMessageTimestamps.set(key, withinWindow);
        return false;
    }

    private isPostRateLimited(authorDid: Did, timestampMs: number): boolean {
        const key = `post:${authorDid}`;
        const windowStart = timestampMs - this.postRateLimit.windowMs;
        const history = this.postSubmissionTimestamps.get(key) ?? [];
        const withinWindow = history.filter(
            timestamp => timestamp >= windowStart,
        );

        if (withinWindow.length >= this.postRateLimit.maxPosts) {
            this.postSubmissionTimestamps.set(key, withinWindow);
            return true;
        }

        withinWindow.push(timestampMs);
        this.postSubmissionTimestamps.set(key, withinWindow);
        return false;
    }

    private detectSuspiciousChatPattern(input: {
        senderDid: Did;
        recipientDid: Did;
        conversationId: string;
        sentAt?: string;
        timestampMs: number;
        fingerprint: string;
    }): ChatModerationSignal | undefined {
        const recipientHistory =
            this.recipientHistoryBySender.get(input.senderDid) ?? [];
        const windowStart =
            input.timestampMs - this.suspiciousPatterns.windowMs;
        const withinWindowRecipients = recipientHistory.filter(
            entry => entry.timestamp >= windowStart,
        );
        withinWindowRecipients.push({
            recipientDid: input.recipientDid,
            timestamp: input.timestampMs,
        });
        this.recipientHistoryBySender.set(
            input.senderDid,
            withinWindowRecipients,
        );

        const distinctRecipients = new Set(
            withinWindowRecipients.map(entry => entry.recipientDid),
        );
        if (
            distinctRecipients.size >
            this.suspiciousPatterns.maxDistinctRecipients
        ) {
            return this.emitSignal({
                type: 'suspicious_pattern',
                conversationId: input.conversationId,
                targetDid: input.senderDid,
                reason: 'spam',
                details: `Sender contacted ${distinctRecipients.size} recipients within suspicious window.`,
                createdAt: input.sentAt,
            });
        }

        if (
            input.fingerprint.length >=
            this.duplicateDetection.minimumFingerprintLength
        ) {
            const recentContent = (
                this.contentHistoryBySender.get(input.senderDid) ?? []
            ).filter(
                entry =>
                    entry.timestamp >= windowStart &&
                    entry.fingerprint === input.fingerprint,
            );
            const conversationSpread = new Set(
                recentContent
                    .filter(entry => entry.scope.startsWith('chat:'))
                    .map(entry => entry.scope),
            );

            if (
                conversationSpread.size >
                this.suspiciousPatterns.maxRepeatedConversationsPerFingerprint
            ) {
                return this.emitSignal({
                    type: 'suspicious_pattern',
                    conversationId: input.conversationId,
                    targetDid: input.senderDid,
                    reason: 'spam',
                    details: `Repeated fingerprint broadcast across ${conversationSpread.size} chat threads.`,
                    createdAt: input.sentAt,
                });
            }
        }

        return undefined;
    }

    private emitSignal(input: {
        type: ChatModerationSignalType;
        conversationId: string;
        targetDid: Did;
        reason: ReportReason;
        details: string;
        createdAt?: string;
    }): ChatModerationSignal {
        const createdAt = input.createdAt ?? new Date(this.now()).toISOString();
        const targetUri = `at://${input.targetDid}/com.mutualaid.hub.conversationMetadata/${input.conversationId}`;
        const decision = evaluateModeration({
            targetUri,
            reason: input.reason,
            detailText: input.details,
        });

        const signal: ChatModerationSignal = {
            id: signalId(
                'signal',
                `${input.type}|${input.targetDid}|${input.conversationId}|${createdAt}`,
            ),
            type: input.type,
            conversationId: input.conversationId,
            targetDid: input.targetDid,
            reason: input.reason,
            details: input.details,
            createdAt,
            moderationAction: decision.action,
            moderationExplanation: decision.explanation,
        };

        this.moderationQueue.push(signal);
        return signal;
    }
}

export function createChatSafetyEngine(
    options: ChatSafetyEngineOptions = {},
): ChatSafetyEngine {
    return new ChatSafetyEngine(options);
}
