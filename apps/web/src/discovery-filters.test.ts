import assert from "node:assert/strict";
import test from "node:test";

import {
  type DiscoveryFilterState,
  applyDiscoveryFilterPatch,
  defaultDiscoveryFilterState,
  parseDiscoveryFilterState,
  serializeDiscoveryFilterState,
  toFeedDiscoveryQuery,
  toMapDiscoveryQuery,
  toggleCategoryFilter,
  toggleStatusFilter,
} from "./discovery-filters.js";
import { buildDiscoveryFilterChipModel } from "./discovery-primitives.js";

test("filter state serializes and parses with stable round-trip", () => {
  const initial: DiscoveryFilterState = {
    feedTab: "nearby",
    text: "wheelchair ramp",
    category: "medical",
    status: "open",
    minUrgency: 4,
    center: { lat: 1.30019, lng: 103.80071 },
    radiusMeters: 4200,
    since: "2026-02-20T00:00:00.000Z",
  };

  const queryString = serializeDiscoveryFilterState(initial);
  const parsed = parseDiscoveryFilterState(queryString, defaultDiscoveryFilterState);

  assert.equal(queryString.includes("tab=nearby"), true);
  assert.deepEqual(parsed, initial);
});

test("invalid query values are normalized and fallback defaults are preserved", () => {
  const parsed = parseDiscoveryFilterState(
    "?cat=invalid&st=unknown&u=99&r=12&lat=111&lng=103.81&tab=nearby&q=   ",
    defaultDiscoveryFilterState,
  );

  assert.equal(parsed.feedTab, "nearby");
  assert.equal(parsed.status, "open");
  assert.equal(parsed.category, undefined);
  assert.equal(parsed.minUrgency, 5);
  assert.equal(parsed.radiusMeters, 300);
  assert.equal(parsed.center, undefined);
  assert.equal(parsed.text, undefined);
});

test("map and feed query contracts share filters but feed latest omits location", () => {
  const state: DiscoveryFilterState = {
    feedTab: "latest",
    text: "infant formula",
    category: "food",
    status: "open",
    minUrgency: 3,
    center: { lat: 1.31, lng: 103.81 },
    radiusMeters: 7000,
  };

  const mapQuery = toMapDiscoveryQuery(state);
  const latestFeedQuery = toFeedDiscoveryQuery(state);
  const nearbyFeedQuery = toFeedDiscoveryQuery({
    ...state,
    feedTab: "nearby",
  });

  assert.deepEqual(mapQuery.center, { lat: 1.31, lng: 103.81 });
  assert.equal(mapQuery.radiusMeters, 7000);

  assert.equal(latestFeedQuery.center, undefined);
  assert.equal(latestFeedQuery.radiusMeters, undefined);

  assert.deepEqual(nearbyFeedQuery.center, { lat: 1.31, lng: 103.81 });
  assert.equal(nearbyFeedQuery.radiusMeters, 7000);
});

test("state transition helpers toggle category and status predictably", () => {
  const base = defaultDiscoveryFilterState;
  const withCategory = toggleCategoryFilter(base, "food");
  const withStatus = toggleStatusFilter(withCategory, "in_progress");
  const removedCategory = toggleCategoryFilter(withStatus, "food");

  assert.equal(withCategory.category, "food");
  assert.equal(withStatus.status, "in_progress");
  assert.equal(removedCategory.category, undefined);
});

test("shared chip model marks active chips across tabs/category/status/urgency", () => {
  const state: DiscoveryFilterState = applyDiscoveryFilterPatch(defaultDiscoveryFilterState, {
    feedTab: "nearby",
    category: "transport",
    status: "open",
    minUrgency: 4,
  });

  const model = buildDiscoveryFilterChipModel(state);
  const activeTab = model.tabs.find((chip) => chip.active);
  const activeCategory = model.categories.find((chip) => chip.active);
  const activeStatus = model.statuses.find((chip) => chip.active);
  const activeUrgency = model.urgencyLevels.find((chip) => chip.active);

  assert.equal(activeTab?.value, "nearby");
  assert.equal(activeCategory?.value, "transport");
  assert.equal(activeStatus?.value, "open");
  assert.equal(activeUrgency?.value, 4);
});
