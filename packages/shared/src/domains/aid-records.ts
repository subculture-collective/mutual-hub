import type { ApproximateLocation } from './geo.js';
import type { Did } from './identity.js';
import type { AppealStatus, ModerationVisibilityState } from './moderation.js';

export const aidCategories = [
    'food',
    'shelter',
    'medical',
    'transport',
    'childcare',
    'supplies',
    'other',
] as const;

export type AidCategory = (typeof aidCategories)[number];
export type AidStatus = 'open' | 'in_progress' | 'closed';

export interface AidPostModerationState {
    visibility: ModerationVisibilityState;
    appealStatus: AppealStatus;
    updatedAt: string;
}

export interface AidPostRecord {
    id: string;
    title: string;
    description: string;
    category: AidCategory;
    urgency: 1 | 2 | 3 | 4 | 5;
    status: AidStatus;
    createdAt: string;
    updatedAt: string;
    location?: ApproximateLocation;
    accessibilityTags: string[];
}

export interface AidPostSummary extends AidPostRecord {
    uri: string;
    authorDid: Did;
    moderation?: AidPostModerationState;
}
