import {
  type VolunteerProfileLexiconRecord,
  atLexiconCollections,
  validateRecord,
} from "@mutual-hub/at-lexicons";
import { type AidCategory, aidCategories } from "@mutual-hub/shared";

const didPattern = /^did:[a-z0-9:._%-]+$/i;

export const verificationCheckpointKeys = [
  "identity_check",
  "safety_training",
  "community_reference",
] as const;

export type VolunteerVerificationCheckpointKey = (typeof verificationCheckpointKeys)[number];

export const verificationCheckpointStatuses = ["pending", "approved", "rejected"] as const;

export type VolunteerVerificationCheckpointStatus = (typeof verificationCheckpointStatuses)[number];

export interface VolunteerVerificationCheckpoint {
  key: VolunteerVerificationCheckpointKey;
  status: VolunteerVerificationCheckpointStatus;
  reviewedAt?: string;
  note?: string;
}

export interface VolunteerOnboardingDraft {
  did: string;
  displayName: string;
  skills: string[];
  availability: string[];
  preferredAidCategories: AidCategory[];
  checkpoints: VolunteerVerificationCheckpoint[];
}

interface NormalizedVolunteerOnboardingDraft extends VolunteerOnboardingDraft {
  did: `did:${string}`;
  displayName: string;
  skills: string[];
  availability: string[];
  preferredAidCategories: AidCategory[];
  checkpoints: VolunteerVerificationCheckpoint[];
}

export interface VolunteerCheckpointSummary {
  approved: number;
  pending: number;
  rejected: number;
}

export interface VolunteerOnboardingPayload {
  record: VolunteerProfileLexiconRecord;
  metadata: {
    checkpoints: readonly VolunteerVerificationCheckpoint[];
    checkpointSummary: VolunteerCheckpointSummary;
  };
}

export interface VolunteerOnboardingValidationIssue {
  field:
    | "did"
    | "displayName"
    | "skills"
    | "availability"
    | "preferredAidCategories"
    | "checkpoints";
  message: string;
}

export interface VolunteerOnboardingValidationResult {
  ok: boolean;
  errors: readonly VolunteerOnboardingValidationIssue[];
  normalizedDraft?: NormalizedVolunteerOnboardingDraft;
}

export class VolunteerOnboardingValidationError extends Error {
  constructor(readonly issues: readonly VolunteerOnboardingValidationIssue[]) {
    super("Volunteer onboarding validation failed");
    this.name = "VolunteerOnboardingValidationError";
  }
}

function normalizeTextList(values: readonly string[], maxItems: number): string[] {
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

  return [...deduped.values()].slice(0, maxItems);
}

function normalizePreferredAidCategories(
  preferredAidCategories: readonly AidCategory[],
): AidCategory[] {
  const deduped = new Set<AidCategory>();

  for (const category of preferredAidCategories) {
    if (aidCategories.includes(category)) {
      deduped.add(category);
    }
  }

  return [...deduped];
}

function normalizeCheckpoint(
  checkpoint: VolunteerVerificationCheckpoint,
): VolunteerVerificationCheckpoint {
  const reviewedAt = checkpoint.reviewedAt?.trim();
  const note = checkpoint.note?.trim();

  return {
    key: checkpoint.key,
    status: checkpoint.status,
    reviewedAt: reviewedAt && reviewedAt.length > 0 ? reviewedAt : undefined,
    note: note && note.length > 0 ? note : undefined,
  };
}

function normalizeCheckpoints(
  checkpoints: readonly VolunteerVerificationCheckpoint[],
): VolunteerVerificationCheckpoint[] {
  const byKey = new Map<VolunteerVerificationCheckpointKey, VolunteerVerificationCheckpoint>();

  for (const checkpoint of checkpoints) {
    if (
      verificationCheckpointKeys.includes(checkpoint.key) &&
      verificationCheckpointStatuses.includes(checkpoint.status)
    ) {
      byKey.set(checkpoint.key, normalizeCheckpoint(checkpoint));
    }
  }

  return verificationCheckpointKeys.map((key) => {
    const existing = byKey.get(key);
    if (existing) {
      return existing;
    }

    return {
      key,
      status: "pending" as const,
    };
  });
}

function summarizeCheckpoints(
  checkpoints: readonly VolunteerVerificationCheckpoint[],
): VolunteerCheckpointSummary {
  return checkpoints.reduce<VolunteerCheckpointSummary>(
    (summary, checkpoint) => {
      if (checkpoint.status === "approved") {
        summary.approved += 1;
      } else if (checkpoint.status === "rejected") {
        summary.rejected += 1;
      } else {
        summary.pending += 1;
      }

      return summary;
    },
    {
      approved: 0,
      pending: 0,
      rejected: 0,
    },
  );
}

export function isVolunteerFullyVerified(
  checkpoints: readonly VolunteerVerificationCheckpoint[],
): boolean {
  const summary = summarizeCheckpoints(checkpoints);
  return summary.rejected === 0 && summary.pending === 0;
}

