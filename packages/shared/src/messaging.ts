import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
    recordNsid,
    type AidPostRecord,
    type ConversationMetaRecord,
    type ModerationReportRecord,
    validateRecordPayload,
} from '@mutual-hub/at-lexicons';
import type { ModerationReviewRequestedEvent } from './contracts.js';

const didSchema = z
    .string()
    .regex(/^did:[a-z0-9]+:[a-z0-9._:%-]+$/i, 'Expected a valid DID');
const atUriSchema = z
    .string()
    .regex(/^at:\/\/[^\s]+$/i, 'Expected a valid at:// URI');
const isoDateTimeSchema = z.string().datetime({ offset: true });

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export type ChatInitiationSurface = 'map' | 'feed' | 'detail';

export type ChatFlowErrorCode =
    | 'UNAUTHORIZED'
    | 'INVALID_PARTICIPANTS'
    | 'INVALID_CONTEXT';

export class ChatFlowError extends Error {
    constructor(
        readonly code: ChatFlowErrorCode,
        message: string,
        readonly details?: Record<string, unknown>,
    ) {
        super(message);
        this.name = 'ChatFlowError';
    }
}

export interface CreatePostLinkedChatInput {
    aidPostUri: string;
    initiatedByDid: string;
    recipientDid: string;
    initiatedFrom: ChatInitiationSurface;
    now?: string;
    allowInitiation?: boolean;
    allowedParticipantDids?: readonly string[];
}

export interface PostLinkedChatContext {
    conversationUri: string;
    record: ConversationMetaRecord;
    requestContext: {
        aidPostUri: string;
        initiatedFrom: ChatInitiationSurface;
        initiatedByDid: string;
        recipientDid: string;
    };
}

const buildConversationKey = (
    aidPostUri: string,
    participantDids: readonly string[],
): string => {
    return createHash('sha256')
        .update(`${aidPostUri}|${participantDids.join('|')}`)
        .digest('hex')
        .slice(0, 24);
};

const validateInitiationPermission = (
    input: CreatePostLinkedChatInput,
): void => {
    if (input.allowInitiation === false) {
        throw new ChatFlowError(
            'UNAUTHORIZED',
            'Chat initiation is disabled for the current actor.',
            {
                initiatedByDid: input.initiatedByDid,
                recipientDid: input.recipientDid,
            },
        );
    }

    if (input.allowedParticipantDids) {
        const allowed = new Set(input.allowedParticipantDids);
        if (
            !allowed.has(input.initiatedByDid) ||
            !allowed.has(input.recipientDid)
        ) {
            throw new ChatFlowError(
                'UNAUTHORIZED',
                'Chat initiation failed participant authorization checks.',
                {
                    initiatedByDid: input.initiatedByDid,
                    recipientDid: input.recipientDid,
                },
            );
        }
    }
};

export const createPostLinkedChatContext = (
    input: CreatePostLinkedChatInput,
): PostLinkedChatContext => {
    const aidPostUri = atUriSchema.parse(input.aidPostUri);
    const initiatedByDid = didSchema.parse(input.initiatedByDid);
    const recipientDid = didSchema.parse(input.recipientDid);

    if (initiatedByDid === recipientDid) {
        throw new ChatFlowError(
            'INVALID_PARTICIPANTS',
            '1:1 chat initiation requires two distinct participants.',
            { initiatedByDid, recipientDid },
        );
    }

    validateInitiationPermission(input);

    const participantDids = [initiatedByDid, recipientDid].sort(
        (left, right) => left.localeCompare(right),
    );
    const conversationKey = buildConversationKey(aidPostUri, participantDids);
    const conversationUri = `at://${participantDids[0]}/${recordNsid.conversationMeta}/conv-${conversationKey}`;
    const now = isoDateTimeSchema.parse(input.now ?? new Date().toISOString());

    const recordCandidate = {
        $type: recordNsid.conversationMeta,
        version: '1.0.0',
        aidPostUri,
        participantDids,
        status: 'open',
        createdAt: now,
    } satisfies ConversationMetaRecord;

    const record = validateRecordPayload(
        recordNsid.conversationMeta,
        recordCandidate,
    );

    return {
        conversationUri,
        record,
        requestContext: {
            aidPostUri,
            initiatedFrom: input.initiatedFrom,
            initiatedByDid,
            recipientDid,
        },
    };
};

