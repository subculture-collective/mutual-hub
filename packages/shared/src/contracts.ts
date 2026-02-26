export const CONTRACT_VERSION = '0.2.0-phase2';

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
  category?: string;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
}

export interface AidRecordSummary {
  uri: string;
  authorDid: string;
  title: string;
  status: 'open' | 'closed' | 'resolved';
  category: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface ApiQueryAidResponse {
  results: AidRecordSummary[];
}

export interface IndexerNormalizedAidEvent {
  eventId: string;
  atUri: string;
  authorDid: string;
  normalizedAt: string;
  domain: Extract<DomainName, 'aid-records' | 'geo' | 'ranking' | 'directory'>;
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
            radiusKm: 5,
            categories: ['food'],
            urgency: 'high',
            status: 'open',
        } satisfies AidFeedQueryRequest,
        response: {
            requestId: 'stub-request-id',
            total: 0,
            items: [],
        } satisfies AidFeedQueryResponse,
    },
    indexer: {
        event: {
            type: 'firehose.normalized',
            recordUri: 'at://did:example:alice/app.mutualhub.aid.post/abc123',
            authorDid: 'did:example:alice',
            indexedAt: new Date(0).toISOString(),
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
