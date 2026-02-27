import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { ModerationReviewRequestedEvent } from './contracts.js';

const didSchema = z
    .string()
    .regex(/^did:[a-z0-9]+:[a-z0-9._:%-]+$/i, 'Expected a valid DID');
const atUriSchema = z
    .string()
    .regex(/^at:\/\/[^\s]+$/i, 'Expected a valid at:// URI');
const isoDateTimeSchema = z.string().datetime({ offset: true });

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export type ModerationSubjectType =
    | 'aid-post'
    | 'conversation'
    | 'directory-resource'
    | 'other';

export type ModerationQueueStatus = 'queued' | 'resolved';

export type ModerationVisibilityState = 'visible' | 'delisted' | 'suspended';

export type ModerationAppealState =
    | 'none'
    | 'pending'
    | 'under-review'
    | 'upheld'
    | 'rejected';

export type ModerationPolicyAction =
    | 'delist'
    | 'suspend-visibility'
    | 'restore-visibility'
    | 'open-appeal'
    | 'start-appeal-review'
    | 'resolve-appeal-upheld'
    | 'resolve-appeal-rejected';

export interface ModerationQueueContext {
    reporterDid?: string;
    summary?: string;
    tags?: string[];
}

export interface ModerationQueueItem {
    queueId: string;
    subjectUri: string;
    subjectType: ModerationSubjectType;
    reasons: string[];
    latestReason: string;
    reportCount: number;
    queueStatus: ModerationQueueStatus;
    visibility: ModerationVisibilityState;
    appealState: ModerationAppealState;
    createdAt: string;
    requestedAt: string;
    updatedAt: string;
    context: ModerationQueueContext;
}

export interface ModerationAuditStateSnapshot {
    queueStatus: ModerationQueueStatus;
    visibility: ModerationVisibilityState;
    appealState: ModerationAppealState;
}

export interface ModerationPolicyAuditEntry {
    actionId: string;
    queueId: string;
    subjectUri: string;
    actorDid: string;
    action: ModerationPolicyAction;
    reason: string;
    occurredAt: string;
    previousState: ModerationAuditStateSnapshot;
    nextState: ModerationAuditStateSnapshot;
}

export interface EnqueueModerationReviewInput {
    subjectUri: string;
    reason: string;
    requestedAt?: string;
    context?: ModerationQueueContext;
}

export interface ApplyModerationPolicyActionInput {
    subjectUri: string;
    actorDid: string;
    action: ModerationPolicyAction;
    reason: string;
    occurredAt?: string;
}

export class ModerationPolicyError extends Error {
    constructor(
        readonly code:
            | 'QUEUE_ITEM_NOT_FOUND'
            | 'INVALID_APPEAL_TRANSITION'
            | 'INVALID_POLICY_INPUT',
        message: string,
        readonly details?: Record<string, unknown>,
    ) {
        super(message);
        this.name = 'ModerationPolicyError';
    }
}

const subjectTypeFromUri = (subjectUri: string): ModerationSubjectType => {
    if (subjectUri.includes('/app.mutualhub.aid.post/')) {
        return 'aid-post';
    }
    if (subjectUri.includes('/app.mutualhub.conversation.meta/')) {
        return 'conversation';
    }
    if (subjectUri.includes('/app.mutualhub.directory.resource/')) {
        return 'directory-resource';
    }

    return 'other';
};

const toQueueId = (subjectUri: string): string => {
    return createHash('sha256').update(subjectUri).digest('hex').slice(0, 20);
};

const toAuditId = (
    queueId: string,
    action: ModerationPolicyAction,
    occurredAt: string,
    actorDid: string,
): string => {
    return createHash('sha256')
        .update(`${queueId}|${action}|${occurredAt}|${actorDid}`)
        .digest('hex')
        .slice(0, 20);
};

const mergeContext = (
    existing: ModerationQueueContext,
    next: ModerationQueueContext,
): ModerationQueueContext => {
    return {
        reporterDid:
            next.reporterDid?.trim() || existing.reporterDid || undefined,
        summary: next.summary?.trim() || existing.summary || undefined,
        tags:
            next.tags && next.tags.length > 0 ?
                [...new Set(next.tags.map(tag => tag.trim()).filter(Boolean))]
            :   existing.tags,
    };
};