export interface VolunteerRoutingCandidate {
    id: string;
    did: string;
    availability: 'immediate' | 'within-24h' | 'scheduled' | 'unavailable';
    trustScore: number;
    matchesCategory: boolean;
}

export interface ResourceRoutingCandidate {
    id: string;
    verificationStatus: 'unverified' | 'community-verified' | 'partner-verified';
    supportsCategory: boolean;
    currentlyOpen: boolean;
}

export interface RoutingAssistantInput {
    aidPostUri: string;
    requesterDid: string;
    aidCategory: AidPostRecord['category'];
    urgency: AidPostRecord['urgency'];
    postAuthorDid?: string;
    volunteerCandidates: readonly VolunteerRoutingCandidate[];
    resourceCandidates: readonly ResourceRoutingCandidate[];
    now?: string;
}

export interface RoutingCandidateScore {
    destinationKind:
        | 'post-author'
        | 'volunteer-pool'
        | 'verified-resource'
        | 'manual-fallback';
    destinationId: string;
    priority: number;
    reasons: string[];
}

export interface RoutingDecision {
    destinationKind: RoutingCandidateScore['destinationKind'];
    destinationId: string;
    destinationDid?: string;
    matchedRule:
        | 'RULE_POST_AUTHOR'
        | 'RULE_VOLUNTEER_POOL'
        | 'RULE_VERIFIED_RESOURCE'
        | 'RULE_MANUAL_FALLBACK';
    machineRationale: string[];
    humanRationale: string;
    priorityOrderUsed: {
        postAuthor: number;
        volunteerPool: number;
        verifiedResource: number;
    };
    orderedCandidates: RoutingCandidateScore[];
    decidedAt: string;
}

export const ROUTING_PRIORITY_ORDER = Object.freeze({
    postAuthor: 300,
    volunteerPool: 200,
    verifiedResource: 160,
});

const volunteerAvailabilityBonus = (
    availability: VolunteerRoutingCandidate['availability'],
): number => {
    if (availability === 'immediate') {
        return 35;
    }
    if (availability === 'within-24h') {
        return 20;
    }
    if (availability === 'scheduled') {
        return 10;
    }
    return -1000;
};

const resourceVerificationBonus = (
    verificationStatus: ResourceRoutingCandidate['verificationStatus'],
): number => {
    if (verificationStatus === 'partner-verified') {
        return 25;
    }
    if (verificationStatus === 'community-verified') {
        return 10;
    }
    return -20;
};

const toHumanRationale = (candidate: RoutingCandidateScore): string => {
    if (candidate.destinationKind === 'post-author') {
        return 'Routing to the original post author for the fastest direct response.';
    }

    if (candidate.destinationKind === 'volunteer-pool') {
        return 'Routing to the best-matching volunteer based on availability and trust.';
    }

    if (candidate.destinationKind === 'verified-resource') {
        return 'Routing to the strongest verified resource match for this request.';
    }

    return 'No deterministic recipient qualified; fallback handoff is required.';
};

const byPriorityThenId = (
    left: RoutingCandidateScore,
    right: RoutingCandidateScore,
): number => {
    if (left.priority !== right.priority) {
        return right.priority - left.priority;
    }

    return left.destinationId.localeCompare(right.destinationId);
};

