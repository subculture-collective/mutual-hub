import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  WEB_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  INDEXER_PORT: z.coerce.number().int().min(1).max(65535).default(4100),
  MODERATION_WORKER_PORT: z.coerce.number().int().min(1).max(65535).default(4200),
  AT_SERVICE_DID: z.string().min(8).default("did:example:mutual-hub"),
  AT_PDS_URL: z.string().url().default("https://bsky.social"),
  AT_APPVIEW_URL: z.string().url().default("https://public.api.bsky.app"),
  AT_AUTH_REFRESH_SKEW_SECONDS: z.coerce.number().int().min(0).max(3600).default(120),
  GEO_PUBLIC_PRECISION_METERS: z.coerce.number().int().min(100).max(5000).default(300),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(rawEnv: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(rawEnv);
}
