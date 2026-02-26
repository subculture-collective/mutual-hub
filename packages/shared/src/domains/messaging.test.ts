import assert from 'node:assert/strict';
import test from 'node:test';

import {
    initiatePostLinkedChat,
    validateConversationPermissions,
} from './messaging.js';

test('initiatePostLinkedChat attaches request context metadata on success', () => {
    const result = initiatePostLinkedChat({
        requesterDid: 'did:plc:requester1',
        recipientDid: 'did:plc:helper1',
        postUri: 'at://did:plc:author/com.mutualaid.hub.aidPost/post-1',
        initiatedAt: '2026-02-25T10:00:00.000Z',
        requestContext: {
            source: 'feed_card',
            postTitle: 'Need emergency groceries',
            category: 'food',
            urgency: 4,
            areaLabel: 'Central',
        },
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
        return;
    }

    assert.equal(result.conversation.state, 'open');
    assert.equal(result.conversation.requestContext?.source, 'feed_card');
    assert.equal(result.conversation.requestContext?.urgency, 4);
    assert.equal(result.ux.severity, 'success');
});

test('initiatePostLinkedChat blocks invalid permissions with actionable ux message', () => {
    const result = initiatePostLinkedChat(
        {
            requesterDid: 'did:plc:requester2',
            recipientDid: 'did:plc:helper2',
            postUri: 'at://did:plc:author/com.mutualaid.hub.aidPost/post-2',
            requestContext: {
                source: 'map_detail',
                postTitle: 'Need transport to clinic',
                category: 'transport',
                urgency: 3,
            },
        },
        {
            recipientAcceptsChats: false,
        },
    );

    assert.equal(result.ok, false);
    if (result.ok) {
        return;
    }

    assert.equal(result.code, 'recipient_not_available');
    assert.match(result.ux.message, /not accepting chats/i);
});

test('validateConversationPermissions rejects self-chat initiation', () => {
    const failure = validateConversationPermissions({
        requesterDid: 'did:plc:same-user',
        recipientDid: 'did:plc:same-user',
        postUri: 'at://did:plc:author/com.mutualaid.hub.aidPost/post-3',
    });

    assert.equal(failure, 'same_participant');
});
