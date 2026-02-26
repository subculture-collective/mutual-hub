import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVolunteerProfileCreatePayload,
  buildVolunteerProfileEditPayload,
  isVolunteerFullyVerified,
  toVolunteerOnboardingDraftFromRecord,
  validateVolunteerOnboardingDraft,
} from "./volunteer-onboarding.js";

test("volunteer onboarding create flow persists skills, availability, and checkpoint states", () => {
  const payload = buildVolunteerProfileCreatePayload(
    {
      did: "did:plc:volunteer123",
      displayName: "Ari",
      skills: ["First Aid", " first aid ", "Meal delivery"],
      availability: ["weekday_evenings", "weekend_mornings"],
      preferredAidCategories: ["medical", "food"],
      checkpoints: [
        {
          key: "identity_check",
          status: "approved",
          reviewedAt: "2026-02-26T08:15:00.000Z",
        },
        {
          key: "safety_training",
          status: "approved",
          reviewedAt: "2026-02-26T08:20:00.000Z",
        },
      ],
    },
    {
      now: "2026-02-26T08:30:00.000Z",
    },
  );

  assert.equal(payload.record.did, "did:plc:volunteer123");
  assert.deepEqual(payload.record.skills, ["First Aid", "Meal delivery"]);
  assert.deepEqual(payload.record.availability, ["weekday_evenings", "weekend_mornings"]);
  assert.equal(payload.record.verified, false);
  assert.deepEqual(payload.record.preferredAidCategories, ["medical", "food"]);
  assert.equal(payload.metadata.checkpointSummary.approved, 2);
  assert.equal(payload.metadata.checkpointSummary.pending, 1);
  assert.equal(isVolunteerFullyVerified(payload.metadata.checkpoints), false);
});

test("volunteer onboarding edit flow reuses identity and can transition to fully verified", () => {
  const created = buildVolunteerProfileCreatePayload(
    {
      did: "did:plc:volunteer456",
      displayName: "Ren",
      skills: ["transport coordination"],
      availability: ["weekday_daytime"],
      preferredAidCategories: ["transport"],
      checkpoints: [{ key: "identity_check", status: "approved" }],
    },
    { now: "2026-02-26T09:00:00.000Z" },
  );

  const draft = toVolunteerOnboardingDraftFromRecord(created.record, {
    checkpoints: created.metadata.checkpoints,
  });

  const edited = buildVolunteerProfileEditPayload(
    created.record,
    {
      ...draft,
      displayName: "Ren A.",
      skills: [...draft.skills, "route planning"],
      checkpoints: [
        { key: "identity_check", status: "approved" },
        { key: "safety_training", status: "approved" },
        { key: "community_reference", status: "approved" },
      ],
    },
    { updatedAt: "2026-02-26T10:00:00.000Z" },
  );

  assert.equal(edited.record.did, created.record.did);
  assert.equal(edited.record.createdAt, created.record.createdAt);
  assert.equal(edited.record.updatedAt, "2026-02-26T10:00:00.000Z");
  assert.equal(edited.record.displayName, "Ren A.");
  assert.equal(edited.record.verified, true);
  assert.equal(edited.metadata.checkpointSummary.approved, 3);
  assert.equal(edited.metadata.checkpointSummary.pending, 0);
  assert.equal(edited.metadata.checkpointSummary.rejected, 0);
});

test("volunteer onboarding validation reports incomplete and invalid profile fields", () => {
  const result = validateVolunteerOnboardingDraft({
    did: "invalid-did",
    displayName: "",
    skills: [],
    availability: [],
    preferredAidCategories: [] as never[],
    checkpoints: [
      {
        key: "identity_check",
        status: "approved",
        reviewedAt: "not-a-date",
      },
    ],
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.errors.some((error) => error.field === "did"),
    true,
  );
  assert.equal(
    result.errors.some((error) => error.field === "displayName"),
    true,
  );
  assert.equal(
    result.errors.some((error) => error.field === "skills"),
    true,
  );
  assert.equal(
    result.errors.some((error) => error.field === "availability"),
    true,
  );
  assert.equal(
    result.errors.some((error) => error.field === "preferredAidCategories"),
    true,
  );
  assert.equal(
    result.errors.some((error) => error.field === "checkpoints"),
    true,
  );
});
