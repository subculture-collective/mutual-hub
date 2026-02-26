import assert from "node:assert/strict";
import test from "node:test";

import { atLexiconCollections } from "@mutual-hub/at-lexicons";

import { normalizeFirehoseEvent } from "../firehose/consumer.js";
import { QueryIndexStore } from "../indexing/query-store.js";
import { searchDirectoryResources, searchFeedCards } from "./search.js";

const now = "2026-02-25T08:00:00.000Z";

function aidRecord(id: string, title: string, createdAt = now) {
  return {
    id,
    title,
    description: `${title} details`,
    category: "food" as const,
    urgency: 5 as const,
    status: "open" as const,
    createdAt,
    updatedAt: createdAt,
    accessibilityTags: [],
  };
}

test("feed ranking considers distance and trust signals", () => {
  const store = new QueryIndexStore(300);

  store.applyFirehoseEvent(
    normalizeFirehoseEvent({
      op: "create",
      uri: `at://did:plc:near/${atLexiconCollections.aidPost}/near-1`,
      record: {
        ...aidRecord("near-1", "Near request"),
        location: { lat: 1.3001, lng: 103.8001, precisionMeters: 150 },
      },
    }),
  );

  store.applyFirehoseEvent(
    normalizeFirehoseEvent({
      op: "create",
      uri: `at://did:plc:far/${atLexiconCollections.aidPost}/far-1`,
      record: {
        ...aidRecord("far-1", "Far request"),
        location: { lat: 1.36, lng: 103.86, precisionMeters: 150 },
      },
    }),
  );

  const withoutTrustBias = searchFeedCards(store, {
    center: { lat: 1.3, lng: 103.8 },
    now: Date.parse(now),
  });

  const withTrustBias = searchFeedCards(store, {
    center: { lat: 1.3, lng: 103.8 },
    now: Date.parse(now),
    trustScoreByDid: {
      "did:plc:near": 0.1,
      "did:plc:far": 1,
    },
  });

  assert.equal(withoutTrustBias.cards[0]?.id, "near-1");
  assert.equal(withTrustBias.cards[0]?.id, "far-1");
});

test("feed ranking favors fresher posts when other signals are comparable", () => {
  const store = new QueryIndexStore(300);

  store.applyFirehoseEvent(
    normalizeFirehoseEvent({
      op: "create",
      uri: `at://did:plc:author/${atLexiconCollections.aidPost}/fresh-1`,
      record: {
        ...aidRecord("fresh-1", "Fresh request", "2026-02-25T08:00:00.000Z"),
        location: { lat: 1.3001, lng: 103.8001, precisionMeters: 150 },
      },
    }),
  );

  store.applyFirehoseEvent(
    normalizeFirehoseEvent({
      op: "create",
      uri: `at://did:plc:author/${atLexiconCollections.aidPost}/stale-1`,
      record: {
        ...aidRecord("stale-1", "Stale request", "2026-02-23T08:00:00.000Z"),
        location: { lat: 1.3002, lng: 103.8002, precisionMeters: 150 },
      },
    }),
  );

  const feed = searchFeedCards(store, {
    center: { lat: 1.3, lng: 103.8 },
    now: Date.parse("2026-02-25T08:10:00.000Z"),
  });

  assert.equal(feed.cards[0]?.id, "fresh-1");
});

test("directory search supports overlay-relevant filters and metadata text", () => {
  const store = new QueryIndexStore(300);

  store.applyFirehoseEvent(
    normalizeFirehoseEvent({
      op: "create",
      uri: `at://did:plc:org1/${atLexiconCollections.resourceDirectory}/clinic-1`,
      record: {
        id: "clinic-1",
        name: "Neighborhood Clinic",
        type: "clinic",
        location: {
          lat: 1.3001,
          lng: 103.8001,
          precisionMeters: 200,
          areaLabel: "Central",
        },
        openHours: "Walk-in evenings",
        eligibilityNotes: "No insurance required",
        createdAt: now,
        updatedAt: now,
      },
    }),
  );

  store.applyFirehoseEvent(
    normalizeFirehoseEvent({
      op: "create",
      uri: `at://did:plc:org2/${atLexiconCollections.resourceDirectory}/shelter-1`,
      record: {
        id: "shelter-1",
        name: "Harbor Shelter",
        type: "shelter",
        location: {
          lat: 1.36,
          lng: 103.86,
          precisionMeters: 300,
          areaLabel: "Harbor",
        },
        openHours: "24/7",
        eligibilityNotes: "Families prioritized",
        createdAt: now,
        updatedAt: now,
      },
    }),
  );

  const filtered = searchDirectoryResources(store, {
    center: { lat: 1.3, lng: 103.8 },
    radiusMeters: 5000,
    type: "clinic",
    text: "walk-in",
  });

  assert.deepEqual(
    filtered.resources.map((resource) => resource.id),
    ["clinic-1"],
  );
  assert.equal(filtered.resources[0]?.distanceMeters !== undefined, true);
});
