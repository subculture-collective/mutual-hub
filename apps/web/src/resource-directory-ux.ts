import {
  type AidCategory,
  type DirectoryResource,
  type DirectoryResourceType,
  enforceMinimumPublicPrecision,
} from "@mutual-hub/shared";

import {
  type DiscoveryFilterState,
  type SharedAidDiscoveryQuery,
  toMapDiscoveryQuery,
} from "./discovery-filters.js";

const earthRadiusMeters = 6_371_000;

export interface ResourceDirectoryCard extends DirectoryResource {
  uri: string;
  distanceMeters?: number;
}

export interface ResourceOverlayMarker {
  uri: string;
  id: string;
  type: DirectoryResourceType;
  lat: number;
  lng: number;
  radiusMeters: number;
  label: string;
}

export interface ResourceOverlayFilters {
  type?: DirectoryResourceType;
}

export interface ResourceOverlayViewModel {
  query: SharedAidDiscoveryQuery;
  cards: readonly ResourceDirectoryCard[];
  overlays: readonly ResourceOverlayMarker[];
  activeTypeFilter?: DirectoryResourceType;
}

export interface ResourceDetailAction {
  id: "request_intake" | "view_contact" | "open_map";
  label: string;
  ariaLabel: string;
}

export interface ResourceDetailPanelModel {
  open: boolean;
  selectedUri?: string;
  title?: string;
  typeLabel?: string;
  openHours?: string;
  eligibilityNotes?: string;
  actions: readonly ResourceDetailAction[];
}

export type ResourceDirectoryUiState =
  | {
      status: "loading";
      message: string;
      ariaLiveMessage: string;
    }
  | {
      status: "error";
      message: string;
      ariaLiveMessage: string;
    }
  | {
      status: "empty";
      message: string;
      ariaLiveMessage: string;
    }
  | {
      status: "ready";
      message: string;
      ariaLiveMessage: string;
    };

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

function categoryToDirectoryTypes(category: AidCategory | undefined): DirectoryResourceType[] {
  if (!category) {
    return [];
  }

  switch (category) {
    case "food":
      return ["food_bank"];
    case "shelter":
      return ["shelter"];
    case "medical":
      return ["clinic"];
    default:
      return [];
  }
}

function resourceMatchesText(resource: ResourceDirectoryCard, text: string): boolean {
  const haystack = [
    resource.name,
    resource.openHours ?? "",
    resource.eligibilityNotes ?? "",
    resource.location.areaLabel ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(text.toLowerCase());
}

function toOverlayMarker(resource: ResourceDirectoryCard): ResourceOverlayMarker {
  const location = enforceMinimumPublicPrecision(resource.location, 300);

  return {
    uri: resource.uri,
    id: resource.id,
    type: resource.type,
    lat: Number(location.lat.toFixed(6)),
    lng: Number(location.lng.toFixed(6)),
    radiusMeters: location.precisionMeters,
    label: resource.location.areaLabel ?? resource.name,
  };
}

function toTypeLabel(type: DirectoryResourceType): string {
  switch (type) {
    case "shelter":
      return "Shelter";
    case "clinic":
      return "Clinic";
    case "food_bank":
      return "Food bank";
    case "support_service":
      return "Support service";
  }
}

export function filterResourceDirectoryCards(
  cards: readonly ResourceDirectoryCard[],
  state: DiscoveryFilterState,
  filters: ResourceOverlayFilters = {},
): ResourceDirectoryCard[] {
  const query = toMapDiscoveryQuery(state);
  const categoryTypes = categoryToDirectoryTypes(state.category);

  return cards
    .filter((card) => {
      if (filters.type && card.type !== filters.type) {
        return false;
      }

      if (categoryTypes.length > 0 && !categoryTypes.includes(card.type)) {
        return false;
      }

      if (query.text && !resourceMatchesText(card, query.text)) {
        return false;
      }

      if (query.center && query.radiusMeters !== undefined) {
        const distance = haversineDistanceMeters(query.center, card.location);
        if (distance > query.radiusMeters) {
          return false;
        }
      }

      return true;
    })
    .sort((left, right) => {
      if (
        left.distanceMeters !== undefined &&
        right.distanceMeters !== undefined &&
        left.distanceMeters !== right.distanceMeters
      ) {
        return left.distanceMeters - right.distanceMeters;
      }

      return left.name.localeCompare(right.name);
    });
}

export function buildResourceOverlayViewModel(
  cards: readonly ResourceDirectoryCard[],
  state: DiscoveryFilterState,
  filters: ResourceOverlayFilters = {},
): ResourceOverlayViewModel {
  const query = toMapDiscoveryQuery(state);
  const filteredCards = filterResourceDirectoryCards(cards, state, filters);

  return {
    query,
    cards: filteredCards,
    overlays: filteredCards.map((card) => toOverlayMarker(card)),
    activeTypeFilter: filters.type,
  };
}

export function openResourceDetailPanel(
  cards: readonly ResourceDirectoryCard[],
  selectedUri: string,
): ResourceDetailPanelModel {
  const selected = cards.find((card) => card.uri === selectedUri);
  if (!selected) {
    return {
      open: false,
      actions: [],
    };
  }

  return {
    open: true,
    selectedUri,
    title: selected.name,
    typeLabel: toTypeLabel(selected.type),
    openHours: selected.openHours ?? "Hours unavailable",
    eligibilityNotes: selected.eligibilityNotes ?? "Eligibility details unavailable",
    actions: [
      {
        id: "request_intake",
        label: "Request intake",
        ariaLabel: `Request intake from ${selected.name}`,
      },
      {
        id: "view_contact",
        label: "View contact info",
        ariaLabel: `View contact info for ${selected.name}`,
      },
      {
        id: "open_map",
        label: "Open map directions",
        ariaLabel: `Open map directions to ${selected.name}`,
      },
    ],
  };
}

export function closeResourceDetailPanel(): ResourceDetailPanelModel {
  return {
    open: false,
    actions: [],
  };
}

export function resolveResourceDirectoryUiState(params: {
  loading: boolean;
  errorMessage?: string;
  resources: readonly ResourceDirectoryCard[];
  activeTypeFilter?: DirectoryResourceType;
}): ResourceDirectoryUiState {
  if (params.loading) {
    return {
      status: "loading",
      message: "Loading directory resources…",
      ariaLiveMessage: "Loading resource directory results.",
    };
  }

  if (params.errorMessage) {
    return {
      status: "error",
      message: params.errorMessage,
      ariaLiveMessage: "Resource directory failed to load. Please retry or adjust filters.",
    };
  }

  if (params.resources.length === 0) {
    const emptyReason = params.activeTypeFilter
      ? ` for ${toTypeLabel(params.activeTypeFilter)}`
      : "";

    return {
      status: "empty",
      message: `No resources found${emptyReason}.`,
      ariaLiveMessage: `No resources match current filters${emptyReason}.`,
    };
  }

  return {
    status: "ready",
    message: `${params.resources.length} resources available.`,
    ariaLiveMessage: `${params.resources.length} directory resources loaded.`,
  };
}
