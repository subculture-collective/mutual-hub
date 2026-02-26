import assert from "node:assert/strict";
import test from "node:test";

import {
  initiateChatFromFeedCard,
  initiateChatFromMapCard,
  initiateChatFromPostDetail,
} from "./chat-initiation.js";
import { createFeedCard } from "./feed-ux.js";
import type { MapAidCard } from "./map-ux.js";

function buildMapCard(overrides: Partial<MapAidCard> = {}): MapAidCard {
  return {
    id: "map-card-1",
    title: "Need medicine pickup",
    description: "Need someone to collect medicine",
    category: "medical",
    urgency: 4,
    status: "open",
    createdAt: "2026-02-25T00:00:00.000Z",
    updatedAt: "2026-02-25T00:00:00.000Z",
    accessibilityTags: [],
    uri: "at://did:plc:author-map/com.mutualaid.hub.aidPost/map-card-1",
    authorDid: "did:plc:author-map",
    location: {
      lat: 1.3,
      lng: 103.8,
      precisionMeters: 300,
      areaLabel: "Central",
    },
    ...overrides,
  };
}

test("chat initiation from map detail attaches post context", () => {
  const card = buildMapCard();
  const result = initiateChatFromMapCard(card, "did:plc:requester-map");

  assert.equal(result.source, "map_detail");
  assert.equal(result.outcome.ok, true);
  assert.equal(result.viewState.tone, "success");

  if (!result.outcome.ok) {
    return;
  }

  assert.equal(result.outcome.conversation.postUri, card.uri);
  assert.equal(result.outcome.conversation.requestContext?.source, "map_detail");
  assert.equal(result.outcome.conversation.requestContext?.areaLabel, "Central");
});

test("chat initiation from feed card opens conversation and keeps context metadata", () => {
  const card = createFeedCard({
    id: "feed-card-1",
    title: "Need groceries delivery",
    description: "Need groceries for two days",
    category: "food",
    urgency: 5,
    createdAt: "2026-02-25T00:00:00.000Z",
    uri: "at://did:plc:author-feed/com.mutualaid.hub.aidPost/feed-card-1",
    authorDid: "did:plc:author-feed",
    location: {
      lat: 1.31,
      lng: 103.81,
      precisionMeters: 300,
      areaLabel: "North",
    },
  });

  const result = initiateChatFromFeedCard(card, "did:plc:requester-feed");

  assert.equal(result.source, "feed_card");
  assert.equal(result.outcome.ok, true);

  if (!result.outcome.ok) {
    return;
  }

  assert.equal(result.outcome.conversation.requestContext?.source, "feed_card");
  assert.equal(result.outcome.conversation.requestContext?.urgency, 5);
});

test("chat initiation surfaces clear error messaging for invalid permission state", () => {
  const result = initiateChatFromPostDetail(
    {
      uri: "at://did:plc:author-post/com.mutualaid.hub.aidPost/post-1",
      authorDid: "did:plc:author-post",
      title: "Need shelter tonight",
      category: "shelter",
      urgency: 5,
    },
    "did:plc:requester-post",
    {
      recipientAcceptsChats: false,
    },
  );

  assert.equal(result.outcome.ok, false);
  assert.equal(result.viewState.tone, "error");
  assert.match(result.viewState.message, /not accepting chats/i);
});
