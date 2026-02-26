import type { AidPostSummary, AidStatus } from '@mutual-hub/shared';

import {
    type DiscoveryFilterState,
    type SharedAidDiscoveryQuery,
    toMapDiscoveryQuery,
} from './discovery-filters.js';

const minimumPublicPrecisionMeters = 300;
const earthRadiusMeters = 6_371_000;

export interface MapAidCard extends AidPostSummary {
    distanceMeters?: number;
}

export interface MapMarker {
    id: string;
    lat: number;
    lng: number;
    radiusMeters: number;
    label: string;
    urgency: number;
    status: AidStatus;
}

export interface MapCluster {
    id: string;
    count: number;
    postIds: readonly string[];
    center: {
        lat: number;
        lng: number;
    };
    radiusMeters: number;
    urgencyMax: number;
    status: AidStatus | 'mixed';
    accessibilityLabel: string;
}

export type MapTriageAction =
    | 'start_chat'
    | 'contact_helper'
    | 'view_feed_context'
    | 'mark_in_progress';

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
    primaryCtaLabel?: string;
    primaryCtaAriaLabel?: string;
    actions: readonly MapDetailDrawerAction[];
}

export interface MapViewModel {
    query: SharedAidDiscoveryQuery;
    cards: readonly MapAidCard[];
    markers: readonly MapMarker[];
    clusters: readonly MapCluster[];
}

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
        Math.cos(fromLat) *
            Math.cos(toLat) *
            Math.sin(lngDelta / 2) *
            Math.sin(lngDelta / 2);

    return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizePrecision(precisionMeters: number): number {
    return Math.max(minimumPublicPrecisionMeters, Math.round(precisionMeters));
}

function snapLocation(
    lat: number,
    lng: number,
    precisionMeters: number,
): { lat: number; lng: number } {
    const metersPerLatDegree = 111_320;
    const latStep = precisionMeters / metersPerLatDegree;
    const cosLat = Math.max(0.2, Math.abs(Math.cos(toRadians(lat))));
    const lngStep = precisionMeters / (metersPerLatDegree * cosLat);

    return {
        lat: Number((Math.round(lat / latStep) * latStep).toFixed(6)),
        lng: Number((Math.round(lng / lngStep) * lngStep).toFixed(6)),
    };
}

function cardMatchesText(card: MapAidCard, text: string): boolean {
    const haystack = [
        card.title,
        card.description,
        card.accessibilityTags.join(' '),
        card.location?.areaLabel ?? '',
    ]
        .join(' ')
        .toLowerCase();
    return haystack.includes(text.toLowerCase());
}

function cardInRadius(
    card: MapAidCard,
    center: { lat: number; lng: number } | undefined,
    radiusMeters: number | undefined,
): boolean {
    if (!center || radiusMeters === undefined) {
        return true;
    }

    if (!card.location) {
        return false;
    }

    return haversineDistanceMeters(center, card.location) <= radiusMeters;
}

function toClusterStatus(cards: readonly MapAidCard[]): AidStatus | 'mixed' {
    const statuses = new Set(cards.map(card => card.status));
    if (statuses.size !== 1) {
        return 'mixed';
    }

    return cards[0]?.status ?? 'open';
}

export function toApproximateMapMarker(
    card: MapAidCard,
): MapMarker | undefined {
    if (!card.location) {
        return undefined;
    }

    const precisionMeters = normalizePrecision(card.location.precisionMeters);
    const snapped = snapLocation(
        card.location.lat,
        card.location.lng,
        precisionMeters,
    );

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

    return cards.filter(card => {
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
            const updatedMs = Date.parse(card.updatedAt);
            if (
                !Number.isNaN(sinceMs) &&
                (Number.isNaN(updatedMs) || updatedMs < sinceMs)
            ) {
                return false;
            }
        }

        if (!cardInRadius(card, query.center, query.radiusMeters)) {
            return false;
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
            (metersPerLatDegree *
                Math.max(0.2, Math.abs(Math.cos(toRadians(marker.lat)))));
        const latCell = Math.floor(marker.lat / latStep);
        const lngCell = Math.floor(marker.lng / lngStep);
        const key = `${latCell}:${lngCell}`;
        const existing = groups.get(key) ?? [];
        existing.push(card);
        groups.set(key, existing);
    }

    return [...groups.entries()].map(([key, groupedCards]) => {
        const markers = groupedCards
            .map(card => toApproximateMapMarker(card))
            .filter((marker): marker is MapMarker => marker !== undefined);

        const lat =
            markers.reduce((sum, marker) => sum + marker.lat, 0) /
            markers.length;
        const lng =
            markers.reduce((sum, marker) => sum + marker.lng, 0) /
            markers.length;
        const radiusMeters = Math.max(
            ...markers.map(marker => marker.radiusMeters),
        );
        const urgencyMax = Math.max(...groupedCards.map(card => card.urgency));

        const status = toClusterStatus(groupedCards);

        return {
            id: `cluster-${key}`,
            count: groupedCards.length,
            postIds: groupedCards.map(card => card.id),
            center: {
                lat: Number(lat.toFixed(6)),
                lng: Number(lng.toFixed(6)),
            },
            radiusMeters,
            urgencyMax,
            status,
            accessibilityLabel: `${groupedCards.length} requests in approximate area`,
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
        .map(card => toApproximateMapMarker(card))
        .filter((marker): marker is MapMarker => marker !== undefined);
    const clusters = clusterMapCards(filteredCards);

    return {
        query,
        cards: filteredCards,
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
        return {
            open: false,
            actions: [],
        };
    }

    const actions: MapDetailDrawerAction[] = [
        {
            action: 'start_chat',
            label: 'Start chat',
            ariaLabel: `Start chat for ${selected.title}`,
        },
        {
            action: 'contact_helper',
            label: 'Contact helper',
            ariaLabel: `Contact helper for ${selected.title}`,
        },
        {
            action: 'view_feed_context',
            label: 'View in feed',
            ariaLabel: `Open ${selected.title} in feed context`,
        },
    ];

    if (selected.status !== 'closed') {
        actions.push({
            action: 'mark_in_progress',
            label: 'Mark in progress',
            ariaLabel: `Mark ${selected.title} as in progress`,
        });
    }

    return {
        open: true,
        selectedPostId,
        title: selected.title,
        summary: `${selected.category} · urgency ${selected.urgency} · ${selected.status}`,
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
