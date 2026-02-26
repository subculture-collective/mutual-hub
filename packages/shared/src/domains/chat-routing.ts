import type { AidCategory } from "./aid-records.js";
import type { DirectoryResourceType } from "./directory.js";
import type { Did } from "./identity.js";

export type RoutingDestinationType =
  | "post_author"
  | "volunteer_pool"
  | "resource_directory"
  | "manual_review";

export interface RoutingVolunteerCandidate {
  did: Did;
  verified: boolean;
  acceptsChats: boolean;
  supportedCategories: readonly AidCategory[];
  preferredAidCategories?: readonly AidCategory[];
  skills?: readonly string[];
  availabilityTags?: readonly string[];
  preferenceBoost?: number;
  distanceMeters?: number;
  lastActiveAt?: string;
}

export interface RoutingResourceCandidate {
  id: string;
  uri: string;
  type: DirectoryResourceType;
  verified: boolean;
  acceptsIntake: boolean;
  supportedCategories?: readonly AidCategory[];
  priority?: number;
}

export interface RoutingDecisionInput {
  requesterDid: Did;
  postAuthorDid: Did;
  postUri: string;
  postCategory: AidCategory;
  requiredVolunteerSkills?: readonly string[];
  requestAvailabilityTag?: string;
  postAuthorReachable: boolean;
  postAuthorBlocked?: boolean;
  volunteerCandidates?: readonly RoutingVolunteerCandidate[];
  resourceCandidates?: readonly RoutingResourceCandidate[];
}

export interface RoutingRuleTrace {
  rule: string;
  priority: number;
  matched: boolean;
  detail: string;
  candidateId?: string;
}

export interface RoutingMachineRationale {
  selectedRule: string;
  selectedPriority: number;
  traces: readonly RoutingRuleTrace[];
}

export interface RoutingDecision {
  destinationType: RoutingDestinationType;
  destinationId?: string;
  destinationUri?: string;
  fallbackHierarchy: readonly RoutingDestinationType[];
  humanRationale: string;
  machineRationale: RoutingMachineRationale;
}

export const routingFallbackHierarchy: readonly RoutingDestinationType[] = [
  "post_author",
  "volunteer_pool",
  "resource_directory",
  "manual_review",
];

function byAscNumber(left: number | undefined, right: number | undefined): number {
  const leftValue = left ?? Number.POSITIVE_INFINITY;
  const rightValue = right ?? Number.POSITIVE_INFINITY;
  return leftValue - rightValue;
}

function byDescTimestamp(left: string | undefined, right: string | undefined): number {
  const leftMs = left ? Date.parse(left) : Number.NaN;
  const rightMs = right ? Date.parse(right) : Number.NaN;
  const safeLeft = Number.isNaN(leftMs) ? 0 : leftMs;
  const safeRight = Number.isNaN(rightMs) ? 0 : rightMs;
  return safeRight - safeLeft;
}

function selectVolunteer(
  candidates: readonly RoutingVolunteerCandidate[],
  input: RoutingDecisionInput,
): RoutingVolunteerCandidate | undefined {
  const requestedSkills = new Set(
    (input.requiredVolunteerSkills ?? [])
      .map((skill) => skill.trim().toLowerCase())
      .filter((skill) => skill.length > 0),
  );
  const requestedAvailability = input.requestAvailabilityTag?.trim().toLowerCase();

  function byDescNumber(left: number, right: number): number {
    return right - left;
  }

  function toLowerTokens(values: readonly string[] | undefined): string[] {
    if (!values) {
      return [];
    }

    return values.map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0);
  }

  function countSkillMatches(candidate: RoutingVolunteerCandidate): number {
    if (requestedSkills.size === 0) {
      return 0;
    }

    const candidateSkills = toLowerTokens(candidate.skills);
    return candidateSkills.reduce(
      (count, skill) => count + (requestedSkills.has(skill) ? 1 : 0),
      0,
    );
  }

  function availabilityMatches(candidate: RoutingVolunteerCandidate): boolean {
    if (!requestedAvailability) {
      return false;
    }

    return toLowerTokens(candidate.availabilityTags).includes(requestedAvailability);
  }

  function preferredCategoryMatches(candidate: RoutingVolunteerCandidate): boolean {
    return candidate.preferredAidCategories?.includes(input.postCategory) ?? false;
  }

  return candidates
    .filter((candidate) => {
      if (!candidate.verified || !candidate.acceptsChats) {
        return false;
      }

      return candidate.supportedCategories.includes(input.postCategory);
    })
    .sort((left, right) => {
      const preferenceBoostOrder = byDescNumber(
        left.preferenceBoost ?? 0,
        right.preferenceBoost ?? 0,
      );
      if (preferenceBoostOrder !== 0) {
        return preferenceBoostOrder;
      }

      const preferredCategoryOrder = byDescNumber(
        Number(preferredCategoryMatches(left)),
        Number(preferredCategoryMatches(right)),
      );
      if (preferredCategoryOrder !== 0) {
        return preferredCategoryOrder;
      }

      const availabilityOrder = byDescNumber(
        Number(availabilityMatches(left)),
        Number(availabilityMatches(right)),
      );
      if (availabilityOrder !== 0) {
        return availabilityOrder;
      }

      const skillMatchOrder = byDescNumber(countSkillMatches(left), countSkillMatches(right));
      if (skillMatchOrder !== 0) {
        return skillMatchOrder;
      }

      const distanceOrder = byAscNumber(left.distanceMeters, right.distanceMeters);
      if (distanceOrder !== 0) {
        return distanceOrder;
      }

      const activityOrder = byDescTimestamp(left.lastActiveAt, right.lastActiveAt);
      if (activityOrder !== 0) {
        return activityOrder;
      }

      return left.did.localeCompare(right.did);
    })[0];
}

