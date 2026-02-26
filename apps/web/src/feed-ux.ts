import {
    toFeedDiscoveryQuery,
    type AidCategory,
    type AidStatus,
    type DiscoveryFilterState,
    type SharedAidDiscoveryQuery,
} from './discovery-filters.js';
import { haversineDistanceMeters } from './geo-utils.js';

export interface FeedAidCard {
    id: string;
    title: string;
    description: string;
    category: AidCategory;
    status: AidStatus;
    urgency: 1 | 2 | 3 | 4 | 5;
    accessibilityTags: string[];
    createdAt: string;
    updatedAt: string;
    location?: {
        lat: number;
        lng: number;
    };
}

export interface FeedBadge {
    label: string;
    tone: 'neutral' | 'info' | 'success' | 'danger';
}

export interface FeedCardPresentation {
    id: string;
    urgencyBadge: FeedBadge;
    statusBadge: FeedBadge;
    canEdit: boolean;
    canClose: boolean;
}

export interface FeedViewModel {
    query: SharedAidDiscoveryQuery;
    cards: FeedAidCard[];
    presentations: FeedCardPresentation[];
}

export type FeedLifecycleAction =
    | { action: 'create'; card: FeedAidCard }
    | {
          action: 'edit';
          id: string;
          patch: Partial<Omit<FeedAidCard, 'id'>>;
      }
    | { action: 'close'; id: string; closedAt?: string };

const cardMatchesText = (card: FeedAidCard, text: string): boolean => {
    const fragments = [
        card.title,
        card.description,
        card.accessibilityTags.join(' '),
    ].filter((fragment) => !!fragment && fragment.trim().length > 0);

    const haystack = fragments.join(' ').toLowerCase();
    const needle = text.toLowerCase();

    return haystack.includes(needle);
};

const toUrgencyBadge = (urgency: FeedAidCard['urgency']): FeedBadge => {
    if (urgency >= 5) {
        return { label: 'Critical', tone: 'danger' };
    }
    if (urgency >= 4) {
        return { label: 'High', tone: 'danger' };
    }
    if (urgency >= 3) {
        return { label: 'Medium', tone: 'info' };
    }
    return { label: 'Low', tone: 'neutral' };
};

const toStatusBadge = (status: AidStatus): FeedBadge => {
    if (status === 'open') {
        return { label: 'Open', tone: 'danger' };
    }
    if (status === 'in-progress') {
        return { label: 'In progress', tone: 'info' };
    }
    if (status === 'resolved') {
        return { label: 'Resolved', tone: 'success' };
    }
    return { label: 'Closed', tone: 'neutral' };
};

const byUpdatedAtDesc = (left: FeedAidCard, right: FeedAidCard): number => {
    const leftMs = Date.parse(left.updatedAt);
    const rightMs = Date.parse(right.updatedAt);
    const safeLeft = Number.isNaN(leftMs) ? 0 : leftMs;
    const safeRight = Number.isNaN(rightMs) ? 0 : rightMs;

    if (safeLeft !== safeRight) {
        return safeRight - safeLeft;
    }

    return left.id.localeCompare(right.id);
};

const toPresentation = (card: FeedAidCard): FeedCardPresentation => {
    return {
        id: card.id,
        urgencyBadge: toUrgencyBadge(card.urgency),
        statusBadge: toStatusBadge(card.status),
        canEdit: card.status !== 'closed',
        canClose: card.status !== 'closed',
    };
};

export function createFeedCard(input: {
    id: string;
    title: string;
    description: string;
    category: AidCategory;
    status?: AidStatus;
    urgency?: 1 | 2 | 3 | 4 | 5;
    accessibilityTags?: string[];
    createdAt?: string;
    updatedAt?: string;
    location?: { lat: number; lng: number };
}): FeedAidCard {
    const now = new Date().toISOString();

    return {
        id: input.id,
        title: input.title,
        description: input.description,
        category: input.category,
        status: input.status ?? 'open',
        urgency: input.urgency ?? 3,
        accessibilityTags: input.accessibilityTags ?? [],
        createdAt: input.createdAt ?? now,
        updatedAt: input.updatedAt ?? input.createdAt ?? now,
        location: input.location,
    };
}

export function buildFeedViewModel(
    cards: readonly FeedAidCard[],
    state: DiscoveryFilterState,
): FeedViewModel {
    const query = toFeedDiscoveryQuery(state);
    const sinceMs = query.since ? Date.parse(query.since) : undefined;

    const filtered = cards.filter(card => {
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

    const sorted = [...filtered].sort(byUpdatedAtDesc);

    return {
        query,
        cards: sorted,
        presentations: sorted.map(toPresentation),
    };
}

export function applyFeedLifecycleAction(
    cards: readonly FeedAidCard[],
    input: FeedLifecycleAction,
): FeedAidCard[] {
    if (input.action === 'create') {
        return [input.card, ...cards];
    }

    if (input.action === 'edit') {
        return cards.map(card =>
            card.id === input.id ? { ...card, ...input.patch, id: card.id } : card,
        );
    }

    const closedAt = input.closedAt ?? new Date().toISOString();
    return cards.map(card =>
        card.id === input.id ? { ...card, status: 'closed', updatedAt: closedAt } : card,
    );
}
