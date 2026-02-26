import {
    type AtCollectionName,
    type AtRecordForCollection,
    isKnownCollection,
    validateRecord,
} from '@mutual-hub/at-lexicons';
import type { Did } from '@mutual-hub/shared';

export type FirehoseOperation = 'create' | 'update' | 'delete';

export interface FirehoseEvent {
    op: FirehoseOperation;
    uri: string;
    record?: unknown;
    receivedAt?: string;
}

export interface ParsedFirehoseUri {
    repoDid: Did;
    collection: AtCollectionName;
    rkey: string;
}

export interface NormalizedFirehoseEvent<
    C extends AtCollectionName = AtCollectionName,
> {
    op: FirehoseOperation;
    uri: string;
    repoDid: Did;
    collection: C;
    rkey: string;
    deleted: boolean;
    record?: AtRecordForCollection<C>;
    indexedAt: string;
}

const firehoseUriPattern = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/i;
const didPattern = /^did:[a-z0-9:._%-]+$/i;

export function parseFirehoseUri(uri: string): ParsedFirehoseUri {
    const match = uri.match(firehoseUriPattern);
    if (!match) {
        throw new Error(`Invalid firehose URI format: ${uri}`);
    }

    const [, repoDid, collection, rkey] = match;
    if (!didPattern.test(repoDid)) {
        throw new Error(`Invalid DID in firehose URI: ${repoDid}`);
    }

    if (!isKnownCollection(collection)) {
        throw new Error(`Unknown collection in firehose URI: ${collection}`);
    }

    return {
        repoDid: repoDid as Did,
        collection,
        rkey,
    };
}

export function normalizeFirehoseEvent(
    event: FirehoseEvent,
): NormalizedFirehoseEvent {
    const parsedUri = parseFirehoseUri(event.uri);
    const indexedAt = event.receivedAt ?? new Date().toISOString();

    if (event.op === 'delete') {
        return {
            op: event.op,
            uri: event.uri,
            repoDid: parsedUri.repoDid,
            collection: parsedUri.collection,
            rkey: parsedUri.rkey,
            deleted: true,
            indexedAt,
        };
    }

    if (!event.record) {
        throw new Error(
            'Firehose create/update events must include a record payload',
        );
    }

    const record = validateRecord(parsedUri.collection, event.record);

    return {
        op: event.op,
        uri: event.uri,
        repoDid: parsedUri.repoDid,
        collection: parsedUri.collection,
        rkey: parsedUri.rkey,
        deleted: false,
        record,
        indexedAt,
    };
}

export function normalizeFirehoseEvents(
    events: readonly FirehoseEvent[],
): NormalizedFirehoseEvent[] {
    return events.map(event => normalizeFirehoseEvent(event));
}
