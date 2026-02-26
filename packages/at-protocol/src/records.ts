import {
    type AtCollectionName,
    type AtRecordForCollection,
    AtRecordValidationError,
    isKnownCollection,
    validateRecord,
} from '@mutual-hub/at-lexicons';
import type { Did } from '@mutual-hub/shared';

import { assertDid } from './auth.js';

const atUriPattern = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/;

export type RecordUri = `at://${string}/${string}/${string}`;

export interface ParsedRecordUri {
    repoDid: Did;
    collection: AtCollectionName;
    rkey: string;
}

export interface StoredAtRecord<C extends AtCollectionName = AtCollectionName> {
    uri: RecordUri;
    repoDid: Did;
    collection: C;
    rkey: string;
    value: AtRecordForCollection<C>;
    version: number;
    createdAt: string;
    updatedAt: string;
}

export interface RecordTombstone {
    uri: RecordUri;
    repoDid: Did;
    collection: AtCollectionName;
    rkey: string;
    deletedAt: string;
    reason?: string;
}

export interface CreateRecordInput<C extends AtCollectionName> {
    repoDid: Did;
    collection: C;
    rkey: string;
    record: unknown;
    createdAt?: string;
}

export interface UpdateRecordInput {
    uri: RecordUri;
    record: unknown;
    updatedAt?: string;
}

export interface DeleteRecordInput {
    uri: RecordUri;
    deletedAt?: string;
    reason?: string;
}

export function createRecordUri(
    repoDid: Did,
    collection: AtCollectionName,
    rkey: string,
): RecordUri {
    assertDid(repoDid);
    if (!rkey || rkey.includes('/')) {
        throw new Error("Record key must be non-empty and cannot contain '/'");
    }

    return `at://${repoDid}/${collection}/${rkey}`;
}

export function parseRecordUri(uri: string): ParsedRecordUri {
    const match = uri.match(atUriPattern);
    if (!match) {
        throw new Error(`Invalid AT record URI: ${uri}`);
    }

    const [, rawDid, rawCollection, rkey] = match;
    assertDid(rawDid);

    if (!isKnownCollection(rawCollection)) {
        throw new Error(`Unknown AT collection in URI: ${rawCollection}`);
    }

    return {
        repoDid: rawDid,
        collection: rawCollection,
        rkey,
    };
}

export class AtRecordRepository {
    private readonly records = new Map<RecordUri, StoredAtRecord>();
    private readonly tombstones = new Map<RecordUri, RecordTombstone>();

    createRecord<C extends AtCollectionName>(
        input: CreateRecordInput<C>,
    ): StoredAtRecord<C> {
        const uri = createRecordUri(
            input.repoDid,
            input.collection,
            input.rkey,
        );
        if (this.records.has(uri) && !this.tombstones.has(uri)) {
            throw new Error(`Record already exists at URI: ${uri}`);
        }

        const nowIso = input.createdAt ?? new Date().toISOString();
        const parsed = validateRecord(input.collection, input.record);

        const stored: StoredAtRecord<C> = {
            uri,
            repoDid: input.repoDid,
            collection: input.collection,
            rkey: input.rkey,
            value: parsed,
            version: 1,
            createdAt: nowIso,
            updatedAt: nowIso,
        };

        this.records.set(uri, stored);
        this.tombstones.delete(uri);
        return stored;
    }

    updateRecord(input: UpdateRecordInput): StoredAtRecord {
        if (this.tombstones.has(input.uri)) {
            throw new Error(
                `Cannot update tombstoned record at URI: ${input.uri}`,
            );
        }

        const existing = this.records.get(input.uri);
        if (!existing) {
            throw new Error(
                `Cannot update missing record at URI: ${input.uri}`,
            );
        }

        const parsed = validateRecord(existing.collection, input.record);
        const updated: StoredAtRecord = {
            ...existing,
            value: parsed,
            version: existing.version + 1,
            updatedAt: input.updatedAt ?? new Date().toISOString(),
        };

        this.records.set(input.uri, updated);
        return updated;
    }

    deleteRecord(input: DeleteRecordInput): RecordTombstone {
        const parsedUri = parseRecordUri(input.uri);

        const tombstone: RecordTombstone = {
            uri: input.uri,
            repoDid: parsedUri.repoDid,
            collection: parsedUri.collection,
            rkey: parsedUri.rkey,
            deletedAt: input.deletedAt ?? new Date().toISOString(),
            reason: input.reason,
        };

        this.records.delete(input.uri);
        this.tombstones.set(input.uri, tombstone);
        return tombstone;
    }

    getRecord(uri: RecordUri): StoredAtRecord | undefined {
        if (this.tombstones.has(uri)) {
            return undefined;
        }

        return this.records.get(uri);
    }

    getTombstone(uri: RecordUri): RecordTombstone | undefined {
        return this.tombstones.get(uri);
    }

    listRecords(collection?: AtCollectionName): StoredAtRecord[] {
        return [...this.records.values()].filter(record => {
            if (this.tombstones.has(record.uri)) {
                return false;
            }

            if (collection && record.collection !== collection) {
                return false;
            }

            return true;
        });
    }

    listTombstones(collection?: AtCollectionName): RecordTombstone[] {
        return [...this.tombstones.values()].filter(tombstone => {
            if (collection && tombstone.collection !== collection) {
                return false;
            }

            return true;
        });
    }
}

export function isRecordValidationError(
    error: unknown,
): error is AtRecordValidationError {
    return error instanceof AtRecordValidationError;
}