function selectResource(
  candidates: readonly RoutingResourceCandidate[],
  category: AidCategory,
): RoutingResourceCandidate | undefined {
  return candidates
    .filter((candidate) => {
      if (!candidate.verified || !candidate.acceptsIntake) {
        return false;
      }

      if (!candidate.supportedCategories) {
        return true;
      }

      return candidate.supportedCategories.includes(category);
    })
    .sort((left, right) => {
      const priorityOrder = byAscNumber(left.priority, right.priority);
      if (priorityOrder !== 0) {
        return priorityOrder;
      }

      const typeOrder = left.type.localeCompare(right.type);
      if (typeOrder !== 0) {
        return typeOrder;
      }

      return left.id.localeCompare(right.id);
    })[0];
}

export function decideChatRoute(input: RoutingDecisionInput): RoutingDecision {
  const traces: RoutingRuleTrace[] = [];

  const directAuthorEligible =
    input.requesterDid !== input.postAuthorDid &&
    input.postAuthorReachable &&
    !input.postAuthorBlocked;

  traces.push({
    rule: "direct_post_author",
    priority: 1,
    matched: directAuthorEligible,
    detail: directAuthorEligible
      ? "Post author is reachable and not blocked."
      : "Post author path unavailable due to reachability or policy.",
    candidateId: input.postAuthorDid,
  });

  if (directAuthorEligible) {
    return {
      destinationType: "post_author",
      destinationId: input.postAuthorDid,
      fallbackHierarchy: routingFallbackHierarchy,
      humanRationale:
        "Direct handoff selected because the post author is reachable and policy-eligible.",
      machineRationale: {
        selectedRule: "direct_post_author",
        selectedPriority: 1,
        traces,
      },
    };
  }

  const volunteer = selectVolunteer(input.volunteerCandidates ?? [], input);

  const volunteerPreferenceSignals = volunteer
    ? [
        volunteer.preferenceBoost ? `preferenceBoost=${volunteer.preferenceBoost}` : undefined,
        volunteer.preferredAidCategories?.includes(input.postCategory)
          ? `preferred category match (${input.postCategory})`
          : undefined,
        input.requestAvailabilityTag &&
        volunteer.availabilityTags
          ?.map((tag) => tag.toLowerCase())
          .includes(input.requestAvailabilityTag.toLowerCase())
          ? `availability match (${input.requestAvailabilityTag})`
          : undefined,
        input.requiredVolunteerSkills && input.requiredVolunteerSkills.length > 0
          ? `skill overlap=${
              (volunteer.skills ?? []).filter((skill) =>
                input.requiredVolunteerSkills?.some(
                  (required) => required.trim().toLowerCase() === skill.trim().toLowerCase(),
                ),
              ).length
            }`
          : undefined,
      ].filter((value): value is string => value !== undefined)
    : [];

  traces.push({
    rule: "verified_volunteer_match",
    priority: 2,
    matched: volunteer !== undefined,
    detail: volunteer
      ? volunteerPreferenceSignals.length > 0
        ? `Selected verified volunteer match for ${input.postCategory} using preference signals: ${volunteerPreferenceSignals.join(", ")}.`
        : `Selected closest verified volunteer match for ${input.postCategory}.`
      : `No verified volunteer accepted this category (${input.postCategory}).`,
    candidateId: volunteer?.did,
  });

  if (volunteer) {
    return {
      destinationType: "volunteer_pool",
      destinationId: volunteer.did,
      fallbackHierarchy: routingFallbackHierarchy,
      humanRationale:
        "Volunteer pool selected because direct author handoff is unavailable and a verified volunteer match exists.",
      machineRationale: {
        selectedRule: "verified_volunteer_match",
        selectedPriority: 2,
        traces,
      },
    };
  }

  const resource = selectResource(input.resourceCandidates ?? [], input.postCategory);

  traces.push({
    rule: "verified_resource_match",
    priority: 3,
    matched: resource !== undefined,
    detail: resource
      ? "Selected highest-priority verified resource that accepts intake."
      : "No verified resource match was available for intake.",
    candidateId: resource?.id,
  });

  if (resource) {
    return {
      destinationType: "resource_directory",
      destinationId: resource.id,
      destinationUri: resource.uri,
      fallbackHierarchy: routingFallbackHierarchy,
      humanRationale:
        "Resource directory selected as deterministic fallback after direct and volunteer paths failed.",
      machineRationale: {
        selectedRule: "verified_resource_match",
        selectedPriority: 3,
        traces,
      },
    };
  }

  traces.push({
    rule: "manual_review_fallback",
    priority: 4,
    matched: true,
    detail: "No deterministic destination available; route to manual review.",
  });

  return {
    destinationType: "manual_review",
    fallbackHierarchy: routingFallbackHierarchy,
    humanRationale:
      "No eligible destination found. Request should be escalated for manual moderation-assisted triage.",
    machineRationale: {
      selectedRule: "manual_review_fallback",
      selectedPriority: 4,
      traces,
    },
  };
}
