import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAidPostCreatePayload,
  buildAidPostEditPayload,
  toPostingDraftFromRecord,
  validatePostingDraft,
} from "./posting-form.js";

test("posting form creates schema-compatible payload with geoprivacy enforcement", () => {
  const payload = buildAidPostCreatePayload(
    {
      title: "Need water and groceries",
      description: "Family of four needs support tonight",
      category: "food",
      urgency: 4,
      accessibilityTags: ["wheelchair", " wheelchair "],
      location: {
        lat: 1.30019,
        lng: 103.80071,
        precisionMeters: 120,
      },
      timeWindow: {
        startAt: "2026-02-26T09:00:00.000Z",
        endAt: "2026-02-26T18:00:00.000Z",
      },
    },
    {
      now: "2026-02-26T08:00:00.000Z",
      idGenerator: () => "post-create-1",
    },
  );

  assert.equal(payload.record.id, "post-create-1");
  assert.equal(payload.record.status, "open");
  assert.equal(payload.record.location?.precisionMeters, 300);
  assert.deepEqual(payload.record.accessibilityTags, ["wheelchair"]);
  assert.equal(payload.metadata.timeWindow.startAt, "2026-02-26T09:00:00.000Z");
});

test("posting form validation catches invalid taxonomy and time window", () => {
  const result = validatePostingDraft({
    title: "",
    description: "",
    category: undefined,
    urgency: undefined,
    accessibilityTags: [""],
    timeWindow: {
      startAt: "2026-02-26T18:00:00.000Z",
      endAt: "2026-02-26T09:00:00.000Z",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.errors.some((error) => error.field === "title"),
    true,
  );
  assert.equal(
    result.errors.some((error) => error.field === "category"),
    true,
  );
  assert.equal(
    result.errors.some((error) => error.field === "timeWindow"),
    true,
  );
});

test("posting form edit mode reuses existing record identity and timestamps", () => {
  const existingCreatePayload = buildAidPostCreatePayload(
    {
      title: "Need transit support",
      description: "Need ride to clinic",
      category: "transport",
      urgency: 3,
      accessibilityTags: ["mobility-aid"],
      timeWindow: {
        startAt: "2026-02-26T10:00:00.000Z",
        endAt: "2026-02-26T14:00:00.000Z",
      },
    },
    {
      now: "2026-02-26T09:00:00.000Z",
      idGenerator: () => "post-edit-1",
    },
  );

  const draft = toPostingDraftFromRecord(existingCreatePayload.record, {
    timeWindow: existingCreatePayload.metadata.timeWindow,
  });

  const editPayload = buildAidPostEditPayload(
    existingCreatePayload.record,
    {
      ...draft,
      title: "Need urgent transit support",
      urgency: 4,
      timeWindow: {
        startAt: "2026-02-26T11:00:00.000Z",
        endAt: "2026-02-26T16:00:00.000Z",
      },
    },
    {
      updatedAt: "2026-02-26T10:30:00.000Z",
    },
  );

  assert.equal(editPayload.record.id, existingCreatePayload.record.id);
  assert.equal(editPayload.record.createdAt, existingCreatePayload.record.createdAt);
  assert.equal(editPayload.record.updatedAt, "2026-02-26T10:30:00.000Z");
  assert.equal(editPayload.record.title, "Need urgent transit support");
  assert.equal(editPayload.record.urgency, 4);
  assert.equal(editPayload.metadata.timeWindow.endAt, "2026-02-26T16:00:00.000Z");
});
