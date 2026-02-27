import { z } from 'zod';
import { loadWorkspaceEnvFiles } from './env-file.js';
import { DID_PATTERN } from './schemas.js';

const nodeEnvSchema = z
    .enum(['development', 'test', 'production'])
    .default('development');

const baseSchema = z.object({
    NODE_ENV: nodeEnvSchema,
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const atprotoSchema = z.object({
    ATPROTO_SERVICE_DID: z
        .string()
        .regex(DID_PATTERN, 'ATPROTO_SERVICE_DID must be a valid DID string.'),
    ATPROTO_PDS_URL: z.string().url().default('https://bsky.social'),
});

const webSchema = baseSchema.extend({
    VITE_APP_NAME: z.string().min(1).default('Mutual Hub'),
    VITE_API_BASE_URL: z.string().url().default('http://localhost:4000'),
});

const apiSchema = baseSchema.merge(atprotoSchema).extend({
    API_HOST: z.string().min(1).default('0.0.0.0'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    API_PUBLIC_ORIGIN: z.string().url().default('http://localhost:5173'),
});

const indexerSchema = baseSchema.merge(atprotoSchema).extend({
    INDEXER_PORT: z.coerce.number().int().min(1).max(65535).default(4100),
    INDEXER_FIREHOSE_URL: z.string().url().default('wss://bsky.network'),
});

const moderationWorkerSchema = baseSchema.merge(atprotoSchema).extend({
    MODERATION_PORT: z.coerce.number().int().min(1).max(65535).default(4200),
    MODERATION_WORKER_CONCURRENCY: z.coerce
        .number()
        .int()
        .min(1)
        .max(64)
        .default(2),
});

type AnySchema = z.ZodTypeAny;

const formatZodErrors = (error: z.ZodError): string => {
    return error.issues
        .map(issue => {
            const path =
                issue.path.length === 0 ? '<root>' : issue.path.join('.');
            return `${path}: ${issue.message}`;
        })
        .join('; ');
};

const parseEnv = <T extends AnySchema>(
    scope: string,
    schema: T,
): z.infer<T> => {
    loadWorkspaceEnvFiles();
    const result = schema.safeParse(process.env);

    if (!result.success) {
        throw new Error(
            `Invalid ${scope} configuration: ${formatZodErrors(result.error)}`,
        );
    }

    return result.data;
};

export type WebConfig = z.infer<typeof webSchema>;
export type ApiConfig = z.infer<typeof apiSchema>;
export type IndexerConfig = z.infer<typeof indexerSchema>;
export type ModerationWorkerConfig = z.infer<typeof moderationWorkerSchema>;

export const loadWebConfig = (): WebConfig => parseEnv('web', webSchema);
export const loadApiConfig = (): ApiConfig => parseEnv('api', apiSchema);
export const loadIndexerConfig = (): IndexerConfig =>
    parseEnv('indexer', indexerSchema);
export const loadModerationWorkerConfig = (): ModerationWorkerConfig =>
    parseEnv('moderation-worker', moderationWorkerSchema);