const applyTransition = (
    current: ModerationQueueItem,
    action: ModerationPolicyAction,
): ModerationAuditStateSnapshot => {
    const next: ModerationAuditStateSnapshot = {
        queueStatus: current.queueStatus,
        visibility: current.visibility,
        appealState: current.appealState,
    };

    switch (action) {
        case 'delist':
            next.visibility = 'delisted';
            next.queueStatus = 'resolved';
            break;
        case 'suspend-visibility':
            next.visibility = 'suspended';
            next.queueStatus = 'resolved';
            break;
        case 'restore-visibility':
            next.visibility = 'visible';
            next.queueStatus =
                (
                    current.appealState === 'pending' ||
                    current.appealState === 'under-review'
                ) ?
                    'queued'
                :   'resolved';
            break;
        case 'open-appeal':
            next.appealState = 'pending';
            next.queueStatus = 'queued';
            break;
        case 'start-appeal-review':
            if (current.appealState !== 'pending') {
                throw new ModerationPolicyError(
                    'INVALID_APPEAL_TRANSITION',
                    'Appeal review can only start from pending state.',
                    {
                        subjectUri: current.subjectUri,
                        appealState: current.appealState,
                    },
                );
            }
            next.appealState = 'under-review';
            next.queueStatus = 'queued';
            break;
        case 'resolve-appeal-upheld':
            if (
                current.appealState !== 'under-review' &&
                current.appealState !== 'pending'
            ) {
                throw new ModerationPolicyError(
                    'INVALID_APPEAL_TRANSITION',
                    'Appeal can only be upheld from pending or under-review state.',
                    {
                        subjectUri: current.subjectUri,
                        appealState: current.appealState,
                    },
                );
            }
            next.appealState = 'upheld';
            next.queueStatus = 'resolved';
            break;
        case 'resolve-appeal-rejected':
            if (
                current.appealState !== 'under-review' &&
                current.appealState !== 'pending'
            ) {
                throw new ModerationPolicyError(
                    'INVALID_APPEAL_TRANSITION',
                    'Appeal can only be rejected from pending or under-review state.',
                    {
                        subjectUri: current.subjectUri,
                        appealState: current.appealState,
                    },
                );
            }
            next.appealState = 'rejected';
            next.queueStatus = 'resolved';
            break;
        default:
            throw new ModerationPolicyError(
                'INVALID_POLICY_INPUT',
                `Unsupported moderation action: ${action}`,
                { action },
            );
    }

    return next;
};

export class ModerationReviewQueue {
    private readonly queueBySubject = new Map<string, ModerationQueueItem>();
    private readonly auditTrail: ModerationPolicyAuditEntry[] = [];

    enqueueReview(input: EnqueueModerationReviewInput): ModerationQueueItem {
        const subjectUri = atUriSchema.parse(input.subjectUri);
        const reason = input.reason.trim();
        if (reason.length === 0) {
            throw new ModerationPolicyError(
                'INVALID_POLICY_INPUT',
                'Moderation reason is required.',
                { subjectUri },
            );
        }

        const requestedAt = isoDateTimeSchema.parse(
            input.requestedAt ?? new Date().toISOString(),
        );

        const existing = this.queueBySubject.get(subjectUri);
        if (existing) {
            const next: ModerationQueueItem = {
                ...existing,
                reasons:
                    existing.reasons.includes(reason) ?
                        [...existing.reasons]
                    :   [...existing.reasons, reason],
                latestReason: reason,
                reportCount: existing.reportCount + 1,
                queueStatus: 'queued',
                requestedAt,
                updatedAt: requestedAt,
                context: mergeContext(existing.context, input.context ?? {}),
            };
            this.queueBySubject.set(subjectUri, next);
            return clone(next);
        }

        const created: ModerationQueueItem = {
            queueId: toQueueId(subjectUri),
            subjectUri,
            subjectType: subjectTypeFromUri(subjectUri),
            reasons: [reason],
            latestReason: reason,
            reportCount: 1,
            queueStatus: 'queued',
            visibility: 'visible',
            appealState: 'none',
            createdAt: requestedAt,
            requestedAt,
            updatedAt: requestedAt,
            context: mergeContext({}, input.context ?? {}),
        };

        this.queueBySubject.set(subjectUri, created);
        return clone(created);
    }

