import assert from "node:assert/strict";
import test from "node:test";

import { type AtAuthClient, AtAuthService, isSessionExpiringSoon } from "./auth.js";

const issuedAt = new Date("2026-02-25T00:00:00.000Z").toISOString();

test("AtAuthService signs in with DID/handle-backed identity", async () => {
  const client: AtAuthClient = {
    async createSession() {
      return {
        did: "did:plc:alice123",
        handle: "alice.example",
        accessJwt: "access-token",
        refreshJwt: "refresh-token",
        issuedAt,
        accessExpiresAt: new Date("2026-02-25T01:00:00.000Z").toISOString(),
      };
    },
    async refreshSession() {
      return {
        did: "did:plc:alice123",
        handle: "alice.example",
        accessJwt: "access-token-2",
        refreshJwt: "refresh-token-2",
        issuedAt,
        accessExpiresAt: new Date("2026-02-25T02:00:00.000Z").toISOString(),
      };
    },
    async resolveHandle(handle) {
      return {
        did: "did:plc:alice123",
        handle,
        trustScore: 0.8,
      };
    },
  };

  const auth = new AtAuthService(client, 120);
  const session = await auth.signIn({ identifier: "alice.example", password: "secret" });
  const identity = await auth.resolveHandle("alice.example");

  assert.equal(session.did, "did:plc:alice123");
  assert.equal(identity.handle, "alice.example");
  assert.equal(identity.trustScore, 0.8);
});

test("ensureFreshSession refreshes expiring tokens", async () => {
  let refreshCalls = 0;

  const client: AtAuthClient = {
    async createSession() {
      throw new Error("Not used in this test");
    },
    async refreshSession() {
      refreshCalls += 1;

      return {
        did: "did:plc:bob123",
        handle: "bob.example",
        accessJwt: "new-access",
        refreshJwt: "new-refresh",
        issuedAt,
        accessExpiresAt: new Date("2026-02-25T05:00:00.000Z").toISOString(),
      };
    },
    async resolveHandle() {
      throw new Error("Not used in this test");
    },
  };

  const auth = new AtAuthService(client, 120);
  const expiringSession = {
    did: "did:plc:bob123" as const,
    handle: "bob.example" as const,
    accessJwt: "access",
    refreshJwt: "refresh",
    issuedAt,
    accessExpiresAt: new Date("2026-02-25T00:01:00.000Z").toISOString(),
  };

  const now = Date.parse("2026-02-25T00:00:20.000Z");
  const refreshed = await auth.ensureFreshSession(expiringSession, now);

  assert.equal(refreshCalls, 1);
  assert.equal(refreshed.accessJwt, "new-access");
});

test("isSessionExpiringSoon returns false for comfortably valid session", () => {
  const session = {
    did: "did:plc:carol123" as const,
    handle: "carol.example" as const,
    accessJwt: "access",
    refreshJwt: "refresh",
    issuedAt,
    accessExpiresAt: new Date("2026-02-25T03:00:00.000Z").toISOString(),
  };

  const now = Date.parse("2026-02-25T00:00:00.000Z");
  assert.equal(isSessionExpiringSoon(session, now, 120), false);
});
