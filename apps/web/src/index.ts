import { parseEnv } from "@mutual-hub/config";
import { aidCategories } from "@mutual-hub/shared";

import { shellSections } from "./app-shell.js";
export * from "./discovery-filters.js";
export * from "./discovery-primitives.js";
export * from "./feed-ux.js";
export * from "./map-ux.js";
export * from "./posting-form.js";

export interface WebShellBootstrap {
  service: "web";
  port: number;
  sections: typeof shellSections;
  supportedCategories: readonly string[];
}

export function createWebShellBootstrap(
  rawEnv: NodeJS.ProcessEnv = process.env,
): WebShellBootstrap {
  const env = parseEnv(rawEnv);

  return {
    service: "web",
    port: env.WEB_PORT,
    sections: shellSections,
    supportedCategories: aidCategories,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(createWebShellBootstrap(), null, 2));
}
