import type { DirectoryResourceType } from "@mutual-hub/shared";

import type {
  AidSearchFilters,
  DirectorySearchFilters,
  IndexedDirectoryResource,
  QueryIndexStore,
} from "../indexing/query-store.js";
import type { RankedAid } from "../ranking/rank-aid.js";

export interface AidDiscoveryFilters
  extends Pick<
    AidSearchFilters,
    "center" | "radiusMeters" | "category" | "status" | "minUrgency" | "text" | "since"
  > {
  limit?: number;
  trustScoreByDid?: Record<string, number>;
  now?: number;
}

export interface DirectoryDiscoveryFilters
  extends Pick<DirectorySearchFilters, "center" | "radiusMeters" | "text"> {
  type?: DirectoryResourceType;
  limit?: number;
}

export interface AidCard extends RankedAid {
  distanceMeters?: number;
}

export interface MapSearchResult {
  cards: AidCard[];
}

export interface FeedSearchResult {
  cards: AidCard[];
}

export interface DirectorySearchCard extends IndexedDirectoryResource {
  distanceMeters?: number;
}

export interface DirectorySearchResult {
  resources: DirectorySearchCard[];
}

function withAidDistance(
  aids: readonly RankedAid[],
  distanceById: Record<string, number>,
): AidCard[] {
  return aids.map((aid) => ({
    ...aid,
    distanceMeters: distanceById[aid.id],
  }));
}

function withDirectoryDistance(
  resources: readonly IndexedDirectoryResource[],
  distanceByUri: Record<string, number>,
): DirectorySearchCard[] {
  return resources.map((resource) => ({
    ...resource,
    distanceMeters: distanceByUri[resource.uri],
  }));
}

export function searchMapCards(
  store: QueryIndexStore,
  filters: AidDiscoveryFilters = {},
): MapSearchResult {
  const result = store.searchAidPosts({
    ...filters,
    limit: filters.limit ?? 200,
  });

  return {
    cards: withAidDistance(result.items, result.distanceMetersByPostId),
  };
}

export function searchFeedCards(
  store: QueryIndexStore,
  filters: AidDiscoveryFilters = {},
): FeedSearchResult {
  const result = store.searchAidPosts({
    ...filters,
    limit: filters.limit ?? 50,
  });

  return {
    cards: withAidDistance(result.items, result.distanceMetersByPostId),
  };
}

export function searchDirectoryResources(
  store: QueryIndexStore,
  filters: DirectoryDiscoveryFilters = {},
): DirectorySearchResult {
  const result = store.searchDirectoryResources({
    ...filters,
    limit: filters.limit ?? 100,
  });

  return {
    resources: withDirectoryDistance(result.items, result.distanceMetersByUri),
  };
}