export class DeterministicRoutingAssistant {
    decide(input: RoutingAssistantInput): RoutingDecision {
        const aidPostUri = atUriSchema.parse(input.aidPostUri);
        const requesterDid = didSchema.parse(input.requesterDid);
        const decidedAt = isoDateTimeSchema.parse(
            input.now ?? new Date().toISOString(),
        );

        const candidates: RoutingCandidateScore[] = [];

        if (input.postAuthorDid) {
            const postAuthorDid = didSchema.parse(input.postAuthorDid);
            if (postAuthorDid !== requesterDid) {
                candidates.push({
                    destinationKind: 'post-author',
                    destinationId: postAuthorDid,
                    priority: ROUTING_PRIORITY_ORDER.postAuthor,
                    reasons: [
                        'post-author-eligible=true',
                        `aid-post=${aidPostUri}`,
                    ],
                });
            }
        }

        for (const volunteer of input.volunteerCandidates) {
            const volunteerDid = didSchema.parse(volunteer.did);
            const availabilityBonus = volunteerAvailabilityBonus(
                volunteer.availability,
            );

            if (availabilityBonus < 0) {
                continue;
            }

            const trustScore = Math.max(0, Math.min(1, volunteer.trustScore));
            const trustBonus = Math.round(trustScore * 20);
            const categoryBonus = volunteer.matchesCategory ? 12 : 0;
            const urgencyBonus =
                input.urgency === 'critical' || input.urgency === 'high' ?
                    8
                :   0;

            candidates.push({
                destinationKind: 'volunteer-pool',
                destinationId: `volunteer:${volunteer.id}`,
                priority:
                    ROUTING_PRIORITY_ORDER.volunteerPool +
                    availabilityBonus +
                    trustBonus +
                    categoryBonus +
                    urgencyBonus,
                reasons: [
                    `availability=${volunteer.availability}`,
                    `trust=${trustScore.toFixed(2)}`,
                    `category-match=${volunteer.matchesCategory}`,
                    `did=${volunteerDid}`,
                ],
            });
        }

        for (const resource of input.resourceCandidates) {
            if (!resource.supportsCategory || !resource.currentlyOpen) {
                continue;
            }

            const verificationBonus = resourceVerificationBonus(
                resource.verificationStatus,
            );
            const urgencyBonus =
                input.urgency === 'critical' &&
                resource.verificationStatus !== 'unverified' ?
                    8
                :   0;

            candidates.push({
                destinationKind: 'verified-resource',
                destinationId: `resource:${resource.id}`,
                priority:
                    ROUTING_PRIORITY_ORDER.verifiedResource +
                    verificationBonus +
                    urgencyBonus,
                reasons: [
                    `verification=${resource.verificationStatus}`,
                    `supports-category=${resource.supportsCategory}`,
                    `open=${resource.currentlyOpen}`,
                ],
            });
        }

        const orderedCandidates = [...candidates].sort(byPriorityThenId);
        const top =
            orderedCandidates[0] ??
            ({
                destinationKind: 'manual-fallback',
                destinationId: 'manual-fallback',
                priority: 0,
                reasons: ['no-candidates-qualified=true'],
            } satisfies RoutingCandidateScore);

        return {
            destinationKind: top.destinationKind,
            destinationId: top.destinationId,
            destinationDid:
                top.destinationKind === 'post-author' ? top.destinationId
                : undefined,
            matchedRule:
                top.destinationKind === 'post-author' ?
                    'RULE_POST_AUTHOR'
                : top.destinationKind === 'volunteer-pool' ?
                    'RULE_VOLUNTEER_POOL'
                : top.destinationKind === 'verified-resource' ?
                    'RULE_VERIFIED_RESOURCE'
                :   'RULE_MANUAL_FALLBACK',
            machineRationale: [...top.reasons],
            humanRationale: toHumanRationale(top),
            priorityOrderUsed: { ...ROUTING_PRIORITY_ORDER },
            orderedCandidates,
            decidedAt,
        };
    }
}

export interface RecipientTransportCapability {
    recipientDid: string;
    supportsAtprotoChat: boolean;
    fallbackChannels: readonly ('phone' | 'url' | 'manual-review')[];
    detectedAt: string;
}

export type ConversationTransportPath =
    | 'atproto-direct'
    | 'resource-fallback'
    | 'manual-fallback';

export interface ConversationFallbackNotice {
    code: 'RECIPIENT_CAPABILITY_MISSING';
    message: string;
    safeForUser: true;
    transportPath: Exclude<ConversationTransportPath, 'atproto-direct'>;
}

const resolveTransportPath = (
    routingDecision: RoutingDecision,
    capability: RecipientTransportCapability,
): ConversationTransportPath => {
    if (capability.supportsAtprotoChat) {
        return 'atproto-direct';
    }

    if (routingDecision.destinationKind === 'verified-resource') {
        return 'resource-fallback';
    }

    return 'manual-fallback';
};

