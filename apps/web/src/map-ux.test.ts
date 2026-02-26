import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultDiscoveryFilterState } from './discovery-filters.js';
import {
    type MapAidCard,
    buildMapViewModel,
    clusterMapCards,
    filterMapCards,
    openMapDetailDrawer,
    toApproximateMapMarker,
} from './map-ux.js';

function buildCard(overrides: Partial<MapAidCard> = {}): MapAidCard {
    return {
        id: 'card-1',
        title: 'Need supplies',
        description: 'Need diapers and canned food',
        category: 'supplies',
        urgency: 4,
        status: 'open',
        createdAt: '2026-02-25T00:00:00.000Z',
        updatedAt: '2026-02-25T00:00:00.000Z',
        accessibilityTags: ['wheelchair'],
        uri: 'at://did:plc:test/com.mutualaid.hub.aidPost/card-1',
        authorDid: 'did:plc:test',
        location: {
            lat: 1.300123,
            lng: 103.800987,
            precisionMeters: 120,
            areaLabel: 'Central',
        },
        ...overrides,
    };
}

test('approximate marker enforces minimum geoprivacy precision', () => {
    const marker = toApproximateMapMarker(buildCard());

    assert.ok(marker);
    assert.equal(marker?.radiusMeters, 300);
    assert.notEqual(marker?.lat, 1.300123);
    assert.notEqual(marker?.lng, 103.800987);
});

test('map clustering groups nearby cards into a single cluster', () => {
    const cards: MapAidCard[] = [
        buildCard({
            id: 'near-1',
            location: { lat: 1.3001, lng: 103.8001, precisionMeters: 300 },
        }),
        buildCard({
            id: 'near-2',
            location: { lat: 1.3002, lng: 103.8002, precisionMeters: 300 },
        }),
    ];

    const clusters = clusterMapCards(cards, 1000);

    assert.equal(clusters.length, 1);
    assert.equal(clusters[0]?.count, 2);
    assert.equal(clusters[0]?.status, 'open');
});

test('map filter interactions respect category and radius', () => {
    const cards: MapAidCard[] = [
        buildCard({
            id: 'near',
            category: 'food',
            location: { lat: 1.3, lng: 103.8, precisionMeters: 300 },
        }),
        buildCard({
            id: 'far',
            category: 'food',
            location: { lat: 1.45, lng: 103.95, precisionMeters: 300 },
        }),
        buildCard({
            id: 'other',
            category: 'medical',
            location: { lat: 1.3, lng: 103.8, precisionMeters: 300 },
        }),
    ];

    const filtered = filterMapCards(cards, {
        ...defaultDiscoveryFilterState,
        category: 'food',
        center: { lat: 1.3, lng: 103.8 },
        radiusMeters: 5000,
    });

    assert.deepEqual(
        filtered.map(card => card.id),
        ['near'],
    );
});

test('detail drawer returns triage actions with accessible labels', () => {
    const cards: MapAidCard[] = [
        buildCard({ id: 'drawer-1', title: 'Need water' }),
    ];
    const drawer = openMapDetailDrawer(cards, 'drawer-1');

    assert.equal(drawer.open, true);
    assert.equal(drawer.primaryCtaLabel, 'Contact helper');
    assert.ok(drawer.primaryCtaAriaLabel?.includes('Need water'));
    assert.equal(
        drawer.actions.some(action => action.action === 'start_chat'),
        true,
    );
    assert.equal(
        drawer.actions.some(action => action.action === 'contact_helper'),
        true,
    );
});

test('map view model wires shared filter query for interactions', () => {
    const cards: MapAidCard[] = [
        buildCard({ id: 'vm-1', category: 'food' }),
        buildCard({ id: 'vm-2', category: 'medical' }),
    ];

    const view = buildMapViewModel(cards, {
        ...defaultDiscoveryFilterState,
        category: 'food',
    });

    assert.equal(view.query.category, 'food');
    assert.equal(view.cards.length, 1);
    assert.equal(view.cards[0]?.id, 'vm-1');
});
