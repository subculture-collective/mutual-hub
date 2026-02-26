import { describe, expect, it } from 'vitest';
import {
    buildChatInitiationRequest,
    defaultChatLaunchState,
    isChatInitiationAllowed,
    reduceChatLaunchState,
    toChatStatusNotice,
    type ChatInitiationIntent,
} from './chat-ux.js';

const mapIntent: ChatInitiationIntent = {
    aidPostUri: 'at://did:example:alice/app.mutualhub.aid.post/post-map',
    aidPostTitle: 'Need groceries',
    recipientDid: 'did:example:alice',
    initiatedFrom: 'map',
};

const feedIntent: ChatInitiationIntent = {
    aidPostUri: 'at://did:example:alice/app.mutualhub.aid.post/post-feed',
    aidPostTitle: 'Need shelter',
    recipientDid: 'did:example:alice',
    initiatedFrom: 'feed',
};

describe('chat ux', () => {
    it('builds initiation payloads from map and feed entry surfaces', () => {
        const mapRequest = buildChatInitiationRequest(
            mapIntent,
            'did:example:helper',
        );
        const feedRequest = buildChatInitiationRequest(
            feedIntent,
            'did:example:helper',
        );

        expect(mapRequest.initiatedFrom).toBe('map');
        expect(feedRequest.initiatedFrom).toBe('feed');
        expect(mapRequest.recipientDid).toBe('did:example:alice');
    });

    it('enforces permission and identity gating for initiation', () => {
        expect(
            isChatInitiationAllowed({
                initiatedByDid: 'did:example:helper',
                recipientDid: 'did:example:alice',
                hasPermission: true,
            }),
        ).toBe(true);

        expect(
            isChatInitiationAllowed({
                initiatedByDid: 'did:example:alice',
                recipientDid: 'did:example:alice',
                hasPermission: true,
            }),
        ).toBe(false);

        expect(
            isChatInitiationAllowed({
                initiatedByDid: 'did:example:helper',
                recipientDid: 'did:example:alice',
                hasPermission: false,
            }),
        ).toBe(false);
    });

    it('shows explicit fallback notice when recipient capability is missing', () => {
        const submitting = reduceChatLaunchState(defaultChatLaunchState, {
            type: 'submit',
            intent: mapIntent,
        });
        expect(submitting.status).toBe('submitting');

        const successWithFallback = reduceChatLaunchState(submitting, {
            type: 'success',
            intent: mapIntent,
            result: {
                conversationUri:
                    'at://did:example:alice/app.mutualhub.conversation.meta/conv-1',
                created: true,
                transportPath: 'manual-fallback',
                fallbackNotice: {
                    code: 'RECIPIENT_CAPABILITY_MISSING',
                    message:
                        'Recipient cannot receive AT-native chat yet. We will use a safe fallback handoff path.',
                    safeForUser: true,
                    transportPath: 'manual-fallback',
                },
            },
        });

        const notice = toChatStatusNotice(successWithFallback);
        expect(notice?.tone).toBe('warning');
        expect(notice?.message).toContain('safe fallback handoff path');
    });

    it('converts failure state into actionable danger notice', () => {
        const failure = reduceChatLaunchState(defaultChatLaunchState, {
            type: 'failure',
            intent: feedIntent,
            errorMessage: 'Unauthorized initiation. Please verify participant access.',
        });

        const notice = toChatStatusNotice(failure);
        expect(notice?.tone).toBe('danger');
        expect(notice?.message).toContain('Unauthorized initiation');
    });
});
