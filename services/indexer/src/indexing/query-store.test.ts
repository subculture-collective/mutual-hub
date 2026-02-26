import assert from "node:assert/strict";
import test from "node:test";

import { atLexiconCollections } from "@mutual-hub/at-lexicons";

import { normalizeFirehoseEvent } from "../firehose/consumer.js";
import { toDirectoryCreateEvents } from "./directory.fixtures.js";
import { QueryIndexStore } from "./query-store.js";

test("directory records ingest deterministically and metadata stays searchable", () => {
  const events = toDirectoryCreateEvents();
  const store = new QueryIndexStore(300);
  const replayStore = new QueryIndexStore(300);

  for (const event of events) {
    store.applyFirehoseEvent(normalizeFirehoseEvent(event));
  }

  for (const event of [...events].reverse()) {
    replayStore.applyFirehoseEvent(normalizeFirehoseEvent(event));
  }

  const walkInHits = store.searchDirectoryResources({
    text: "walk-in evenings",
  });
  assert.deepEqual(
    walkInHits.items.map((resource) => resource.id),
    ["northside-clinic"],
  );

  const eligibilityHits = store.searchDirectoryResources({
    text: "families with children",
  });
  assert.deepEqual(
    eligibilityHits.items.map((resource) => resource.id),
    ["sunrise-food-bank"],
  );

  const firstOrdering = store.searchDirectoryResources().items.map((resource) => resource.uri);
  const replayOrdering = replayStore
    .searchDirectoryResources()
    .items.map((resource) => resource.uri);

  assert.deepEqual(firstOrdering, replayOrdering);
  assert.equal(store.getSnapshot().directoryResourceCount, 3);
});

test("directory create/update/delete lifecycle propagates to search results", () => {
  const [shelter, clinic] = toDirectoryCreateEvents().slice(0, 2);
  const store = new QueryIndexStore(300);

  store.applyFirehoseEvent(normalizeFirehoseEvent(shelter));
  store.applyFirehoseEvent(normalizeFirehoseEvent(clinic));

  const updatedClinicRecord = {
    ...(clinic.record as NonNullable<typeof clinic.record>),
    openHours: "Weekend triage Sat-Sun 08:00-18:00",
    eligibilityNotes: "Walk-in urgent care for seniors and caregivers.",
    updatedAt: "2026-02-26T10:00:00.000Z",
  };

  store.applyFirehoseEvent(
    normalizeFirehoseEvent({
      op: "update",
      uri: clinic.uri,
      record: updatedClinicRecord,
      receivedAt: updatedClinicRecord.updatedAt,
    }),
  );

  assert.equal(store.searchDirectoryResources({ text: "walk-in evenings" }).items.length, 0);
  assert.deepEqual(
    store.searchDirectoryResources({ text: "weekend triage" }).items.map((resource) => resource.id),
    ["northside-clinic"],
  );

  store.applyFirehoseEvent(
    normalizeFirehoseEvent({
      op: "delete",
      uri: shelter.uri,
      receivedAt: "2026-02-26T10:05:00.000Z",
    }),
  );

  const shelterResults = store.searchDirectoryResources({ type: "shelter" });
  assert.equal(shelterResults.items.length, 0);

  const snapshot = store.getSnapshot();
  assert.equal(snapshot.directoryResourceCount, 1);
  assert.equal(snapshot.tombstoneCount, 1);

  const expectedTombstoneUri = `at://did:plc:org-harbor/${atLexiconCollections.resourceDirectory}/harbor-shelter`;
  assert.equal(expectedTombstoneUri, shelter.uri);
});
