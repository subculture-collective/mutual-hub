import type { AidCategory } from "./aid-records.js";
import type { RoutingVolunteerCandidate } from "./chat-routing.js";
import type { Did } from "./identity.js";

export interface VolunteerProfile {
  did: Did;
  displayName: string;
  skills: string[];
  availability: string[];
  verified: boolean;
  preferredAidCategories: AidCategory[];
}

export interface VolunteerRoutingCandidateSeed {
  did: Did;
  acceptsChats: boolean;
  supportedCategories: readonly AidCategory[];
  distanceMeters?: number;
  lastActiveAt?: string;
  preferenceBoost?: number;
}

function normalizeStringList(values: readonly string[]): string[] {
  const deduped = new Map<string, string>();

  for (const rawValue of values) {
    const value = rawValue.trim();
    if (value.length === 0) {
      continue;
    }

    const key = value.toLowerCase();
    if (!deduped.has(key)) {
      deduped.set(key, value);
    }
  }

  return [...deduped.values()];
}

export function normalizeVolunteerProfile(profile: VolunteerProfile): VolunteerProfile {
  const preferredAidCategories = [...new Set(profile.preferredAidCategories)];

  return {
    ...profile,
    displayName: profile.displayName.trim(),
    skills: normalizeStringList(profile.skills),
    availability: normalizeStringList(profile.availability),
    preferredAidCategories,
  };
}

export function applyVolunteerProfileToRoutingCandidate(
  profile: VolunteerProfile,
  seed: VolunteerRoutingCandidateSeed,
): RoutingVolunteerCandidate {
  const normalizedProfile = normalizeVolunteerProfile(profile);

  return {
    did: seed.did,
    verified: normalizedProfile.verified,
    acceptsChats: seed.acceptsChats,
    supportedCategories: seed.supportedCategories,
    preferredAidCategories: normalizedProfile.preferredAidCategories,
    skills: normalizedProfile.skills,
    availabilityTags: normalizedProfile.availability,
    preferenceBoost: seed.preferenceBoost,
    distanceMeters: seed.distanceMeters,
    lastActiveAt: seed.lastActiveAt,
  };
}
