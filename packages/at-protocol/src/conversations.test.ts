import assert from 'node:assert/strict';
import test from 'node:test';

import {
    ConversationMetadataRepository,
    fromConversationMetadataLexiconRecord,
    resolveRecipientTransportCapability,
    toConversationMetadataLexiconRecord,
} from './conversations.js';

test('conversation metadata repository creates then updates records predictably', () => {
    const repository = new ConversationMetadataRepository();

    const created = repository.upsertMetadata({
        repoDid: 'did:plc:requester1',
        record: {
            id: 'conv-1',
            postUri: 'at://did:plc:author/com.mutualaid.hub.aidPost/post-1',
            requesterDid: 'did:plc:requester1',
            recipientDid: 'did:plc:recipient1',
            state: 'open',
            transportMode: 'atproto_native',
            createdAt: '2026-02-25T10:00:00.000Z',
            updatedAt: '2026-02-25T10:00:00.000Z',
        },
    });

    const updated = repository.upsertMetadata({
        repoDid: 'did:plc:requester1',
        record: {
            id: 'conv-1',
            postUri: 'at://did:plc:author/com.mutualaid.hub.aidPost/post-1',
            requesterDid: 'did:plc:requester1',
            recipientDid: 'did:plc:recipient1',
            state: 'handoff_suggested',
            transportMode: 'fallback_notice',
            fallbackReason: 'recipient_unsupported',
            fallbackNotice:
                'Recipient cannot receive AT-native messages right now.',
            createdAt: '2026-02-25T10:00:00.000Z',
            updatedAt: '2026-02-25T10:05:00.000Z',
        },
    });

    assert.equal(created.version, 1);
    assert.equal(updated.version, 2);

    const fallbackAudit = repository.listForAudit({ fallbackOnly: true });

    assert.equal(fallbackAudit.length, 1);
    assert.equal(fallbackAudit[0]?.record.id, 'conv-1');
    assert.equal(fallbackAudit[0]?.record.transportMode, 'fallback_notice');
});

test('capability detection reports at-native support route when available', () => {
    const capability = resolveRecipientTransportCapability({
        recipientDid: 'did:plc:recipient2',
        supportsAtNativeTransport: true,
    });

    assert.equal(capability.mode, 'atproto_native');
    assert.equal(capability.fallbackReason, undefined);
    assert.match(capability.notice, /supports AT-native/i);
});

test('capability detection returns explicit safe fallback notice when unavailable', () => {
    const capability = resolveRecipientTransportCapability({
        recipientDid: 'did:plc:recipient3',
        supportsAtNativeTransport: false,
        fallbackReason: 'recipient_unsupported',
    });

    assert.equal(capability.mode, 'fallback_notice');
    assert.equal(capability.fallbackReason, 'recipient_unsupported');
    assert.match(capability.notice, /cannot receive AT-native messages/i);
});

test('conversation metadata mapping preserves routing and transport fields', () => {
    const lexiconRecord = toConversationMetadataLexiconRecord({
        id: 'conv-map-1',
        postUri: 'at://did:plc:author/com.mutualaid.hub.aidPost/post-map-1',
        requesterDid: 'did:plc:req-map',
        recipientDid: 'did:plc:rec-map',
        state: 'handoff_suggested',
        requestContext: {
            source: 'post_detail',
            postTitle: 'Need urgent shelter',
            category: 'shelter',
            urgency: 5,
            areaLabel: 'West',
        },
        routing: {
            destinationType: 'resource_directory',
            destinationId: 'resource-1',
            rationale: 'Nearest verified shelter selected.',
        },
        transport: {
            mode: 'fallback_notice',
            fallbackReason: 'recipient_unsupported',
            fallbackNotice:
                'Recipient cannot receive AT-native messages right now.',
        },
        createdAt: '2026-02-25T11:00:00.000Z',
        updatedAt: '2026-02-25T11:00:00.000Z',
    });

    const roundTrip = fromConversationMetadataLexiconRecord(lexiconRecord);

    assert.equal(roundTrip.routing?.destinationType, 'resource_directory');
    assert.equal(roundTrip.transport?.mode, 'fallback_notice');
    assert.equal(roundTrip.requestContext?.source, 'post_detail');
});
