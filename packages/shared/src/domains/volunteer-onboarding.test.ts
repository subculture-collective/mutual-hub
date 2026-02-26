import assert from "node:assert/strict";
import test from "node:test";

import {
  applyVolunteerProfileToRoutingCandidate,
  normalizeVolunteerProfile,
} from "./volunteer-onboarding.js";

test("normalizeVolunteerProfile deduplicates skills, availability, and categories", () => {
  const normalized = normalizeVolunteerProfile({
    did: "did:plc:volunteer-1",
    displayName: "  Ari  ",
    skills: ["First Aid", " first aid ", "Meal Delivery"],
    availability: ["weekday_evenings", "weekday_evenings", " weekends "],
    verified: false,
    preferredAidCategories: ["medical", "medical", "food"],
  });

  assert.equal(normalized.displayName, "Ari");
  assert.deepEqual(normalized.skills, ["First Aid", "Meal Delivery"]);
  assert.deepEqual(normalized.availability, ["weekday_evenings", "weekends"]);
  assert.deepEqual(normalized.preferredAidCategories, ["medical", "food"]);
});

test("applyVolunteerProfileToRoutingCandidate maps onboarding preferences into routing input", () => {
  const candidate = applyVolunteerProfileToRoutingCandidate(
    {
      did: "did:plc:volunteer-2",
      displayName: "Ren",
      skills: ["triage", "translation"],
      availability: ["weekend_mornings"],
      verified: true,
      preferredAidCategories: ["medical"],
    },
    {
      did: "did:plc:volunteer-2",
      acceptsChats: true,
      supportedCategories: ["medical", "food"],
      preferenceBoost: 2,
      distanceMeters: 600,
    },
  );

  assert.equal(candidate.verified, true);
  assert.deepEqual(candidate.preferredAidCategories, ["medical"]);
  assert.deepEqual(candidate.skills, ["triage", "translation"]);
  assert.deepEqual(candidate.availabilityTags, ["weekend_mornings"]);
  assert.equal(candidate.preferenceBoost, 2);
  assert.equal(candidate.distanceMeters, 600);
});
