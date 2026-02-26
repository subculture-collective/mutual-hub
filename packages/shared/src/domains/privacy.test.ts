import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createMinimalLogEntry,
    createMinimalLogPayload,
    redactSensitiveFields,
} from './privacy.js';

test('redactSensitiveFields censors DID/URI/location-sensitive data', () => {
    const redacted = redactSensitiveFields({
        requesterDid: 'did:plc:requester-1',
        targetUri: 'at://did:plc:target/com.mutualaid.hub.aidPost/post-1',
        details: 'Meet at exact coordinate 1.300012,103.800012',
        location: {
            lat: 1.300012,
            lng: 103.800012,
            areaLabel: 'Central',
        },
        meta: {
            messageText: 'contact did:plc:helper-1',
        },
    });

    assert.equal(redacted.requesterDid, '[REDACTED]');
    assert.equal(redacted.targetUri, '[REDACTED]');
    assert.equal(redacted.details, '[REDACTED]');
    assert.equal(redacted.location, '[REDACTED]');
    assert.equal(redacted.meta.messageText, '[REDACTED]');
});

test('minimal logging keeps allowlisted keys and redacts patterns consistently', () => {
    const payload = createMinimalLogPayload(
        {
            service: 'moderation-worker',
            ready: true,
            actorDid: 'did:plc:mod-1',
            note: 'Escalated to at://did:plc:target/com.mutualaid.hub.aidPost/post-2',
            ignoredField: 'drop-me',
        },
        {
            allowedKeys: ['service', 'ready', 'actorDid', 'note'],
            maxStringLength: 80,
        },
    );

    assert.equal(payload.service, 'moderation-worker');
    assert.equal(payload.ready, true);
    assert.equal(payload.actorDid, '[REDACTED]');
    assert.equal(payload.note, 'Escalated to [REDACTED]');
    assert.equal('ignoredField' in payload, false);

    const logEntry = createMinimalLogEntry(
        'service.ready',
        {
            service: 'indexer',
            targetUri: 'at://did:plc:target/com.mutualaid.hub.aidPost/post-3',
        },
        {
            allowedKeys: ['service', 'targetUri'],
            at: '2026-02-25T13:00:00.000Z',
        },
    );

    assert.equal(logEntry.event, 'service.ready');
    assert.equal(logEntry.at, '2026-02-25T13:00:00.000Z');
    assert.equal(logEntry.payload.targetUri, '[REDACTED]');
});
