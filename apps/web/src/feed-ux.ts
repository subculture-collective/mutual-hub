import type { AidCategory, AidPostSummary, AidStatus, Did } from "@mutual-hub/shared";

import {
  type DiscoveryFilterState,
  type FeedTab,
  type SharedAidDiscoveryQuery,
  toFeedDiscoveryQuery,
} from "./discovery-filters.js";

const earthRadiusMeters = 6_371_000;

export interface FeedAidCard extends AidPostSummary {
  distanceMeters?: number;
}

export interface FeedBadge {
  label: string;
  tone: "neutral" | "info" | "warn" | "critical" | "success";
}

export interface FeedCardPresentation {
  id: string;
  urgencyBadge: FeedBadge;
  statusBadge: FeedBadge;
  canEdit: boolean;
  canClose: boolean;
}

export interface FeedTabResult {
  tab: FeedTab;
  query: SharedAidDiscoveryQuery;
  cards: readonly FeedAidCard[];
}

export interface FeedViewModel {
  activeTab: FeedTab;
  activeQuery: SharedAidDiscoveryQuery;
  latest: FeedTabResult;
  nearby: FeedTabResult;
}

export type FeedLifecycleAction =
  | { type: "create"; card: FeedAidCard }
  | {
      type: "edit";
      id: string;
      patch: Partial<
        Pick<
          FeedAidCard,
          | "title"
          | "description"
          | "category"
          | "urgency"
          | "status"
          | "location"
          | "accessibilityTags"
        >
      >;
      updatedAt?: string;
    }
  | { type: "close"; id: string; closedAt?: string };

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineDistanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const latDelta = toRadians(to.lat - from.lat);
  const lngDelta = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);

  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) * Math.sin(lngDelta / 2);

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function cardMatchesText(card: FeedAidCard, text: string): boolean {
  const haystack = [
    card.title,
    card.description,
    card.accessibilityTags.join(" "),
    card.location?.areaLabel ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(text.toLowerCase());
}

function compareByUpdatedAtDesc(left: FeedAidCard, right: FeedAidCard): number {
  const leftMs = Date.parse(left.updatedAt);
  const rightMs = Date.parse(right.updatedAt);
  const safeLeft = Number.isNaN(leftMs) ? 0 : leftMs;
  const safeRight = Number.isNaN(rightMs) ? 0 : rightMs;

  if (safeLeft !== safeRight) {
    return safeRight - safeLeft;
  }

  return right.urgency - left.urgency;
}

function sortNearby(cards: readonly FeedAidCard[]): FeedAidCard[] {
  return [...cards].sort((left, right) => {
    const leftDistance = left.distanceMeters ?? Number.POSITIVE_INFINITY;
    const rightDistance = right.distanceMeters ?? Number.POSITIVE_INFINITY;

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    return compareByUpdatedAtDesc(left, right);
  });
}

function sortLatest(cards: readonly FeedAidCard[]): FeedAidCard[] {
  return [...cards].sort(compareByUpdatedAtDesc);
}

function applySharedFeedFilters(
  cards: readonly FeedAidCard[],
  query: SharedAidDiscoveryQuery,
): FeedAidCard[] {
  return cards.filter((card) => {
    if (query.category && card.category !== query.category) {
      return false;
    }

    if (query.status && card.status !== query.status) {
      return false;
    }

    if (query.minUrgency !== undefined && card.urgency < query.minUrgency) {
      return false;
    }

    if (query.text && !cardMatchesText(card, query.text)) {
      return false;
    }

    if (query.since) {
      const sinceMs = Date.parse(query.since);
      const updatedAtMs = Date.parse(card.updatedAt);
      if (!Number.isNaN(sinceMs) && (Number.isNaN(updatedAtMs) || updatedAtMs < sinceMs)) {
        return false;
      }
    }

    if (query.center && query.radiusMeters !== undefined) {
      if (!card.location) {
        return false;
      }

      const distance = haversineDistanceMeters(query.center, card.location);
      if (distance > query.radiusMeters) {
        return false;
      }
    }

    return true;
  });
}

export function toUrgencyBadge(urgency: number): FeedBadge {
  if (urgency >= 5) {
    return { label: "Urgency 5", tone: "critical" };
  }

  if (urgency >= 4) {
    return { label: `Urgency ${urgency}`, tone: "warn" };
  }

  if (urgency >= 2) {
    return { label: `Urgency ${urgency}`, tone: "info" };
  }

  return { label: "Urgency 1", tone: "neutral" };
}

export function toStatusBadge(status: AidStatus): FeedBadge {
  if (status === "open") {
    return { label: "Open", tone: "success" };
  }

  if (status === "in_progress") {
    return { label: "In Progress", tone: "warn" };
  }

  return { label: "Closed", tone: "neutral" };
}

export function toFeedCardPresentation(card: FeedAidCard): FeedCardPresentation {
  return {
    id: card.id,
    urgencyBadge: toUrgencyBadge(card.urgency),
    statusBadge: toStatusBadge(card.status),
    canEdit: card.status !== "closed",
    canClose: card.status !== "closed",
  };
}

export function applyFeedLifecycleAction(
  cards: readonly FeedAidCard[],
  action: FeedLifecycleAction,
): FeedAidCard[] {
  if (action.type === "create") {
    return sortLatest([...cards, action.card]);
  }

  if (action.type === "edit") {
    const nextUpdatedAt = action.updatedAt ?? new Date().toISOString();
    const edited = cards.map((card) =>
      card.id === action.id
        ? {
            ...card,
            ...action.patch,
            updatedAt: nextUpdatedAt,
          }
        : card,
    );
    return sortLatest(edited);
  }

  const closedAt = action.closedAt ?? new Date().toISOString();
  const closed = cards.map((card) =>
    card.id === action.id
      ? {
          ...card,
          status: "closed" as const,
          updatedAt: closedAt,
        }
      : card,
  );
  return sortLatest(closed);
}

export function buildFeedTabResult(
  cards: readonly FeedAidCard[],
  state: DiscoveryFilterState,
  tab: FeedTab,
): FeedTabResult {
  const query = toFeedDiscoveryQuery({
    ...state,
    feedTab: tab,
  });
  const filtered = applySharedFeedFilters(cards, query);

  return {
    tab,
    query,
    cards: tab === "nearby" ? sortNearby(filtered) : sortLatest(filtered),
  };
}

export function buildFeedViewModel(
  cards: readonly FeedAidCard[],
  state: DiscoveryFilterState,
): FeedViewModel {
  const latest = buildFeedTabResult(cards, state, "latest");
  const nearby = buildFeedTabResult(cards, state, "nearby");

  return {
    activeTab: state.feedTab,
    activeQuery: state.feedTab === "nearby" ? nearby.query : latest.query,
    latest,
    nearby,
  };
}

export function createFeedCard(params: {
  id: string;
  title: string;
  description: string;
  category: AidCategory;
  urgency: 1 | 2 | 3 | 4 | 5;
  status?: AidStatus;
  accessibilityTags?: string[];
  location?: FeedAidCard["location"];
  createdAt: string;
  updatedAt?: string;
  uri: string;
  authorDid: Did;
  distanceMeters?: number;
}): FeedAidCard {
  return {
    id: params.id,
    title: params.title,
    description: params.description,
    category: params.category,
    urgency: params.urgency,
    status: params.status ?? "open",
    createdAt: params.createdAt,
    updatedAt: params.updatedAt ?? params.createdAt,
    location: params.location,
    accessibilityTags: params.accessibilityTags ?? [],
    uri: params.uri,
    authorDid: params.authorDid,
    distanceMeters: params.distanceMeters,
  };
}