export function validateVolunteerOnboardingDraft(
  draft: VolunteerOnboardingDraft,
): VolunteerOnboardingValidationResult {
  const errors: VolunteerOnboardingValidationIssue[] = [];
  const did = draft.did.trim();
  const displayName = draft.displayName.trim();
  const skills = normalizeTextList(draft.skills, 50);
  const availability = normalizeTextList(draft.availability, 30);
  const preferredAidCategories = normalizePreferredAidCategories(draft.preferredAidCategories);
  const checkpoints = normalizeCheckpoints(draft.checkpoints);

  if (!didPattern.test(did)) {
    errors.push({
      field: "did",
      message: "DID is required and must use a valid did:* format",
    });
  }

  if (displayName.length === 0 || displayName.length > 120) {
    errors.push({
      field: "displayName",
      message: "Display name is required and must be <= 120 characters",
    });
  }

  if (skills.length === 0 || skills.some((skill) => skill.length > 64)) {
    errors.push({
      field: "skills",
      message: "At least one skill is required and each skill must be <= 64 characters",
    });
  }

  if (availability.length === 0 || availability.some((slot) => slot.length > 64)) {
    errors.push({
      field: "availability",
      message:
        "At least one availability window is required and each value must be <= 64 characters",
    });
  }

  if (
    preferredAidCategories.length === 0 ||
    preferredAidCategories.some((category) => !aidCategories.includes(category))
  ) {
    errors.push({
      field: "preferredAidCategories",
      message: "Preferred aid categories must include at least one valid category",
    });
  }

  for (const checkpoint of checkpoints) {
    if (checkpoint.reviewedAt !== undefined && Number.isNaN(Date.parse(checkpoint.reviewedAt))) {
      errors.push({
        field: "checkpoints",
        message: `Checkpoint ${checkpoint.key} has an invalid reviewedAt timestamp`,
      });
      break;
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    errors: [],
    normalizedDraft: {
      did: did as `did:${string}`,
      displayName,
      skills,
      availability,
      preferredAidCategories,
      checkpoints,
    },
  };
}

function ensureDraftIsValid(draft: VolunteerOnboardingDraft): NormalizedVolunteerOnboardingDraft {
  const result = validateVolunteerOnboardingDraft(draft);
  if (!result.ok || !result.normalizedDraft) {
    throw new VolunteerOnboardingValidationError(result.errors);
  }

  return result.normalizedDraft;
}

function buildRecordFromNormalizedDraft(params: {
  draft: NormalizedVolunteerOnboardingDraft;
  createdAt: string;
  updatedAt: string;
}): VolunteerProfileLexiconRecord {
  const { draft, createdAt, updatedAt } = params;
  const verified = isVolunteerFullyVerified(draft.checkpoints);

  return validateRecord(atLexiconCollections.volunteerProfile, {
    did: draft.did,
    displayName: draft.displayName,
    skills: draft.skills,
    availability: draft.availability,
    verified,
    preferredAidCategories: draft.preferredAidCategories,
    createdAt,
    updatedAt,
  });
}

export function buildVolunteerProfileCreatePayload(
  draft: VolunteerOnboardingDraft,
  options: { now?: string } = {},
): VolunteerOnboardingPayload {
  const normalizedDraft = ensureDraftIsValid(draft);
  const now = options.now ?? new Date().toISOString();
  const record = buildRecordFromNormalizedDraft({
    draft: normalizedDraft,
    createdAt: now,
    updatedAt: now,
  });

  return {
    record,
    metadata: {
      checkpoints: normalizedDraft.checkpoints,
      checkpointSummary: summarizeCheckpoints(normalizedDraft.checkpoints),
    },
  };
}

export function buildVolunteerProfileEditPayload(
  existingRecord: VolunteerProfileLexiconRecord,
  draft: VolunteerOnboardingDraft,
  options: { updatedAt?: string } = {},
): VolunteerOnboardingPayload {
  const normalizedDraft = ensureDraftIsValid(draft);
  const updatedAt = options.updatedAt ?? new Date().toISOString();

  const record = buildRecordFromNormalizedDraft({
    draft: {
      ...normalizedDraft,
      did: existingRecord.did as `did:${string}`,
    },
    createdAt: existingRecord.createdAt,
    updatedAt,
  });

  return {
    record,
    metadata: {
      checkpoints: normalizedDraft.checkpoints,
      checkpointSummary: summarizeCheckpoints(normalizedDraft.checkpoints),
    },
  };
}

export function toVolunteerOnboardingDraftFromRecord(
  record: VolunteerProfileLexiconRecord,
  metadata: {
    checkpoints?: readonly VolunteerVerificationCheckpoint[];
  } = {},
): VolunteerOnboardingDraft {
  return {
    did: record.did,
    displayName: record.displayName,
    skills: [...record.skills],
    availability: [...record.availability],
    preferredAidCategories: record.preferredAidCategories.filter(
      (category): category is AidCategory => aidCategories.includes(category as AidCategory),
    ) as AidCategory[],
    checkpoints: normalizeCheckpoints(metadata.checkpoints ?? []),
  };
}
