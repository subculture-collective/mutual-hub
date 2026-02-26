import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultDiscoveryFilterState } from './discovery-filters.js';
import {
    type FeedAidCard,
    applyFeedLifecycleAction,
    buildFeedViewModel,
    createFeedCard,
    toFeedCardPresentation,
} from './feed-ux.js';

function sampleCard(overrides: Partial<FeedAidCard> = {}): FeedAidCard {
    return createFeedCard({
        id: 'post-1',
        title: 'Need meal assistance',
        description: 'Need meals for two days',
        category: 'food',
        urgency: 3,
        createdAt: '2026-02-25T00:00:00.000Z',
        updatedAt: '2026-02-25T00:00:00.000Z',
        uri: 'at://did:plc:test/com.mutualaid.hub.aidPost/post-1',
        authorDid: 'did:plc:test',
        ...overrides,
    });
}

test('feed tabs expose latest and nearby data views', () => {
    const cards: FeedAidCard[] = [
        sampleCard({
            id: 'near',
            distanceMeters: 400,
            location: { lat: 1.3, lng: 103.8, precisionMeters: 300 },
        }),
        sampleCard({
            id: 'far',
            distanceMeters: 9000,
            location: { lat: 1.36, lng: 103.86, precisionMeters: 300 },
        }),
    ];

    const view = buildFeedViewModel(cards, {
        ...defaultDiscoveryFilterState,
        feedTab: 'nearby',
        center: { lat: 1.3, lng: 103.8 },
        radiusMeters: 5000,
    });

    assert.equal(view.latest.cards.length, 2);
    assert.equal(view.nearby.cards.length, 1);
    assert.equal(view.nearby.cards[0]?.id, 'near');
});

test('lifecycle close action updates status and recency ordering', () => {
    const cards: FeedAidCard[] = [
        sampleCard({ id: 'older', updatedAt: '2026-02-25T00:00:00.000Z' }),
        sampleCard({ id: 'newer', updatedAt: '2026-02-25T01:00:00.000Z' }),
    ];

    const next = applyFeedLifecycleAction(cards, {
        type: 'close',
        id: 'older',
        closedAt: '2026-02-25T03:00:00.000Z',
    });

    assert.equal(next[0]?.id, 'older');
    assert.equal(next[0]?.status, 'closed');
});

test('lifecycle edit action updates feed card details', () => {
    const cards: FeedAidCard[] = [sampleCard({ id: 'edit-1', title: 'Old' })];

    const next = applyFeedLifecycleAction(cards, {
        type: 'edit',
        id: 'edit-1',
        patch: {
            title: 'Updated title',
            urgency: 5,
        },
        updatedAt: '2026-02-25T04:00:00.000Z',
    });

    assert.equal(next[0]?.title, 'Updated title');
    assert.equal(next[0]?.urgency, 5);
});

test('card presentation includes urgency/status lifecycle indicators', () => {
    const card = sampleCard({ urgency: 5, status: 'in_progress' });
    const presentation = toFeedCardPresentation(card);

    assert.equal(presentation.urgencyBadge.label, 'Urgency 5');
    assert.equal(presentation.urgencyBadge.tone, 'critical');
    assert.equal(presentation.statusBadge.label, 'In Progress');
    assert.equal(presentation.canClose, true);
    assert.equal(presentation.chatActionLabel, 'Start chat');
    assert.match(presentation.chatActionAriaLabel, /Start chat/i);
});