const buildFallbackNotice = (
    transportPath: ConversationTransportPath,
): ConversationFallbackNotice | undefined => {
    if (transportPath === 'atproto-direct') {
        return undefined;
    }

    return {
        code: 'RECIPIENT_CAPABILITY_MISSING',
        message:
            'Recipient cannot receive AT-native chat yet. We will use a safe fallback handoff path.',
        safeForUser: true,
        transportPath,
    };
};

export interface PersistConversationMetadataInput {
    chat: PostLinkedChatContext;
    routingDecision: RoutingDecision;
    recipientCapability: RecipientTransportCapability;
    status?: ConversationMetaRecord['status'];
    updatedAt?: string;
}

export interface PersistedConversationMetadata {
    conversationUri: string;
    aidPostUri: string;
    record: ConversationMetaRecord;
    requestContext: PostLinkedChatContext['requestContext'];
    routingDecision: RoutingDecision;
    recipientCapability: RecipientTransportCapability;
    transportPath: ConversationTransportPath;
    fallbackNotice?: ConversationFallbackNotice;
    audit: {
        lastUpdatedAt: string;
        moderationQueryableKey: string;
    };
}

export class ConversationMetadataStore {
    private readonly conversations = new Map<string, PersistedConversationMetadata>();

    upsertConversation(
        input: PersistConversationMetadataInput,
    ): PersistedConversationMetadata {
        const conversationUri = atUriSchema.parse(input.chat.conversationUri);
        const now = isoDateTimeSchema.parse(
            input.updatedAt ?? new Date().toISOString(),
        );
        const existing = this.conversations.get(conversationUri);
        const status =
            input.status ?? existing?.record.status ?? input.chat.record.status;

        const recordCandidate = {
            ...input.chat.record,
            status,
            createdAt: existing?.record.createdAt ?? input.chat.record.createdAt,
            updatedAt: now,
        } satisfies ConversationMetaRecord;

        const record = validateRecordPayload(
            recordNsid.conversationMeta,
            recordCandidate,
        );

        const recipientDid = didSchema.parse(input.recipientCapability.recipientDid);
        const capability: RecipientTransportCapability = {
            ...input.recipientCapability,
            recipientDid,
            detectedAt: isoDateTimeSchema.parse(input.recipientCapability.detectedAt),
        };

        const transportPath = resolveTransportPath(input.routingDecision, capability);
        const fallbackNotice = buildFallbackNotice(transportPath);

        const persisted: PersistedConversationMetadata = {
            conversationUri,
            aidPostUri: record.aidPostUri,
            record,
            requestContext: clone(input.chat.requestContext),
            routingDecision: clone(input.routingDecision),
            recipientCapability: capability,
            transportPath,
            fallbackNotice,
            audit: {
                lastUpdatedAt: now,
                moderationQueryableKey: `${record.aidPostUri}:${record.participantDids.join('|')}`,
            },
        };

        this.conversations.set(conversationUri, persisted);
        return clone(persisted);
    }

    getConversation(
        conversationUri: string,
    ): PersistedConversationMetadata | null {
        const normalizedUri = atUriSchema.parse(conversationUri);
        const found = this.conversations.get(normalizedUri);
        return found ? clone(found) : null;
    }

    listForAidPost(aidPostUri: string): PersistedConversationMetadata[] {
        const normalizedAidPostUri = atUriSchema.parse(aidPostUri);

        return [...this.conversations.values()]
            .filter(conversation => conversation.aidPostUri === normalizedAidPostUri)
            .sort((left, right) =>
                left.conversationUri.localeCompare(right.conversationUri),
            )
            .map(value => clone(value));
    }

    listFallbackRequired(): PersistedConversationMetadata[] {
        return [...this.conversations.values()]
            .filter(
                conversation =>
                    conversation.transportPath !== 'atproto-direct' &&
                    conversation.fallbackNotice !== undefined,
            )
            .sort((left, right) =>
                left.conversationUri.localeCompare(right.conversationUri),
            )
            .map(value => clone(value));
    }
}

export interface ChatSafetyEvaluationInput {
    senderDid: string;
    recipientDid: string;
    conversationUri: string;
    message: string;
    sentAt?: string;
}

export interface ChatSafetyEvaluation {
    allowed: boolean;
    code: 'OK' | 'BLOCKED' | 'RATE_LIMITED' | 'ABUSE_FLAGGED';
    userMessage: string;
    matchedKeywords: string[];
    moderationSignal?: ModerationReviewRequestedEvent;
}

