import {
    toMapDiscoveryQuery,
    type AidCategory,
    type AidStatus,
    type DiscoveryCenter,
    type DiscoveryFilterState,
    type SharedAidDiscoveryQuery,
} from './discovery-filters.js';
import { haversineDistanceMeters } from './geo-utils.js';

const minimumPublicPrecisionMeters = 300;

export interface MapAidLocation {
    lat: number;
    lng: number;
    precisionMeters: number;
    areaLabel?: string;
}

export interface MapAidCard {
    id: string;
    title: string;
    summary: string;
    category: AidCategory;
    status: AidStatus;
    urgency: 1 | 2 | 3 | 4 | 5;
    updatedAt: string;
    location?: MapAidLocation;
}

export interface ApproximateMapMarker {
    id: string;
    lat: number;
    lng: number;
    radiusMeters: number;
    label: string;
    urgency: MapAidCard['urgency'];
    status: MapAidCard['status'];
}

export interface MapCluster {
    id: string;
    count: number;
    postIds: string[];
    lat: number;
    lng: number;
    radiusMeters: number;
    urgencyMax: 1 | 2 | 3 | 4 | 5;
    status: AidStatus;
    label: string;
}

export type MapTriageAction =
    | 'contact_helper'
    | 'mark_in_progress'
    | 'mark_resolved';

export interface MapDetailDrawerAction {
    action: MapTriageAction;
    label: string;
    ariaLabel: string;
}

export interface MapDetailDrawerModel {
    open: boolean;
    selectedPostId?: string;
    title?: string;
    summary?: string;
    status?: AidStatus;
    primaryCtaLabel?: string;
    primaryCtaAriaLabel?: string;
    actions: MapDetailDrawerAction[];
}

export interface MapViewModel {
    query: SharedAidDiscoveryQuery;
    filteredCards: MapAidCard[];
    markers: ApproximateMapMarker[];
    clusters: MapCluster[];
}

const normalizePrecision = (precisionMeters: number): number => {
    return Math.max(minimumPublicPrecisionMeters, Math.round(precisionMeters));
};

const snapLocation = (
    lat: number,
    lng: number,
    precisionMeters: number,
): { lat: number; lng: number } => {
    const metersPerLatDegree = 111_320;
    const latStep = precisionMeters / metersPerLatDegree;
    const lngStep =
        precisionMeters /
        Math.max(1, metersPerLatDegree * Math.cos((lat * Math.PI) / 180));

    return {
        lat: Number((Math.round(lat / latStep) * latStep).toFixed(6)),
        lng: Number((Math.round(lng / lngStep) * lngStep).toFixed(6)),
    };
};

const cardMatchesText = (card: MapAidCard, text: string): boolean => {
    const haystack = [card.title, card.summary, card.location?.areaLabel]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return haystack.includes(text.toLowerCase());
};

const cardInRadius = (
    card: MapAidCard,
    center: DiscoveryCenter,
    radiusMeters: number,
): boolean => {
    if (!card.location) {
        return false;
    }

    return haversineDistanceMeters(center, card.location) <= radiusMeters;
};

const toClusterStatus = (cards: readonly MapAidCard[]): AidStatus => {
    if (cards.some(card => card.status === 'open')) {
        return 'open';
    }
    if (cards.some(card => card.status === 'in-progress')) {
        return 'in-progress';
    }
    if (cards.some(card => card.status === 'resolved')) {
        return 'resolved';
    }
    return 'closed';
};

export function toApproximateMapMarker(
    card: MapAidCard,
): ApproximateMapMarker | undefined {
    if (!card.location) {
        return undefined;
    }

    const precisionMeters = normalizePrecision(card.location.precisionMeters);
    const snapped = snapLocation(card.location.lat, card.location.lng, precisionMeters);

    return {
        id: card.id,
        lat: snapped.lat,
        lng: snapped.lng,
        radiusMeters: precisionMeters,
        label: card.location.areaLabel ?? card.category,
        urgency: card.urgency,
        status: card.status,
    };
}

