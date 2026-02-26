export const CONTRACT_VERSION = '0.5.0-phase5';

export type DomainName =
    | 'identity'
    | 'aid-records'
    | 'geo'
    | 'ranking'
    | 'messaging'
    | 'moderation'
    | 'directory'
    | 'volunteer-onboarding';

export interface ServiceHealth {
    service: 'api' | 'indexer' | 'moderation-worker';
    status: 'ok';
    contractVersion: string;
    did: string;
}

export interface ApiQueryAidRequest {
    latitude: number;
    longitude: number;
    radiusKm: number;
    category?:
        | 'food'
        | 'shelter'
        | 'medical'
        | 'transport'
        | 'childcare'
        | 'other';
    urgency?: 'low' | 'medium' | 'high' | 'critical';
    status?: 'open' | 'in-progress' | 'resolved' | 'closed';
    freshnessHours?: number;
    searchText?: string;
    page?: number;
    pageSize?: number;
}

export interface AidRecordSummary {
    uri: string;
    authorDid: string;
    title: string;
    summary: string;
    status: 'open' | 'in-progress' | 'resolved' | 'closed';
    category:
        | 'food'
        | 'shelter'
        | 'medical'
        | 'transport'
        | 'childcare'
        | 'other';
    urgency: 'low' | 'medium' | 'high' | 'critical';
    approximateGeo: {
        latitude: number;
        longitude: number;
        precisionKm: number;
    };
    distanceKm: number;
    ranking: {
        distanceBandScore: number;
        recencyScore: number;
        trustScore: number;
        finalScore: number;
    };
}

export interface ApiQueryAidResponse {
    total: number;
    page: number;
    pageSize: number;
    hasNextPage: boolean;
    results: AidRecordSummary[];
}

export interface ApiQueryDirectoryRequest {
    category?: string;
    status?: 'unverified' | 'community-verified' | 'partner-verified';
    freshnessHours?: number;
    searchText?: string;
    page?: number;
    pageSize?: number;
}

export interface DirectoryRecordSummary {
    uri: string;
    authorDid: string;
    name: string;
    category: string;
    serviceArea: string;
    status: 'unverified' | 'community-verified' | 'partner-verified';
    createdAt: string;
    updatedAt: string;
}

export interface ApiQueryDirectoryResponse {
    total: number;
    page: number;
    pageSize: number;
    hasNextPage: boolean;
    results: DirectoryRecordSummary[];
}

export interface ApiQueryErrorResponse {
    error: {
        code: 'INVALID_QUERY' | 'UNSUPPORTED_ROUTE';
        message: string;
        details?: Record<string, unknown>;
    };
}

export interface ApiChatInitiationRequest {
    aidPostUri: string;
    initiatedByDid: string;
    recipientDid: string;
    initiatedFrom: 'map' | 'feed' | 'detail';
}

export interface ApiChatInitiationResponse {
    conversationUri: string;
    created: boolean;
    transportPath: 'atproto-direct' | 'resource-fallback' | 'manual-fallback';
    fallbackNotice?: {
        code: 'RECIPIENT_CAPABILITY_MISSING';
        message: string;
        safeForUser: true;
    };
}

export interface ApiChatSafetyEvaluationResponse {
    allowed: boolean;
    code: 'OK' | 'BLOCKED' | 'RATE_LIMITED' | 'ABUSE_FLAGGED';
    userMessage: string;
    matchedKeywords: string[];
}

export interface IndexerNormalizedAidEvent {
    eventId: string;
    atUri: string;
    authorDid: string;
    normalizedAt: string;
    domain: Extract<
        DomainName,
        'aid-records' | 'geo' | 'ranking' | 'directory'
    >;
}

export interface ModerationDecisionEvent {
    eventId: string;
    subjectUri: string;
    action: 'none' | 'label' | 'hide' | 'escalate';
    reason: string;
    decidedAt: string;
}
export interface AidFeedQueryRequest {
    radiusKm: number;
    categories: string[];
    urgency: 'low' | 'medium' | 'high' | 'critical';
    status: 'open' | 'in-progress' | 'closed';
}

export interface AidFeedQueryResponse {
    requestId: string;
    total: number;
    items: Array<{
        id: string;
        title: string;
        summary: string;
        urgency: AidFeedQueryRequest['urgency'];
        status: AidFeedQueryRequest['status'];
    }>;
}

export interface FirehoseNormalizedEvent {
    type: 'firehose.normalized';
    recordUri: string;
    authorDid: string;
    indexedAt: string;
    action: 'create' | 'update' | 'delete';
    seq: number;
}

export interface ModerationReviewRequestedEvent {
    type: 'moderation.review.requested';
    subjectUri: string;
    reason: string;
    requestedAt: string;
}

export type ServiceEvent =
    | FirehoseNormalizedEvent
    | ModerationReviewRequestedEvent;

export const serviceContractStubs = {
    api: {
        request: {
            latitude: 40.7128,
            longitude: -74.006,
            radiusKm: 5,
            category: 'food',
            urgency: 'high',
            status: 'open',
            freshnessHours: 24,
        } satisfies ApiQueryAidRequest,
        response: {
            total: 0,
            page: 1,
            pageSize: 20,
            hasNextPage: false,
            results: [],
        } satisfies ApiQueryAidResponse,
        chatInitiation: {
            aidPostUri:
                'at://did:example:alice/app.mutualhub.aid.post/post-123',
            initiatedByDid: 'did:example:helper',
            recipientDid: 'did:example:alice',
            initiatedFrom: 'map',
        } satisfies ApiChatInitiationRequest,
        chatInitiationResponse: {
            conversationUri:
                'at://did:example:alice/app.mutualhub.conversation.meta/conv-123',
            created: true,
            transportPath: 'atproto-direct',
        } satisfies ApiChatInitiationResponse,
    },
    indexer: {
        event: {
            type: 'firehose.normalized',
            recordUri: 'at://did:example:alice/app.mutualhub.aid.post/abc123',
            authorDid: 'did:example:alice',
            indexedAt: new Date(0).toISOString(),
            action: 'create',
            seq: 1,
        } satisfies FirehoseNormalizedEvent,
    },
    moderationWorker: {
        event: {
            type: 'moderation.review.requested',
            subjectUri: 'at://did:example:alice/app.mutualhub.aid.post/abc123',
            reason: 'stub-reason',
            requestedAt: new Date(0).toISOString(),
        } satisfies ModerationReviewRequestedEvent,
    },
};
