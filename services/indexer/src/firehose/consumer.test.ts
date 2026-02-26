import assert from 'node:assert/strict';
import test from 'node:test';

import { atLexiconCollections } from '@mutual-hub/at-lexicons';

import { normalizeFirehoseEvent, parseFirehoseUri } from './consumer.js';

const now = '2026-02-25T08:00:00.000Z';

test('parseFirehoseUri extracts did, collection, and rkey', () => {
    const parsed = parseFirehoseUri(
        `at://did:plc:author/${atLexiconCollections.aidPost}/rkey-1`,
    );

    assert.equal(parsed.repoDid, 'did:plc:author');
    assert.equal(parsed.collection, atLexiconCollections.aidPost);
    assert.equal(parsed.rkey, 'rkey-1');
});

test('normalizeFirehoseEvent validates create records', () => {
    const normalized = normalizeFirehoseEvent({
        op: 'create',
        uri: `at://did:plc:author/${atLexiconCollections.aidPost}/post-1`,
        receivedAt: now,
        record: {
            id: 'post-1',
            title: 'Need groceries',
            description: 'Need groceries for two seniors',
            category: 'food',
            urgency: 4,
            status: 'open',
            createdAt: now,
            updatedAt: now,
            accessibilityTags: ['elder-support'],
        },
    });

    assert.equal(normalized.deleted, false);
    assert.equal(normalized.collection, atLexiconCollections.aidPost);
    assert.equal(
        normalized.record !== undefined && 'id' in normalized.record,
        true,
    );
    if (normalized.record && 'id' in normalized.record) {
        assert.equal(normalized.record.id, 'post-1');
    }
});

test('normalizeFirehoseEvent handles delete records without payload', () => {
    const normalized = normalizeFirehoseEvent({
        op: 'delete',
        uri: `at://did:plc:author/${atLexiconCollections.aidPost}/post-1`,
    });

    assert.equal(normalized.deleted, true);
    assert.equal(normalized.record, undefined);
});
