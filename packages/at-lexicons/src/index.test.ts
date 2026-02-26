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
