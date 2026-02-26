import {
  type AidPostLexiconRecord,
  atLexiconCollections,
  validateRecord,
} from "@mutual-hub/at-lexicons";
import {
  type AidCategory,
  type AidPostRecord,
  type ApproximateLocation,
  aidCategories,
  enforceMinimumPublicPrecision,
} from "@mutual-hub/shared";

const minimumPublicPrecisionMeters = 300;

export interface AidRequestTimeWindow {
  startAt: string;
  endAt: string;
  timezone?: string;
}

export interface AidPostingDraft {
  id?: string;
  title: string;
  description: string;
  category?: AidCategory;
  urgency?: 1 | 2 | 3 | 4 | 5;
  accessibilityTags: string[];
  location?: ApproximateLocation;
  timeWindow?: AidRequestTimeWindow;
}

interface NormalizedAidPostingDraft extends AidPostingDraft {
  category: AidCategory;
  urgency: 1 | 2 | 3 | 4 | 5;
  timeWindow: AidRequestTimeWindow;
  title: string;
  description: string;
  accessibilityTags: string[];
}

export interface AidPostingPayload {
  record: AidPostLexiconRecord;
  metadata: {
    timeWindow: AidRequestTimeWindow;
  };
}

export interface PostingValidationIssue {
  field:
    | "title"
    | "description"
    | "category"
    | "urgency"
    | "accessibilityTags"
    | "location"
    | "timeWindow";
  message: string;
}

export interface PostingValidationResult {
  ok: boolean;
  errors: readonly PostingValidationIssue[];
  normalizedDraft?: NormalizedAidPostingDraft;
}

export class PostingValidationError extends Error {
  constructor(readonly issues: readonly PostingValidationIssue[]) {
    super("Posting draft validation failed");
    this.name = "PostingValidationError";
  }
}

function normalizeAccessibilityTags(tags: readonly string[]): string[] {
  const deduped = new Map<string, string>();

  for (const rawTag of tags) {
    const tag = rawTag.trim();
    if (tag.length === 0) {
      continue;
    }

    const key = tag.toLowerCase();
    if (!deduped.has(key)) {
      deduped.set(key, tag);
    }
  }

  return [...deduped.values()];
}

function normalizeLocation(
  location: ApproximateLocation | undefined,
): ApproximateLocation | undefined {
  if (!location) {
    return undefined;
  }

  if (
    !Number.isFinite(location.lat) ||
    !Number.isFinite(location.lng) ||
    !Number.isFinite(location.precisionMeters)
  ) {
    return undefined;
  }

  if (location.lat < -90 || location.lat > 90 || location.lng < -180 || location.lng > 180) {
    return undefined;
  }

  return enforceMinimumPublicPrecision(
    {
      lat: Number(location.lat.toFixed(6)),
      lng: Number(location.lng.toFixed(6)),
      precisionMeters: Math.round(location.precisionMeters),
      areaLabel: location.areaLabel?.trim() || undefined,
    },
    minimumPublicPrecisionMeters,
  );
}

function normalizeTimeWindow(
  timeWindow: AidRequestTimeWindow | undefined,
): AidRequestTimeWindow | undefined {
  if (!timeWindow) {
    return undefined;
  }

  const startMs = Date.parse(timeWindow.startAt);
  const endMs = Date.parse(timeWindow.endAt);

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return undefined;
  }

  return {
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(endMs).toISOString(),
    timezone: timeWindow.timezone?.trim() || undefined,
  };
}