export interface ChatSafetyConfig {
    maxMessagesPerWindow: number;
    windowMs: number;
    abuseKeywords: readonly string[];
}

export interface ReportAbuseInput {
    subjectUri: string;
    reporterDid: string;
    reason: ModerationReportRecord['reason'];
    details?: string;
    createdAt?: string;
}

const defaultSafetyConfig: ChatSafetyConfig = {
    maxMessagesPerWindow: 4,
    windowMs: 30_000,
    abuseKeywords: ['scam', 'fraud', 'abuse', 'threat'],
};

const getOrCreateSet = (
    map: Map<string, Set<string>>,
    key: string,
): Set<string> => {
    const value = map.get(key) ?? new Set<string>();
    map.set(key, value);
    return value;
};

export class ChatSafetyControls {
    private readonly blockedParticipants = new Map<string, Set<string>>();
    private readonly mutedConversations = new Map<string, Set<string>>();
    private readonly sendWindows = new Map<string, number[]>();
    private readonly moderationSignals: ModerationReviewRequestedEvent[] = [];

    constructor(private readonly config: ChatSafetyConfig = defaultSafetyConfig) {}

    blockParticipant(actorDid: string, targetDid: string): void {
        const actor = didSchema.parse(actorDid);
        const target = didSchema.parse(targetDid);
        getOrCreateSet(this.blockedParticipants, actor).add(target);
    }

    muteConversation(actorDid: string, conversationUri: string): void {
        const actor = didSchema.parse(actorDid);
        const uri = atUriSchema.parse(conversationUri);
        getOrCreateSet(this.mutedConversations, actor).add(uri);
    }

    isMuted(actorDid: string, conversationUri: string): boolean {
        const actor = didSchema.parse(actorDid);
        const uri = atUriSchema.parse(conversationUri);
        return this.mutedConversations.get(actor)?.has(uri) ?? false;
    }

    evaluateOutboundMessage(
        input: ChatSafetyEvaluationInput,
    ): ChatSafetyEvaluation {
        const senderDid = didSchema.parse(input.senderDid);
        const recipientDid = didSchema.parse(input.recipientDid);
        const conversationUri = atUriSchema.parse(input.conversationUri);
        const sentAt = isoDateTimeSchema.parse(
            input.sentAt ?? new Date().toISOString(),
        );

        const senderBlockedRecipient =
            this.blockedParticipants.get(senderDid)?.has(recipientDid) ?? false;
        const recipientBlockedSender =
            this.blockedParticipants.get(recipientDid)?.has(senderDid) ?? false;

        if (senderBlockedRecipient || recipientBlockedSender) {
            return {
                allowed: false,
                code: 'BLOCKED',
                userMessage:
                    'Message cannot be sent because one participant has blocked the other.',
                matchedKeywords: [],
            };
        }

        const nowMs = Date.parse(sentAt);
        const activeWindow = (this.sendWindows.get(senderDid) ?? []).filter(
            timestamp => nowMs - timestamp <= this.config.windowMs,
        );

        if (activeWindow.length >= this.config.maxMessagesPerWindow) {
            this.sendWindows.set(senderDid, activeWindow);
            return {
                allowed: false,
                code: 'RATE_LIMITED',
                userMessage:
                    'You are sending messages too quickly. Please wait before trying again.',
                matchedKeywords: [],
            };
        }

        activeWindow.push(nowMs);
        this.sendWindows.set(senderDid, activeWindow);

        const normalizedMessage = input.message.trim().toLowerCase();
        const matchedKeywords = this.config.abuseKeywords.filter(keyword =>
            normalizedMessage.includes(keyword.toLowerCase()),
        );

        if (matchedKeywords.length > 0) {
            const moderationSignal: ModerationReviewRequestedEvent = {
                type: 'moderation.review.requested',
                subjectUri: conversationUri,
                reason: `abuse-keyword:${matchedKeywords.join(',')}`,
                requestedAt: sentAt,
            };

            this.moderationSignals.push(moderationSignal);
            return {
                allowed: true,
                code: 'ABUSE_FLAGGED',
                userMessage:
                    'Message sent, but flagged for safety review due to policy keywords.',
                matchedKeywords,
                moderationSignal,
            };
        }

        return {
            allowed: true,
            code: 'OK',
            userMessage: 'Message sent.',
            matchedKeywords: [],
        };
    }

