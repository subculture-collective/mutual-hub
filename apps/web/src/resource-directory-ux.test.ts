import assert from "node:assert/strict";
import test from "node:test";

import { defaultDiscoveryFilterState } from "./discovery-filters.js";
import {
  type ResourceDirectoryCard,
  buildResourceOverlayViewModel,
  openResourceDetailPanel,
  resolveResourceDirectoryUiState,
} from "./resource-directory-ux.js";

function buildResource(overrides: Partial<ResourceDirectoryCard> = {}): ResourceDirectoryCard {
  return {
    uri: "at://did:plc:org/com.mutualaid.hub.resourceDirectory/resource-1",
    id: "resource-1",
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
    ...overrides,
  };
}

test("resource overlay model updates by shared filters and type selection", () => {
  const cards: ResourceDirectoryCard[] = [
    buildResource({
      uri: "at://did:plc:a/com.mutualaid.hub.resourceDirectory/clinic-1",
      id: "clinic-1",
      name: "Central Clinic",
      type: "clinic",
      location: {
        lat: 1.3002,
        lng: 103.8002,
        precisionMeters: 120,
        areaLabel: "Central",
      },
    }),
    buildResource({
      uri: "at://did:plc:b/com.mutualaid.hub.resourceDirectory/food-1",
      id: "food-1",
      name: "Sunrise Food Bank",
      type: "food_bank",
      openHours: "Daily meal packs",
      eligibilityNotes: "Families prioritized",
      location: {
        lat: 1.3003,
        lng: 103.8003,
        precisionMeters: 150,
        areaLabel: "Central",
      },
    }),
    buildResource({
      uri: "at://did:plc:c/com.mutualaid.hub.resourceDirectory/shelter-1",
      id: "shelter-1",
      name: "Harbor Shelter",
      type: "shelter",
      location: {
        lat: 1.39,
        lng: 103.89,
        precisionMeters: 300,
        areaLabel: "Harbor",
      },
    }),
  ];

  const view = buildResourceOverlayViewModel(
    cards,
    {
      ...defaultDiscoveryFilterState,
      category: "food",
      text: "meal",
      center: { lat: 1.3, lng: 103.8 },
      radiusMeters: 5000,
    },
    {
      type: "food_bank",
    },
  );

  assert.equal(view.cards.length, 1);
  assert.equal(view.cards[0]?.id, "food-1");
  assert.equal(view.overlays.length, 1);
  assert.equal(view.overlays[0]?.radiusMeters, 300);
  assert.equal(view.query.category, "food");
});

test("resource detail panel exposes hours and eligibility content clearly", () => {
  const cards: ResourceDirectoryCard[] = [
    buildResource({
      uri: "at://did:plc:org/com.mutualaid.hub.resourceDirectory/clinic-2",
      id: "clinic-2",
      name: "Northside Clinic",
      openHours: "Mon-Fri 18:00-22:00",
      eligibilityNotes: "Urgent care for walk-ins",
    }),
  ];

  const detail = openResourceDetailPanel(cards, cards[0].uri);
  assert.equal(detail.open, true);
  assert.equal(detail.title, "Northside Clinic");
  assert.equal(detail.openHours, "Mon-Fri 18:00-22:00");
  assert.equal(detail.eligibilityNotes, "Urgent care for walk-ins");
  assert.equal(
    detail.actions.some((action) => action.id === "request_intake"),
    true,
  );
});

test("resource directory ui states handle loading, error, empty, and ready accessibly", () => {
  const loading = resolveResourceDirectoryUiState({
    loading: true,
    resources: [],
  });
  assert.equal(loading.status, "loading");
  assert.match(loading.ariaLiveMessage, /loading/i);

  const error = resolveResourceDirectoryUiState({
    loading: false,
    errorMessage: "Request timed out",
    resources: [],
  });
  assert.equal(error.status, "error");
  assert.match(error.ariaLiveMessage, /failed to load/i);

  const empty = resolveResourceDirectoryUiState({
    loading: false,
    resources: [],
    activeTypeFilter: "clinic",
  });
  assert.equal(empty.status, "empty");
  assert.match(empty.message, /No resources found/i);

  const ready = resolveResourceDirectoryUiState({
    loading: false,
    resources: [buildResource()],
  });
  assert.equal(ready.status, "ready");
  assert.match(ready.ariaLiveMessage, /1 directory resources loaded/i);
});
