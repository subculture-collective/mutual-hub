import { z, ZodError } from 'zod';
import { didSchema } from '@patchwork/shared';
import {
    canTransition,
    createStatusTransition,
    getValidTargetsForRole,
    isValidLifecycleRole,
    STATUS_LABELS,
    type LifecycleRole,
    type RequestStatus,
    type RequestTimeline,
    type StatusTransition,
} from '../../../packages/shared/src/lifecycle.js';

/**
 * In-memory store for request statuses and timelines.
 * In production this would be backed by a database.
 */
interface RequestLifecycleRecord {
    postUri: string;
    currentStatus: RequestStatus;
    timeline: RequestTimeline;
    updatedAt: string;
}

export interface LifecycleTransitionResult {
    statusCode: number;
    body:
        | LifecycleTransitionSuccessResponse
        | LifecycleTransitionErrorResponse;
}

export interface LifecycleTransitionSuccessResponse {
    postUri: string;
    previousStatus: RequestStatus;
    currentStatus: RequestStatus;
    transition: StatusTransition;
    timeline: RequestTimeline;
    updatedAt: string;
}

export interface LifecycleTransitionErrorResponse {
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
}

export interface LifecycleQueryResult {
    statusCode: number;
    body:
        | LifecycleQuerySuccessResponse
        | LifecycleTransitionErrorResponse;
}

export interface LifecycleQuerySuccessResponse {
    postUri: string;
    currentStatus: RequestStatus;
    statusLabel: string;
    timeline: RequestTimeline;
    validTransitions: RequestStatus[];
    updatedAt: string;
}

const transitionInputSchema = z.object({
    postUri: z
        .string()
        .min(1, 'postUri is required')
        .regex(/^at:\/\//, 'postUri must be a valid at:// URI'),
    targetStatus: z.enum([
        'open',
        'triaged',
        'assigned',
        'in_progress',
        'resolved',
        'archived',
    ]),
    actorDid: didSchema,
    actorRole: z.enum([
        'requester',
        'volunteer',
        'coordinator',
        'moderator',
        'admin',
    ]),
    reason: z.string().max(500).optional(),
    now: z.string().datetime({ offset: true }).optional(),
});

type TransitionInput = z.infer<typeof transitionInputSchema>;

const toValidationError = (
    error: ZodError,
): LifecycleTransitionErrorResponse => {
    return {
        error: {
            code: 'INVALID_INPUT',
            message: 'Transition request failed validation.',
            details: {
                issues: error.issues.map((issue) => ({
                    path: issue.path.join('.'),
                    message: issue.message,
                })),
            },
        },
    };
};

export class LifecycleService {
    private readonly records = new Map<string, RequestLifecycleRecord>();

    /**
     * Register a post with initial 'open' status. Called when a post is
     * created so the lifecycle service can track it.
     */
    registerPost(postUri: string, createdAt?: string): void {
        if (this.records.has(postUri)) {
            return;
        }

        const now = createdAt ?? new Date().toISOString();
        this.records.set(postUri, {
            postUri,
            currentStatus: 'open',
            timeline: [],
            updatedAt: now,
        });
    }

    /**
     * Process a status transition request from a JSON body.
     */
    async transitionFromBody(
        body: unknown,
    ): Promise<LifecycleTransitionResult> {
        let input: TransitionInput;

        try {
            input = transitionInputSchema.parse(body);
        } catch (error) {
            if (error instanceof ZodError) {
                return {
                    statusCode: 400,
                    body: toValidationError(error),
                };
            }
            throw error;
        }

        return this.executeTransition(input);
    }

    /**
     * Process a status transition from URL search params.
     */
    async transitionFromParams(
        params: URLSearchParams,
    ): Promise<LifecycleTransitionResult> {
        const body = {
            postUri: params.get('postUri') ?? undefined,
            targetStatus: params.get('targetStatus') ?? undefined,
            actorDid: params.get('actorDid') ?? undefined,
            actorRole: params.get('actorRole') ?? undefined,
            reason: params.get('reason') ?? undefined,
            now: params.get('now') ?? undefined,
        };

        return this.transitionFromBody(body);
    }

    /**
     * Query the lifecycle state and timeline for a post.
     */
    queryPostLifecycle(
        postUri: string,
        actorRole?: string,
    ): LifecycleQueryResult {
        const record = this.records.get(postUri);

        if (!record) {
            return {
                statusCode: 404,
                body: {
                    error: {
                        code: 'NOT_FOUND',
                        message: `No lifecycle record found for post: ${postUri}`,
                    },
                },
            };
        }

        const role: LifecycleRole =
            actorRole && isValidLifecycleRole(actorRole)
                ? actorRole
                : 'requester';

        return {
            statusCode: 200,
            body: {
                postUri: record.postUri,
                currentStatus: record.currentStatus,
                statusLabel: STATUS_LABELS[record.currentStatus],
                timeline: [...record.timeline],
                validTransitions: getValidTargetsForRole(
                    record.currentStatus,
                    role,
                ),
                updatedAt: record.updatedAt,
            },
        };
    }

    /**
     * Query lifecycle state from URL search params.
     */
    queryFromParams(params: URLSearchParams): LifecycleQueryResult {
        const postUri = params.get('postUri');

        if (!postUri) {
            return {
                statusCode: 400,
                body: {
                    error: {
                        code: 'INVALID_INPUT',
                        message: 'postUri query parameter is required.',
                    },
                },
            };
        }

        return this.queryPostLifecycle(
            postUri,
            params.get('actorRole') ?? undefined,
        );
    }

    /**
     * Get internal record for testing.
     */
    getRecord(postUri: string): RequestLifecycleRecord | undefined {
        return this.records.get(postUri);
    }

    private executeTransition(
        input: TransitionInput,
    ): LifecycleTransitionResult {
        // Auto-register if the post is not yet tracked
        if (!this.records.has(input.postUri)) {
            this.registerPost(input.postUri);
        }

        const record = this.records.get(input.postUri)!;
        const previousStatus = record.currentStatus;
        const targetStatus = input.targetStatus as RequestStatus;
        const actorRole = input.actorRole as LifecycleRole;

        // Validate the transition with role-aware checks
        const validation = canTransition(
            previousStatus,
            targetStatus,
            actorRole,
        );

        if (!validation.valid) {
            return {
                statusCode: 403,
                body: {
                    error: {
                        code: validation.code,
                        message: validation.message,
                        details: {
                            previousStatus,
                            targetStatus,
                            actorRole,
                        },
                    },
                },
            };
        }

        const now = input.now ?? new Date().toISOString();

        const transition = createStatusTransition({
            from: previousStatus,
            to: targetStatus,
            actorDid: input.actorDid,
            actorRole,
            timestamp: now,
            reason: input.reason,
        });

        // Apply the transition
        record.currentStatus = targetStatus;
        record.timeline.push(transition);
        record.updatedAt = now;

        return {
            statusCode: 200,
            body: {
                postUri: record.postUri,
                previousStatus,
                currentStatus: record.currentStatus,
                transition,
                timeline: [...record.timeline],
                updatedAt: record.updatedAt,
            },
        };
    }
}

export const createLifecycleService = (): LifecycleService => {
    return new LifecycleService();
};