    enqueueSignal(
        signal: ModerationReviewRequestedEvent,
        context: ModerationQueueContext = {},
    ): ModerationQueueItem {
        return this.enqueueReview({
            subjectUri: signal.subjectUri,
            reason: signal.reason,
            requestedAt: signal.requestedAt,
            context,
        });
    }

    applyPolicyAction(
        input: ApplyModerationPolicyActionInput,
    ): ModerationQueueItem {
        const subjectUri = atUriSchema.parse(input.subjectUri);
        const actorDid = didSchema.parse(input.actorDid);
        const reason = input.reason.trim();

        if (reason.length === 0) {
            throw new ModerationPolicyError(
                'INVALID_POLICY_INPUT',
                'Policy action reason is required.',
                { subjectUri },
            );
        }

        const current = this.queueBySubject.get(subjectUri);
        if (!current) {
            throw new ModerationPolicyError(
                'QUEUE_ITEM_NOT_FOUND',
                'Moderation queue item not found.',
                { subjectUri },
            );
        }

        const occurredAt = isoDateTimeSchema.parse(
            input.occurredAt ?? new Date().toISOString(),
        );

        const previousState: ModerationAuditStateSnapshot = {
            queueStatus: current.queueStatus,
            visibility: current.visibility,
            appealState: current.appealState,
        };

        const nextState = applyTransition(current, input.action);

        const updated: ModerationQueueItem = {
            ...current,
            ...nextState,
            updatedAt: occurredAt,
        };

        this.queueBySubject.set(subjectUri, updated);
        this.auditTrail.push({
            actionId: toAuditId(
                updated.queueId,
                input.action,
                occurredAt,
                actorDid,
            ),
            queueId: updated.queueId,
            subjectUri,
            actorDid,
            action: input.action,
            reason,
            occurredAt,
            previousState,
            nextState,
        });

        return clone(updated);
    }

    getState(subjectUri: string): ModerationQueueItem | null {
        const normalizedSubjectUri = atUriSchema.parse(subjectUri);
        const found = this.queueBySubject.get(normalizedSubjectUri);
        return found ? clone(found) : null;
    }

    listQueue(filters?: {
        queueStatus?: ModerationQueueStatus;
        visibility?: ModerationVisibilityState;
        appealState?: ModerationAppealState;
    }): ModerationQueueItem[] {
        return [...this.queueBySubject.values()]
            .filter(item => {
                if (
                    filters?.queueStatus &&
                    item.queueStatus !== filters.queueStatus
                ) {
                    return false;
                }
                if (
                    filters?.visibility &&
                    item.visibility !== filters.visibility
                ) {
                    return false;
                }
                if (
                    filters?.appealState &&
                    item.appealState !== filters.appealState
                ) {
                    return false;
                }
                return true;
            })
            .sort((left, right) => {
                const byUpdatedAt =
                    Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
                if (byUpdatedAt !== 0) {
                    return byUpdatedAt;
                }
                return left.queueId.localeCompare(right.queueId);
            })
            .map(entry => clone(entry));
    }

    listAuditTrail(subjectUri?: string): ModerationPolicyAuditEntry[] {
        const normalizedSubjectUri =
            subjectUri ? atUriSchema.parse(subjectUri) : undefined;

        return this.auditTrail
            .filter(entry => {
                if (!normalizedSubjectUri) {
                    return true;
                }
                return entry.subjectUri === normalizedSubjectUri;
            })
            .sort((left, right) => {
                const byOccurredAt =
                    Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
                if (byOccurredAt !== 0) {
                    return byOccurredAt;
                }
                return left.actionId.localeCompare(right.actionId);
            })
            .map(entry => clone(entry));
    }
}