    reportAbuse(input: ReportAbuseInput): {
        reportRecord: ModerationReportRecord;
        moderationSignal: ModerationReviewRequestedEvent;
    } {
        const subjectUri = atUriSchema.parse(input.subjectUri);
        const reporterDid = didSchema.parse(input.reporterDid);
        const createdAt = isoDateTimeSchema.parse(
            input.createdAt ?? new Date().toISOString(),
        );

        const recordCandidate = {
            $type: recordNsid.moderationReport,
            version: '1.0.0',
            subjectUri,
            reporterDid,
            reason: input.reason,
            details: input.details?.trim() || undefined,
            createdAt,
        } satisfies ModerationReportRecord;

        const reportRecord = validateRecordPayload(
            recordNsid.moderationReport,
            recordCandidate,
        );

        const moderationSignal: ModerationReviewRequestedEvent = {
            type: 'moderation.review.requested',
            subjectUri,
            reason: `user-report:${reportRecord.reason}`,
            requestedAt: createdAt,
        };

        this.moderationSignals.push(moderationSignal);
        return { reportRecord, moderationSignal };
    }

    drainModerationSignals(): ModerationReviewRequestedEvent[] {
        const signals = [...this.moderationSignals].map(signal => clone(signal));
        this.moderationSignals.length = 0;
        return signals;
    }
}

export interface RoutingFixture {
    id: string;
    input: RoutingAssistantInput;
    expectedRule: RoutingDecision['matchedRule'];
    expectedDestinationKind: RoutingDecision['destinationKind'];
}

export const buildPhase5RoutingFixtures = (): readonly RoutingFixture[] => {
    return [
        {
            id: 'post-author-direct',
            input: {
                aidPostUri:
                    'at://did:example:requester/app.mutualhub.aid.post/post-author-1',
                requesterDid: 'did:example:requester',
                aidCategory: 'food',
                urgency: 'high',
                postAuthorDid: 'did:example:author',
                volunteerCandidates: [],
                resourceCandidates: [],
                now: '2026-02-26T14:00:00.000Z',
            },
            expectedRule: 'RULE_POST_AUTHOR',
            expectedDestinationKind: 'post-author',
        },
        {
            id: 'volunteer-best-match',
            input: {
                aidPostUri:
                    'at://did:example:requester/app.mutualhub.aid.post/volunteer-1',
                requesterDid: 'did:example:requester',
                aidCategory: 'transport',
                urgency: 'critical',
                volunteerCandidates: [
                    {
                        id: 'v2',
                        did: 'did:example:volunteer-b',
                        availability: 'within-24h',
                        trustScore: 0.95,
                        matchesCategory: true,
                    },
                    {
                        id: 'v1',
                        did: 'did:example:volunteer-a',
                        availability: 'immediate',
                        trustScore: 0.8,
                        matchesCategory: true,
                    },
                ],
                resourceCandidates: [],
                now: '2026-02-26T14:05:00.000Z',
            },
            expectedRule: 'RULE_VOLUNTEER_POOL',
            expectedDestinationKind: 'volunteer-pool',
        },
        {
            id: 'resource-verified',
            input: {
                aidPostUri:
                    'at://did:example:requester/app.mutualhub.aid.post/resource-1',
                requesterDid: 'did:example:requester',
                aidCategory: 'medical',
                urgency: 'medium',
                volunteerCandidates: [
                    {
                        id: 'v3',
                        did: 'did:example:volunteer-c',
                        availability: 'unavailable',
                        trustScore: 0.6,
                        matchesCategory: false,
                    },
                ],
                resourceCandidates: [
                    {
                        id: 'r2',
                        verificationStatus: 'community-verified',
                        supportsCategory: true,
                        currentlyOpen: true,
                    },
                    {
                        id: 'r1',
                        verificationStatus: 'partner-verified',
                        supportsCategory: true,
                        currentlyOpen: true,
                    },
                ],
                now: '2026-02-26T14:10:00.000Z',
            },
            expectedRule: 'RULE_VERIFIED_RESOURCE',
            expectedDestinationKind: 'verified-resource',
        },
    ] as const;
};
