import assert from "node:assert/strict";
import test from "node:test";

import { routingFixtures } from "./chat-routing.fixtures.js";
import type { RoutingDecisionInput } from "./chat-routing.js";
import { decideChatRoute } from "./chat-routing.js";

test("routing engine matches fixture expectations across representative scenarios", () => {
  for (const fixture of routingFixtures) {
    const decision = decideChatRoute(fixture.input);

    assert.equal(
      decision.destinationType,
      fixture.expectedDestination,
      `${fixture.name}: destination mismatch`,
    );
    assert.equal(
      decision.machineRationale.selectedRule,
      fixture.expectedRule,
      `${fixture.name}: rule mismatch`,
    );
    assert.ok(
      decision.machineRationale.traces.length >= 1,
      `${fixture.name}: expected non-empty trace`,
    );
    assert.ok(
      decision.humanRationale.length > 20,
      `${fixture.name}: human rationale should be informative`,
    );
  }
});

test("volunteer tie-break ordering is deterministic", () => {
  const input: RoutingDecisionInput = {
    requesterDid: "did:plc:req",
    postAuthorDid: "did:plc:author",
    postUri: "at://did:plc:author/com.mutualaid.hub.aidPost/post-1",
    postCategory: "food" as const,
    postAuthorReachable: false,
    volunteerCandidates: [
      {
        did: "did:plc:vol-b",
        verified: true,
        acceptsChats: true,
        supportedCategories: ["food"] as const,
        distanceMeters: 500,
      },
      {
        did: "did:plc:vol-a",
        verified: true,
        acceptsChats: true,
        supportedCategories: ["food"] as const,
        distanceMeters: 500,
      },
    ],
  };

  const first = decideChatRoute(input);
  const second = decideChatRoute(input);

  assert.equal(first.destinationType, "volunteer_pool");
  assert.equal(second.destinationType, "volunteer_pool");
  assert.equal(first.destinationId, "did:plc:vol-a");
  assert.equal(first.destinationId, second.destinationId);
});

test("volunteer preference signals influence destination selection deterministically", () => {
  const decision = decideChatRoute({
    requesterDid: "did:plc:req-pref-1",
    postAuthorDid: "did:plc:author-pref-1",
    postUri: "at://did:plc:author-pref-1/com.mutualaid.hub.aidPost/pref-1",
    postCategory: "medical",
    requiredVolunteerSkills: ["triage", "first aid"],
    requestAvailabilityTag: "weekday_evenings",
    postAuthorReachable: false,
    volunteerCandidates: [
      {
        did: "did:plc:closer-no-pref",
        verified: true,
        acceptsChats: true,
        supportedCategories: ["medical"],
        distanceMeters: 300,
        lastActiveAt: "2026-02-25T11:00:00.000Z",
      },
      {
        did: "did:plc:pref-match",
        verified: true,
        acceptsChats: true,
        supportedCategories: ["medical"],
        preferredAidCategories: ["medical"],
        skills: ["triage", "peer-support"],
        availabilityTags: ["weekday_evenings"],
        preferenceBoost: 2,
        distanceMeters: 1200,
        lastActiveAt: "2026-02-25T09:00:00.000Z",
      },
    ],
  });

  assert.equal(decision.destinationType, "volunteer_pool");
  assert.equal(decision.destinationId, "did:plc:pref-match");
  assert.equal(decision.machineRationale.selectedRule, "verified_volunteer_match");
  assert.match(decision.machineRationale.traces[1]?.detail ?? "", /preference signals/i);
});

test("volunteer preference changes propagate without stale routing decisions", () => {
  const baseline: RoutingDecisionInput = {
    requesterDid: "did:plc:req-pref-2",
    postAuthorDid: "did:plc:author-pref-2",
    postUri: "at://did:plc:author-pref-2/com.mutualaid.hub.aidPost/pref-2",
    postCategory: "food",
    requestAvailabilityTag: "weekend_mornings",
    requiredVolunteerSkills: ["meal prep"],
    postAuthorReachable: false,
    volunteerCandidates: [
      {
        did: "did:plc:vol-a",
        verified: true,
        acceptsChats: true,
        supportedCategories: ["food"],
        preferredAidCategories: ["food"],
        availabilityTags: ["weekend_mornings"],
        skills: ["meal prep"],
        preferenceBoost: 3,
        distanceMeters: 1000,
      },
      {
        did: "did:plc:vol-b",
        verified: true,
        acceptsChats: true,
        supportedCategories: ["food"],
        preferredAidCategories: ["food"],
        availabilityTags: ["weekend_mornings"],
        skills: ["meal prep"],
        preferenceBoost: 1,
        distanceMeters: 200,
      },
    ],
  };

  const initial = decideChatRoute(baseline);
  assert.equal(initial.destinationId, "did:plc:vol-a");

  const updated = decideChatRoute({
    ...baseline,
    volunteerCandidates: [
      {
        ...(baseline.volunteerCandidates?.[0] ?? {
          did: "did:plc:vol-a",
          verified: true,
          acceptsChats: true,
          supportedCategories: ["food"] as const,
        }),
        preferenceBoost: 0,
      },
      {
        ...(baseline.volunteerCandidates?.[1] ?? {
          did: "did:plc:vol-b",
          verified: true,
          acceptsChats: true,
          supportedCategories: ["food"] as const,
        }),
        preferenceBoost: 5,
      },
    ],
  });

  assert.equal(updated.destinationType, "volunteer_pool");
  assert.equal(updated.destinationId, "did:plc:vol-b");
  assert.notEqual(initial.destinationId, updated.destinationId);
});
