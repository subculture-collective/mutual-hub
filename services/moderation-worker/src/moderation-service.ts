import {
    ModerationPolicyError,
    ModerationReviewQueue,
    toErrorHttpResult,
    readQueryString,
    requireQueryString,
    type ModerationAppealState,
    type ModerationPolicyAction,
    type ModerationQueueStatus,
    type ModerationVisibilityState,
} from '@patchwork/shared';

export interface ModerationServiceResult {
    statusCode: number;
    body: unknown;
}

const requireString = (params: URLSearchParams, key: string): string => {
    return requireQueryString(
        params,
        key,
        missingKey =>
            new ModerationPolicyError(
                'INVALID_POLICY_INPUT',
                `Missing required query parameter: ${missingKey}`,
                { key: missingKey },
            ),
    );
};

const readString = readQueryString;

const toErrorResult = (
    error: unknown,
    fallbackMessage: string,
): ModerationServiceResult => {
    if (error instanceof ModerationPolicyError) {
        const statusCode =
            error.code === 'QUEUE_ITEM_NOT_FOUND' ? 404
            : error.code === 'INVALID_APPEAL_TRANSITION' ? 409
            : 400;

        return toErrorHttpResult(
            statusCode,
            error.code,
            error.message,
            error.details,
        );
    }

    return toErrorHttpResult(400, 'INVALID_POLICY_INPUT', fallbackMessage);
};

const parseQueueStatus = (
    value: string | undefined,
): ModerationQueueStatus | undefined => {
    if (value === 'queued' || value === 'resolved') {
        return value;
    }

    return undefined;
};

const parseVisibility = (
    value: string | undefined,
): ModerationVisibilityState | undefined => {
    if (value === 'visible' || value === 'delisted' || value === 'suspended') {
        return value;
    }

    return undefined;
};

const parseAppealState = (
    value: string | undefined,
): ModerationAppealState | undefined => {
    if (
        value === 'none' ||
        value === 'pending' ||
        value === 'under-review' ||
        value === 'upheld' ||
        value === 'rejected'
    ) {
        return value;
    }

    return undefined;
};

const parsePolicyAction = (
    value: string | undefined,
): ModerationPolicyAction => {
    if (
        value === 'delist' ||
        value === 'suspend-visibility' ||
        value === 'restore-visibility' ||
        value === 'open-appeal' ||
        value === 'start-appeal-review' ||
        value === 'resolve-appeal-upheld' ||
        value === 'resolve-appeal-rejected'
    ) {
        return value;
    }

    throw new ModerationPolicyError(
        'INVALID_POLICY_INPUT',
        `Unsupported policy action: ${value ?? '<missing>'}`,
    );
};

const parseTags = (value: string | undefined): string[] | undefined => {
    if (!value) {
        return undefined;
    }

    return value
        .split(',')
        .map(entry => entry.trim())
        .filter(Boolean);
};

export class ModerationWorkerService {
    private readonly queue = new ModerationReviewQueue();

    enqueueFromParams(params: URLSearchParams): ModerationServiceResult {
        try {
            const item = this.queue.enqueueReview({
                subjectUri: requireString(params, 'subjectUri'),
                reason: requireString(params, 'reason'),
                requestedAt: readString(params, 'requestedAt'),
                context: {
                    reporterDid: readString(params, 'reporterDid'),
                    summary: readString(params, 'summary'),
                    tags: parseTags(readString(params, 'tags')),
                },
            });

            return {
                statusCode: 200,
                body: {
                    item,
                },
            };
        } catch (error) {
            return toErrorResult(error, 'Failed to enqueue moderation review.');
        }
    }

    listQueueFromParams(params: URLSearchParams): ModerationServiceResult {
        try {
            const items = this.queue.listQueue({
                queueStatus: parseQueueStatus(readString(params, 'status')),
                visibility: parseVisibility(readString(params, 'visibility')),
                appealState: parseAppealState(
                    readString(params, 'appealState'),
                ),
            });

            return {
                statusCode: 200,
                body: {
                    total: items.length,
                    results: items,
                },
            };
        } catch (error) {
            return toErrorResult(error, 'Failed to list moderation queue.');
        }
    }

    applyPolicyFromParams(params: URLSearchParams): ModerationServiceResult {
        try {
            const item = this.queue.applyPolicyAction({
                subjectUri: requireString(params, 'subjectUri'),
                actorDid: requireString(params, 'actorDid'),
                action: parsePolicyAction(readString(params, 'action')),
                reason: requireString(params, 'reason'),
                occurredAt: readString(params, 'occurredAt'),
            });

            return {
                statusCode: 200,
                body: {
                    item,
                },
            };
        } catch (error) {
            return toErrorResult(
                error,
                'Failed to apply moderation policy action.',
            );
        }
    }

    getStateFromParams(params: URLSearchParams): ModerationServiceResult {
        try {
            const subjectUri = requireString(params, 'subjectUri');
            const item = this.queue.getState(subjectUri);

            return {
                statusCode: item ? 200 : 404,
                body:
                    item ?
                        { item }
                    :   {
                            error: {
                                code: 'QUEUE_ITEM_NOT_FOUND',
                                message: 'Moderation state not found.',
                                details: { subjectUri },
                            },
                        },
            };
        } catch (error) {
            return toErrorResult(error, 'Failed to fetch moderation state.');
        }
    }

    listAuditFromParams(params: URLSearchParams): ModerationServiceResult {
        try {
            const subjectUri = readString(params, 'subjectUri');
            const entries = this.queue.listAuditTrail(subjectUri);

            return {
                statusCode: 200,
                body: {
                    total: entries.length,
                    results: entries,
                },
            };
        } catch (error) {
            return toErrorResult(
                error,
                'Failed to list moderation audit trail.',
            );
        }
    }
}

export const createFixtureModerationWorkerService =
    (): ModerationWorkerService => {
        return new ModerationWorkerService();
    };