export function filterMapCards(
    cards: readonly MapAidCard[],
    state: DiscoveryFilterState,
): MapAidCard[] {
    const query = toMapDiscoveryQuery(state);
    const sinceMs = query.since ? Date.parse(query.since) : undefined;

    return cards.filter(card => {
        if (query.text && !cardMatchesText(card, query.text)) {
            return false;
        }
        if (query.category && card.category !== query.category) {
            return false;
        }
        if (query.status && card.status !== query.status) {
            return false;
        }
        if (query.minUrgency && card.urgency < query.minUrgency) {
            return false;
        }
        if (sinceMs !== undefined && Date.parse(card.updatedAt) < sinceMs) {
            return false;
        }
        if (query.center && query.radiusMeters !== undefined) {
            return cardInRadius(card, query.center, query.radiusMeters);
        }

        return true;
    });
}

export function clusterMapCards(
    cards: readonly MapAidCard[],
    gridSizeMeters = 1200,
): MapCluster[] {
    const groups = new Map<string, MapAidCard[]>();
    const metersPerLatDegree = 111_320;

    for (const card of cards) {
        const marker = toApproximateMapMarker(card);
        if (!marker) {
            continue;
        }

        const latStep = gridSizeMeters / metersPerLatDegree;
        const lngStep =
            gridSizeMeters /
            Math.max(1, metersPerLatDegree * Math.cos((marker.lat * Math.PI) / 180));

        const latCell = Math.floor(marker.lat / latStep);
        const lngCell = Math.floor(marker.lng / lngStep);
        const key = `${latCell}:${lngCell}`;
        const existing = groups.get(key) ?? [];
        existing.push(card);
        groups.set(key, existing);
    }

    return [...groups.entries()].map(([key, groupedCards]) => {
        const markers = groupedCards
            .map(toApproximateMapMarker)
            .filter((value): value is ApproximateMapMarker => Boolean(value));

        const lat = markers.reduce((sum, marker) => sum + marker.lat, 0) / markers.length;
        const lng = markers.reduce((sum, marker) => sum + marker.lng, 0) / markers.length;
        const radiusMeters = Math.max(...markers.map(marker => marker.radiusMeters));
        const urgencyMax = Math.max(...groupedCards.map(card => card.urgency)) as
            | 1
            | 2
            | 3
            | 4
            | 5;

        return {
            id: `cluster-${key}`,
            count: groupedCards.length,
            postIds: groupedCards.map(card => card.id),
            lat,
            lng,
            radiusMeters,
            urgencyMax,
            status: toClusterStatus(groupedCards),
            label: `${groupedCards.length} requests in approximate area`,
        } satisfies MapCluster;
    });
}

export function buildMapViewModel(
    cards: readonly MapAidCard[],
    state: DiscoveryFilterState,
): MapViewModel {
    const query = toMapDiscoveryQuery(state);
    const filteredCards = filterMapCards(cards, state);
    const markers = filteredCards
        .map(toApproximateMapMarker)
        .filter((value): value is ApproximateMapMarker => Boolean(value));
    const clusters = clusterMapCards(filteredCards);

    return {
        query,
        filteredCards,
        markers,
        clusters,
    };
}

export function openMapDetailDrawer(
    cards: readonly MapAidCard[],
    selectedPostId: string,
): MapDetailDrawerModel {
    const selected = cards.find(card => card.id === selectedPostId);
    if (!selected) {
        return { open: false, actions: [] };
    }

    const actions: MapDetailDrawerAction[] = [
        {
            action: 'contact_helper',
            label: 'Contact helper',
            ariaLabel: `Contact helper for ${selected.title}`,
        },
    ];

    if (selected.status === 'open') {
        actions.push({
            action: 'mark_in_progress',
            label: 'Mark in progress',
            ariaLabel: `Mark ${selected.title} as in progress`,
        });
        actions.push({
            action: 'mark_resolved',
            label: 'Mark resolved',
            ariaLabel: `Mark ${selected.title} as resolved`,
        });
    }

    if (selected.status === 'in-progress') {
        actions.push({
            action: 'mark_resolved',
            label: 'Mark resolved',
            ariaLabel: `Mark ${selected.title} as resolved`,
        });
    }

    return {
        open: true,
        selectedPostId: selected.id,
        title: selected.title,
        summary: selected.summary,
        status: selected.status,
        primaryCtaLabel: 'Contact helper',
        primaryCtaAriaLabel: `Contact helper for ${selected.title}`,
        actions,
    };
}

export function closeMapDetailDrawer(): MapDetailDrawerModel {
    return {
        open: false,
        actions: [],
    };
}
