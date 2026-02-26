import assert from "node:assert/strict";
import test from "node:test";

import { parseEnv } from "./env.js";

test("parseEnv applies safe defaults", () => {
  const env = parseEnv({});

  assert.equal(env.WEB_PORT, 3000);
  assert.equal(env.NODE_ENV, "development");
  assert.equal(env.AT_APPVIEW_URL, "https://public.api.bsky.app");
  assert.equal(env.AT_AUTH_REFRESH_SKEW_SECONDS, 120);
  assert.equal(env.GEO_PUBLIC_PRECISION_METERS, 300);
});
