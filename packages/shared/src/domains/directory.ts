import type { ApproximateLocation } from './geo.js';

export type DirectoryResourceType =
    | 'shelter'
    | 'clinic'
    | 'food_bank'
    | 'support_service';

export interface DirectoryResource {
    id: string;
    name: string;
    type: DirectoryResourceType;
    location: ApproximateLocation;
    openHours?: string;
    eligibilityNotes?: string;
}
