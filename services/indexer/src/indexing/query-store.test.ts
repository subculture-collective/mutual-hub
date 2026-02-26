import assert from 'node:assert/strict';
import test from 'node:test';

import { atLexiconCollections } from '@mutual-hub/at-lexicons';

import { normalizeFirehoseEvent } from '../firehose/consumer.js';
import { toDirectoryCreateEvents } from './directory.fixtures.js';
import { QueryIndexStore } from './query-store.js';

test('directory records ingest deterministically and metadata stays searchable', () => {
    const events = toDirectoryCreateEvents();
    const store = new QueryIndexStore(300);
    const replayStore = new QueryIndexStore(300);

    for (const event of events) {
        store.applyFirehoseEvent(normalizeFirehoseEvent(event));
    }

    for (const event of [...events].reverse()) {
        replayStore.applyFirehoseEvent(normalizeFirehoseEvent(event));
    }

    const walkInHits = store.searchDirectoryResources({
        text: 'walk-in evenings',
    });
    assert.deepEqual(
        walkInHits.items.map(resource => resource.id),
        ['northside-clinic'],
    );

    const eligibilityHits = store.searchDirectoryResources({
        text: 'families with children',
    });
    assert.deepEqual(
        eligibilityHits.items.map(resource => resource.id),
        ['sunrise-food-bank'],
    );

    const firstOrdering = store
        .searchDirectoryResources()
        .items.map(resource => resource.uri);
    const replayOrdering = replayStore
        .searchDirectoryResources()
        .items.map(resource => resource.uri);

    assert.deepEqual(firstOrdering, replayOrdering);
    assert.equal(store.getSnapshot().directoryResourceCount, 3);
});

test('directory create/update/delete lifecycle propagates to search results', () => {
    const [shelter, clinic] = toDirectoryCreateEvents().slice(0, 2);
    const store = new QueryIndexStore(300);

    store.applyFirehoseEvent(normalizeFirehoseEvent(shelter));
    store.applyFirehoseEvent(normalizeFirehoseEvent(clinic));

    const updatedClinicRecord = {
        ...(clinic.record as NonNullable<typeof clinic.record>),
        openHours: 'Weekend triage Sat-Sun 08:00-18:00',
        eligibilityNotes: 'Walk-in urgent care for seniors and caregivers.',
        updatedAt: '2026-02-26T10:00:00.000Z',
    };

    store.applyFirehoseEvent(
        normalizeFirehoseEvent({
            op: 'update',
            uri: clinic.uri,
            record: updatedClinicRecord,
            receivedAt: updatedClinicRecord.updatedAt,
        }),
    );

    assert.equal(
        store.searchDirectoryResources({ text: 'walk-in evenings' }).items
            .length,
        0,
    );
    assert.deepEqual(
        store
            .searchDirectoryResources({ text: 'weekend triage' })
            .items.map(resource => resource.id),
        ['northside-clinic'],
    );

    store.applyFirehoseEvent(
        normalizeFirehoseEvent({
            op: 'delete',
            uri: shelter.uri,
            receivedAt: '2026-02-26T10:05:00.000Z',
        }),
    );

    const shelterResults = store.searchDirectoryResources({ type: 'shelter' });
    assert.equal(shelterResults.items.length, 0);

    const snapshot = store.getSnapshot();
    assert.equal(snapshot.directoryResourceCount, 1);
    assert.equal(snapshot.tombstoneCount, 1);

    const expectedTombstoneUri = `at://did:plc:org-harbor/${atLexiconCollections.resourceDirectory}/harbor-shelter`;
    assert.equal(expectedTombstoneUri, shelter.uri);
});

test('moderation decisions update visibility and default search exposure', () => {
    const store = new QueryIndexStore(300);
    const uri = `at://did:plc:author/${atLexiconCollections.aidPost}/post-moderated`;

    store.applyFirehoseEvent(
        normalizeFirehoseEvent({
            op: 'create',
            uri,
            record: {
                id: 'post-moderated',
                title: 'Need urgent aid',
                description: 'Details',
                category: 'medical',
                urgency: 4,
                status: 'open',
                createdAt: '2026-02-25T12:00:00.000Z',
                updatedAt: '2026-02-25T12:00:00.000Z',
                accessibilityTags: [],
            },
        }),
    );

    const visibleBefore = store.searchAidPosts();
    assert.equal(visibleBefore.items.length, 1);
    assert.equal(visibleBefore.items[0]?.moderation?.visibility, 'visible');

    store.applyModerationDecision(
        {
            targetUri: uri,
            action: 'delist',
            explanation: 'Policy violation',
        },
        '2026-02-25T12:05:00.000Z',
    );

    const hiddenByDefault = store.searchAidPosts();
    assert.equal(hiddenByDefault.items.length, 0);

    const moderationView = store.searchAidPosts({
        includeModerationHidden: true,
    });
    assert.equal(moderationView.items.length, 1);
    assert.equal(moderationView.items[0]?.moderation?.visibility, 'delisted');
});

test('repeated record updates retain minimum precision and privacy snapping', () => {
    const store = new QueryIndexStore(300);
    const uri = `at://did:plc:author/${atLexiconCollections.aidPost}/post-privacy`;

    const first = normalizeFirehoseEvent({
        op: 'create',
        uri,
        record: {
            id: 'post-privacy',
            title: 'Need food',
            description: 'Details',
            category: 'food',
            urgency: 3,
            status: 'open',
            createdAt: '2026-02-25T13:00:00.000Z',
            updatedAt: '2026-02-25T13:00:00.000Z',
            location: {
                lat: 1.300123,
                lng: 103.800456,
                precisionMeters: 120,
            },
            accessibilityTags: [],
        },
    });

    store.applyFirehoseEvent(first);

    const firstResult = store.searchAidPosts().items[0];
    assert.equal(firstResult?.location?.precisionMeters, 300);
    assert.notEqual(firstResult?.location?.lat, 1.300123);
    assert.notEqual(firstResult?.location?.lng, 103.800456);

    store.applyFirehoseEvent(
        normalizeFirehoseEvent({
            op: 'update',
            uri,
            record: {
                ...(first.record as NonNullable<typeof first.record>),
                updatedAt: '2026-02-25T13:05:00.000Z',
                location: {
                    lat: 1.3002,
                    lng: 103.8007,
                    precisionMeters: 100,
                },
            },
            receivedAt: '2026-02-25T13:05:00.000Z',
        }),
    );

    const secondResult = store.searchAidPosts().items[0];
    assert.equal(secondResult?.location?.precisionMeters, 300);
    assert.notEqual(secondResult?.location?.lat, 1.3002);
    assert.notEqual(secondResult?.location?.lng, 103.8007);
});
