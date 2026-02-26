import assert from "node:assert/strict";
import test from "node:test";

import { computeFeedScore, enforceMinimumPublicPrecision } from "./index.js";

test("enforceMinimumPublicPrecision coarsens precise locations", () => {
  const result = enforceMinimumPublicPrecision({ lat: 1, lng: 2, precisionMeters: 50 }, 300);

  assert.equal(result.precisionMeters, 300);
});

test("computeFeedScore favors higher urgency", () => {
  const now = Date.now();
  const high = computeFeedScore(
    { urgency: 5, trustScore: 0.8, distanceBand: "near", createdAt: new Date(now).toISOString() },
    now,
  );
  const low = computeFeedScore(
    { urgency: 1, trustScore: 0.8, distanceBand: "near", createdAt: new Date(now).toISOString() },
    now,
  );

  assert.ok(high > low);
});
