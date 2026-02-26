import type { Did } from './identity.js';

export type ConversationState =
    | 'open'
    | 'handoff_suggested'
    | 'resolved'
    | 'blocked';

export interface ConversationMetadata {
    id: string;
    postUri: string;
    requesterDid: Did;
    recipientDid: Did;
    state: ConversationState;
    createdAt: string;
    updatedAt: string;
}
