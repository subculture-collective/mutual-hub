import assert from "node:assert/strict";
import test from "node:test";

import { createModerationWorkerService } from "./index.js";

test("moderation worker initializes with configured port", () => {
  const worker = createModerationWorkerService({ MODERATION_WORKER_PORT: "4201" });

  assert.equal(worker.service, "moderation-worker");
  assert.equal(worker.port, 4201);
});
