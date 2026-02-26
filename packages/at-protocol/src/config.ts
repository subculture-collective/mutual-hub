import { parseEnv } from "@mutual-hub/config";

export interface AtProtocolRuntimeConfig {
  pdsUrl: string;
  appViewUrl: string;
  refreshSkewSeconds: number;
}

export function createAtProtocolRuntimeConfig(
  rawEnv: NodeJS.ProcessEnv = process.env,
): AtProtocolRuntimeConfig {
  const env = parseEnv(rawEnv);

  return {
    pdsUrl: env.AT_PDS_URL,
    appViewUrl: env.AT_APPVIEW_URL,
    refreshSkewSeconds: env.AT_AUTH_REFRESH_SKEW_SECONDS,
  };
}
