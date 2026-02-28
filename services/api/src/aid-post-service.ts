import { randomUUID } from 'node:crypto';
import { ZodError, z } from 'zod';
import { type Pool } from 'pg';
import {
    FirehoseConsumer,
    type AidPostRecord,
    didSchema,
    isoDateTimeSchema,
    recordNsid,
} from '@patchwork/shared';
import {
    appendDiscoveryEvents,
    createPostgresPool,
} from './db/discovery-events.js';
import type { ApiDiscoveryQueryService } from './query-service.js';

export interface AidPostRouteResult {
    statusCode: number;
    body: ApiAidPostCreateSuccessResponse | AidPostErrorResponse;
}

export interface AidPostErrorResponse {
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
}

export interface ApiAidPostCreateSuccessResponse {
    uri: string;
    authorDid: string;
    title: string;
    summary: string;
    category: AidPostRecord['category'];
    urgency: AidPostRecord['urgency'];
    status: AidPostRecord['status'];
    approximateGeo: {
        latitude: number;
        longitude: number;
        precisionKm: number;
    };
    createdAt: string;
    updatedAt: string;
}

const aidPostCreateSchema = z.object({
    authorDid: didSchema,
    title: z.string().trim().min(1).max(140),
    description: z.string().trim().min(1).max(5000),
    category: z.enum([
        'food',
        'shelter',
        'medical',
        'transport',
        'childcare',
        'other',
    ]),
    urgency: z.enum(['low', 'medium', 'high', 'critical']),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    precisionKm: z.number().min(0.1).max(50).optional(),
    rkey: z.string().trim().min(1).max(120).optional(),
    now: isoDateTimeSchema.optional(),
    trustScore: z.number().min(0).max(1).optional(),
});

type AidPostCreateInput = z.infer<typeof aidPostCreateSchema>;

const readNumber = (
    params: URLSearchParams,
    key: string,
): number | undefined => {
    const raw = params.get(key);
    if (raw === null || raw.trim().length === 0) {
        return undefined;
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const readString = (
    params: URLSearchParams,
    key: string,
): string | undefined => {
    const raw = params.get(key);
    if (raw === null || raw.trim().length === 0) {
        return undefined;
    }

    return raw;
};

const parseCreateInput = (params: URLSearchParams): AidPostCreateInput => {
    return aidPostCreateSchema.parse({
        authorDid: readString(params, 'authorDid'),
        title: readString(params, 'title'),
        description: readString(params, 'description'),
        category: readString(params, 'category'),
        urgency: readString(params, 'urgency'),
        latitude: readNumber(params, 'latitude'),
        longitude: readNumber(params, 'longitude'),
        precisionKm: readNumber(params, 'precisionKm'),
        rkey: readString(params, 'rkey'),
        now: readString(params, 'now'),
        trustScore: readNumber(params, 'trustScore'),
    });
};

const toValidationError = (error: ZodError): AidPostErrorResponse => {
    return {
        error: {
            code: 'INVALID_QUERY',
            message: 'Aid post payload failed validation.',
            details: {
                issues: error.issues.map(issue => ({
                    path: issue.path.join('.'),
                    message: issue.message,
                })),
            },
        },
    };
};

export class ApiAidPostService {
    constructor(
        private readonly queryService: ApiDiscoveryQueryService,
        private readonly options: {
            dataSource: 'fixture' | 'postgres';
            databaseUrl?: string;
            pool?: Pool;
        },
    ) {}

    async createFromParams(
        params: URLSearchParams,
    ): Promise<AidPostRouteResult> {
        let input: AidPostCreateInput;

        try {
            input = parseCreateInput(params);
        } catch (error) {
            if (error instanceof ZodError) {
                return {
                    statusCode: 400,
                    body: toValidationError(error),
                };
            }

            throw error;
        }

        return this.createFromInput(input);
    }

    async createFromBody(body: unknown): Promise<AidPostRouteResult> {
        let input: AidPostCreateInput;

        try {
            input = aidPostCreateSchema.parse(body);
        } catch (error) {
            if (error instanceof ZodError) {
                return {
                    statusCode: 400,
                    body: toValidationError(error),
                };
            }

            throw error;
        }

        return this.createFromInput(input);
    }

    private async createFromInput(
        input: AidPostCreateInput,
    ): Promise<AidPostRouteResult> {
        const now = input.now ?? new Date().toISOString();
        const rkey = input.rkey ?? `post-${randomUUID()}`;
        const uri = `at://${input.authorDid}/${recordNsid.aidPost}/${rkey}`;

        const record: AidPostRecord = {
            $type: recordNsid.aidPost,
            version: '1.0.0',
            title: input.title,
            description: input.description,
            category: input.category,
            urgency: input.urgency,
            status: 'open',
            location: {
                latitude: Number(input.latitude.toFixed(6)),
                longitude: Number(input.longitude.toFixed(6)),
                precisionKm: Number((input.precisionKm ?? 0.3).toFixed(3)),
            },
            createdAt: now,
            updatedAt: now,
        };

        const consumer = new FirehoseConsumer();
        const result = consumer.ingest([
            {
                seq: Date.now(),
                receivedAt: now,
                action: 'create',
                uri,
                collection: recordNsid.aidPost,
                authorDid: input.authorDid,
                trustScore: input.trustScore ?? 0.75,
                record,
            },
        ]);

        if (
            result.failures.length > 0 ||
            result.normalizedEvents.length === 0
        ) {
            const [failure] = result.failures;
            return {
                statusCode: 400,
                body: {
                    error: {
                        code: failure?.code ?? 'VALIDATION_FAILED',
                        message:
                            failure?.message ??
                            'Unable to normalize aid post firehose event.',
                    },
                },
            };
        }

        try {
            if (
                this.options.dataSource === 'postgres' &&
                this.options.pool
            ) {
                await appendDiscoveryEvents(
                    this.options.pool,
                    result.normalizedEvents,
                );
            } else if (
                this.options.dataSource === 'postgres' &&
                this.options.databaseUrl
            ) {
                const pool = createPostgresPool(this.options.databaseUrl);
                try {
                    await appendDiscoveryEvents(pool, result.normalizedEvents);
                } finally {
                    await pool.end();
                }
            }

            this.queryService.applyNormalizedEvents(result.normalizedEvents);
        } catch (error) {
            return {
                statusCode: 500,
                body: {
                    error: {
                        code: 'WRITE_FAILED',
                        message:
                            error instanceof Error ?
                                error.message
                            :   'Unable to persist aid post event.',
                    },
                },
            };
        }

        return {
            statusCode: 201,
            body: {
                uri,
                authorDid: input.authorDid,
                title: record.title,
                summary: record.description,
                category: record.category,
                urgency: record.urgency,
                status: record.status,
                approximateGeo: {
                    latitude: record.location.latitude,
                    longitude: record.location.longitude,
                    precisionKm: record.location.precisionKm,
                },
                createdAt: record.createdAt,
                updatedAt: record.updatedAt ?? record.createdAt,
            },
        };
    }
}

export const createAidPostService = (
    queryService: ApiDiscoveryQueryService,
    options: {
        dataSource: 'fixture' | 'postgres';
        databaseUrl?: string;
        pool?: Pool;
    },
): ApiAidPostService => {
    return new ApiAidPostService(queryService, options);
};
