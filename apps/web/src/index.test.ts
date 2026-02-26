import assert from "node:assert/strict";
import test from "node:test";

import { createWebShellBootstrap } from "./index.js";

test("web shell bootstrap includes public sections", () => {
  const shell = createWebShellBootstrap({ WEB_PORT: "3005" });

  assert.equal(shell.port, 3005);
  assert.equal(shell.service, "web");
  assert.ok(shell.sections.find((section) => section.route === "/map"));
  assert.ok(shell.sections.find((section) => section.route === "/feed"));
});
