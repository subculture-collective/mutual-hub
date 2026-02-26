import assert from 'node:assert/strict';
import test from 'node:test';

import {
    atLexiconCollections,
    isKnownCollection,
    validateRecord,
} from './index.js';

const nowIso = new Date().toISOString();

test('validates aid post record shape', () => {
    const record = validateRecord(atLexiconCollections.aidPost, {
        id: 'post-1',
        title: 'Need bottled water',
        description: 'Need water for three people for tonight.',
        category: 'food',
        urgency: 5,
        status: 'open',
        createdAt: nowIso,
        updatedAt: nowIso,
        accessibilityTags: ['wheelchair-accessible'],
    });

    assert.equal(record.id, 'post-1');
});

test('validates volunteer profile record shape', () => {
    const record = validateRecord(atLexiconCollections.volunteerProfile, {
        did: 'did:plc:volunteer123',
        displayName: 'Ari',
        skills: ['first aid'],
        availability: ['evenings'],
        verified: true,
        preferredAidCategories: ['medical'],
        createdAt: nowIso,
        updatedAt: nowIso,
    });

    assert.equal(record.displayName, 'Ari');
});

test('known collection helper recognizes supported collection IDs', () => {
    assert.equal(
        isKnownCollection(atLexiconCollections.conversationMetadata),
        true,
    );
    assert.equal(isKnownCollection('com.mutualaid.hub.unknown'), false);
});

test('validates extended conversation metadata record shape', () => {
    const record = validateRecord(atLexiconCollections.conversationMetadata, {
        id: 'conv-1',
        postUri: 'at://did:plc:author/com.mutualaid.hub.aidPost/post-1',
        requesterDid: 'did:plc:req',
        recipientDid: 'did:plc:rec',
        state: 'handoff_suggested',
        requestContext: {
            source: 'feed_card',
            postTitle: 'Need supplies',
            category: 'supplies',
            urgency: 4,
            areaLabel: 'Central',
        },
        routingDestinationType: 'volunteer_pool',
        routingDestinationId: 'did:plc:volunteer',
        routingRationale:
            'Verified volunteer selected by deterministic ordering',
        transportMode: 'fallback_notice',
        fallbackReason: 'recipient_unsupported',
        fallbackNotice:
            'Recipient cannot receive AT-native messages right now. Use safe fallback handoff.',
        createdAt: nowIso,
        updatedAt: nowIso,
    });

    assert.equal(record.id, 'conv-1');
    assert.equal(record.transportMode, 'fallback_notice');
});
