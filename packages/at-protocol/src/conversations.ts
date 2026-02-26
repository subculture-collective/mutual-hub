import {
    type ConversationMetadataLexiconRecord,
    atLexiconCollections,
} from '@mutual-hub/at-lexicons';
import type {
    ChatFallbackReason,
    ChatTransportMode,
    ConversationMetadata,
    ConversationState,
    Did,
} from '@mutual-hub/shared';

import {
    AtRecordRepository,
    type RecordUri,
    type StoredAtRecord,
    createRecordUri,
} from './records.js';

export interface RecipientTransportCapabilityInput {
    recipientDid: Did;
    supportsAtNativeTransport: boolean;
    fallbackReason?: ChatFallbackReason;
}

export interface RecipientTransportCapabilityResult {
    recipientDid: Did;
    mode: ChatTransportMode;
    fallbackReason?: ChatFallbackReason;
    notice: string;
}

export interface UpsertConversationMetadataInput {
    repoDid: Did;
    record: ConversationMetadataLexiconRecord;
    rkey?: string;
}

export interface ConversationMetadataAuditRecord {
    uri: RecordUri;
    version: number;
    record: ConversationMetadataLexiconRecord;
}

export interface ConversationMetadataAuditQuery {
    participantDid?: Did;
    state?: ConversationState;
    postUri?: string;
    transportMode?: ChatTransportMode;
    fallbackOnly?: boolean;
}

export function toConversationMetadataLexiconRecord(
    metadata: ConversationMetadata,
): ConversationMetadataLexiconRecord {
    return {
        id: metadata.id,
        postUri: metadata.postUri,
        requesterDid: metadata.requesterDid,
        recipientDid: metadata.recipientDid,
        state: metadata.state,
        requestContext: metadata.requestContext,
        routingDestinationType: metadata.routing?.destinationType,
        routingDestinationId: metadata.routing?.destinationId,
        routingRationale: metadata.routing?.rationale,
        transportMode: metadata.transport?.mode,
        fallbackReason: metadata.transport?.fallbackReason,
        fallbackNotice: metadata.transport?.fallbackNotice,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
    };
}

export function fromConversationMetadataLexiconRecord(
    record: ConversationMetadataLexiconRecord,
): ConversationMetadata {
    const requestContext =
        record.requestContext === undefined ?
            undefined
        :   {
                ...record.requestContext,
                urgency: record.requestContext.urgency as 1 | 2 | 3 | 4 | 5,
            };

    return {
        id: record.id,
        postUri: record.postUri,
        requesterDid: record.requesterDid as Did,
        recipientDid: record.recipientDid as Did,
        state: record.state,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        requestContext,
        routing:
            record.routingDestinationType && record.routingRationale ?
                {
                    destinationType: record.routingDestinationType,
                    destinationId: record.routingDestinationId,
                    rationale: record.routingRationale,
                }
            :   undefined,
        transport:
            record.transportMode ?
                {
                    mode: record.transportMode,
                    fallbackReason: record.fallbackReason,
                    fallbackNotice: record.fallbackNotice,
                }
            :   undefined,
    };
}

function sortAuditRecords(
    left: ConversationMetadataAuditRecord,
    right: ConversationMetadataAuditRecord,
): number {
    const leftMs = Date.parse(left.record.updatedAt);
    const rightMs = Date.parse(right.record.updatedAt);
    const safeLeft = Number.isNaN(leftMs) ? 0 : leftMs;
    const safeRight = Number.isNaN(rightMs) ? 0 : rightMs;

    if (safeLeft !== safeRight) {
        return safeRight - safeLeft;
    }

    return left.record.id.localeCompare(right.record.id);
}

export function resolveRecipientTransportCapability(
    input: RecipientTransportCapabilityInput,
): RecipientTransportCapabilityResult {
    if (input.supportsAtNativeTransport) {
        return {
            recipientDid: input.recipientDid,
            mode: 'atproto_native',
            notice: 'Recipient supports AT-native messaging transport.',
        };
    }

    const fallbackReason = input.fallbackReason ?? 'recipient_unsupported';
    return {
        recipientDid: input.recipientDid,
        mode: 'fallback_notice',
        fallbackReason,
        notice: 'Recipient cannot receive AT-native messages right now. Continue only with a safe fallback handoff path.',
    };
}

export class ConversationMetadataRepository {
    constructor(private readonly records = new AtRecordRepository()) {}

    upsertMetadata(
        input: UpsertConversationMetadataInput,
    ): StoredAtRecord<typeof atLexiconCollections.conversationMetadata> {
        const rkey = input.rkey ?? input.record.id;
        const uri = createRecordUri(
            input.repoDid,
            atLexiconCollections.conversationMetadata,
            rkey,
        );
        const existing = this.records.getRecord(uri);

        if (existing) {
            return this.records.updateRecord({
                uri,
                record: input.record,
                updatedAt: input.record.updatedAt,
            }) as StoredAtRecord<
                typeof atLexiconCollections.conversationMetadata
            >;
        }

        return this.records.createRecord({
            repoDid: input.repoDid,
            collection: atLexiconCollections.conversationMetadata,
            rkey,
            record: input.record,
            createdAt: input.record.createdAt,
        });
    }

    getMetadata(uri: RecordUri): ConversationMetadataAuditRecord | undefined {
        const record = this.records.getRecord(uri);
        if (!record) {
            return undefined;
        }

        return {
            uri,
            version: record.version,
            record: record.value as ConversationMetadataLexiconRecord,
        };
    }

    listForAudit(
        query: ConversationMetadataAuditQuery = {},
    ): ConversationMetadataAuditRecord[] {
        return this.records
            .listRecords(atLexiconCollections.conversationMetadata)
            .map(record => ({
                uri: record.uri,
                version: record.version,
                record: record.value as ConversationMetadataLexiconRecord,
            }))
            .filter(({ record }) => {
                if (
                    query.participantDid &&
                    record.requesterDid !== query.participantDid &&
                    record.recipientDid !== query.participantDid
                ) {
                    return false;
                }

                if (query.state && record.state !== query.state) {
                    return false;
                }

                if (query.postUri && record.postUri !== query.postUri) {
                    return false;
                }

                if (
                    query.transportMode &&
                    record.transportMode !== query.transportMode
                ) {
                    return false;
                }

                if (
                    query.fallbackOnly &&
                    record.transportMode !== 'fallback_notice'
                ) {
                    return false;
                }

                return true;
            })
            .sort(sortAuditRecords);
    }
}
