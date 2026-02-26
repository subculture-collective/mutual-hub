import type { Did } from './identity.js';

export interface VolunteerProfile {
    did: Did;
    displayName: string;
    skills: string[];
    availability: string[];
    verified: boolean;
    preferredAidCategories: string[];
}
