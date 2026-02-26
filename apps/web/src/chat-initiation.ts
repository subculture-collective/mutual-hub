import {
    type ChatInitOutcome,
    type ChatPermissionSnapshot,
    type Did,
    initiatePostLinkedChat,
} from '@mutual-hub/shared';

import type { FeedAidCard } from './feed-ux.js';
import type { MapAidCard } from './map-ux.js';

export interface ChatInitiationViewState {
    tone: 'success' | 'error';
    title: string;
    message: string;
}

export interface ChatInitiationResult {
    source: 'map_detail' | 'feed_card' | 'post_detail';
    outcome: ChatInitOutcome;
    viewState: ChatInitiationViewState;
}

function toViewState(outcome: ChatInitOutcome): ChatInitiationViewState {
    if (outcome.ok) {
        return {
            tone: 'success',
            title: outcome.ux.title,
            message: outcome.ux.message,
        };
    }

    return {
        tone: 'error',
        title: outcome.ux.title,
        message: outcome.ux.message,
    };
}

export function initiateChatFromMapCard(
    card: MapAidCard,
    requesterDid: Did,
    permissions: ChatPermissionSnapshot = {},
): ChatInitiationResult {
    const outcome = initiatePostLinkedChat(
        {
            requesterDid,
            recipientDid: card.authorDid,
            postUri: card.uri,
            requestContext: {
                source: 'map_detail',
                postTitle: card.title,
                category: card.category,
                urgency: card.urgency,
                areaLabel: card.location?.areaLabel,
            },
        },
        permissions,
    );

    return {
        source: 'map_detail',
        outcome,
        viewState: toViewState(outcome),
    };
}

export function initiateChatFromFeedCard(
    card: FeedAidCard,
    requesterDid: Did,
    permissions: ChatPermissionSnapshot = {},
): ChatInitiationResult {
    const outcome = initiatePostLinkedChat(
        {
            requesterDid,
            recipientDid: card.authorDid,
            postUri: card.uri,
            requestContext: {
                source: 'feed_card',
                postTitle: card.title,
                category: card.category,
                urgency: card.urgency,
                areaLabel: card.location?.areaLabel,
            },
        },
        permissions,
    );

    return {
        source: 'feed_card',
        outcome,
        viewState: toViewState(outcome),
    };
}

export function initiateChatFromPostDetail(
    post: {
        uri: string;
        authorDid: Did;
        title: string;
        category: MapAidCard['category'];
        urgency: MapAidCard['urgency'];
        areaLabel?: string;
    },
    requesterDid: Did,
    permissions: ChatPermissionSnapshot = {},
): ChatInitiationResult {
    const outcome = initiatePostLinkedChat(
        {
            requesterDid,
            recipientDid: post.authorDid,
            postUri: post.uri,
            requestContext: {
                source: 'post_detail',
                postTitle: post.title,
                category: post.category,
                urgency: post.urgency,
                areaLabel: post.areaLabel,
            },
        },
        permissions,
    );

    return {
        source: 'post_detail',
        outcome,
        viewState: toViewState(outcome),
    };
}