export function validatePostingDraft(draft: AidPostingDraft): PostingValidationResult {
  const errors: PostingValidationIssue[] = [];
  const title = draft.title.trim();
  const description = draft.description.trim();
  const tags = normalizeAccessibilityTags(draft.accessibilityTags);
  const location = normalizeLocation(draft.location);
  const timeWindow = normalizeTimeWindow(draft.timeWindow);

  if (title.length === 0 || title.length > 180) {
    errors.push({
      field: "title",
      message: "Title is required and must be at most 180 characters",
    });
  }

  if (description.length === 0 || description.length > 4000) {
    errors.push({
      field: "description",
      message: "Description is required and must be at most 4000 characters",
    });
  }

  if (!draft.category || !aidCategories.includes(draft.category)) {
    errors.push({
      field: "category",
      message: "Category must match the supported taxonomy",
    });
  }

  if (!draft.urgency || draft.urgency < 1 || draft.urgency > 5) {
    errors.push({
      field: "urgency",
      message: "Urgency must be between 1 and 5",
    });
  }

  if (tags.length > 20 || tags.some((tag) => tag.length > 64)) {
    errors.push({
      field: "accessibilityTags",
      message: "Accessibility tags must be <= 20 items and each <= 64 chars",
    });
  }

  if (draft.location && !location) {
    errors.push({
      field: "location",
      message: "Location must contain valid coordinates and precision",
    });
  }

  if (!timeWindow) {
    errors.push({
      field: "timeWindow",
      message: "Time window is required and must use valid timestamps",
    });
  } else {
    const startMs = Date.parse(timeWindow.startAt);
    const endMs = Date.parse(timeWindow.endAt);
    if (endMs <= startMs) {
      errors.push({
        field: "timeWindow",
        message: "Time window end must be after start",
      });
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
    };
  }

  if (!draft.category || draft.urgency === undefined || !timeWindow) {
    return {
      ok: false,
      errors: [
        {
          field: "category",
          message: "Category, urgency, and time window must be present",
        },
      ],
    };
  }

  const category = draft.category;
  const urgency = draft.urgency;

  return {
    ok: true,
    errors: [],
    normalizedDraft: {
      id: draft.id,
      title,
      description,
      category,
      urgency,
      accessibilityTags: tags,
      location,
      timeWindow,
    },
  };
}

function ensureDraftIsValid(draft: AidPostingDraft): NormalizedAidPostingDraft {
  const result = validatePostingDraft(draft);
  if (!result.ok || !result.normalizedDraft) {
    throw new PostingValidationError(result.errors);
  }

  return result.normalizedDraft;
}

function createRecordFromValidatedDraft(params: {
  draft: NormalizedAidPostingDraft;
  id: string;
  createdAt: string;
  updatedAt: string;
  status: AidPostRecord["status"];
}): AidPostLexiconRecord {
  const { draft, id, createdAt, updatedAt, status } = params;

  const candidate: AidPostLexiconRecord = {
    id,
    title: draft.title,
    description: draft.description,
    category: draft.category,
    urgency: draft.urgency,
    status,
    createdAt,
    updatedAt,
    location: draft.location,
    accessibilityTags: draft.accessibilityTags,
  };

  return validateRecord(atLexiconCollections.aidPost, candidate);
}

export function buildAidPostCreatePayload(
  draft: AidPostingDraft,
  options: {
    now?: string;
    idGenerator?: () => string;
  } = {},
): AidPostingPayload {
  const normalizedDraft = ensureDraftIsValid(draft);
  const now = options.now ?? new Date().toISOString();
  const id = normalizedDraft.id ?? options.idGenerator?.() ?? `post-${Date.now()}`;
  const record = createRecordFromValidatedDraft({
    draft: normalizedDraft,
    id,
    createdAt: now,
    updatedAt: now,
    status: "open",
  });

  return {
    record,
    metadata: {
      timeWindow: normalizedDraft.timeWindow,
    },
  };
}

export function buildAidPostEditPayload(
  existingRecord: AidPostLexiconRecord,
  draft: AidPostingDraft,
  options: {
    updatedAt?: string;
  } = {},
): AidPostingPayload {
  const normalizedDraft = ensureDraftIsValid(draft);
  const updatedAt = options.updatedAt ?? new Date().toISOString();

  const record = createRecordFromValidatedDraft({
    draft: {
      ...normalizedDraft,
      id: existingRecord.id,
    },
    id: existingRecord.id,
    createdAt: existingRecord.createdAt,
    updatedAt,
    status: existingRecord.status,
  });

  return {
    record,
    metadata: {
      timeWindow: normalizedDraft.timeWindow,
    },
  };
}

export function toPostingDraftFromRecord(
  record: AidPostLexiconRecord,
  metadata: { timeWindow?: AidRequestTimeWindow } = {},
): AidPostingDraft {
  const urgency =
    record.urgency >= 1 && record.urgency <= 5 ? (record.urgency as 1 | 2 | 3 | 4 | 5) : undefined;

  return {
    id: record.id,
    title: record.title,
    description: record.description,
    category: record.category,
    urgency,
    accessibilityTags: [...record.accessibilityTags],
    location: record.location,
    timeWindow: metadata.timeWindow,
  };
}
