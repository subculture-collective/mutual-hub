import { z } from "zod";

import { type AtCollectionName, atLexiconCollections } from "./collections.js";

const didSchema = z.string().regex(/^did:[a-z0-9:._%-]+$/i, "Expected a DID string");
const atUriSchema = z.string().regex(/^at:\/\/[^/]+\/[a-z0-9.]+\/.+$/i, "Expected a valid AT URI");
const timestampSchema = z.string().datetime();

const approximateLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  precisionMeters: z.number().int().min(100).max(5000),
  areaLabel: z.string().max(200).optional(),
});

const aidCategorySchema = z.enum([
  "food",
  "shelter",
  "medical",
  "transport",
  "childcare",
  "supplies",
  "other",
]);

const aidStatusSchema = z.enum(["open", "in_progress", "closed"]);
const chatInitiationSourceSchema = z.enum(["map_detail", "feed_card", "post_detail"]);
const transportModeSchema = z.enum(["atproto_native", "fallback_notice"]);
const fallbackReasonSchema = z.enum([
  "recipient_unsupported",
  "recipient_opt_out",
  "recipient_unreachable",
]);

export const aidPostRecordSchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().min(1).max(180),
  description: z.string().min(1).max(4000),
  category: aidCategorySchema,
  urgency: z.number().int().min(1).max(5),
  status: aidStatusSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  location: approximateLocationSchema.optional(),
  accessibilityTags: z.array(z.string().max(64)).max(20),
});

export const volunteerProfileRecordSchema = z.object({
  did: didSchema,
  displayName: z.string().min(1).max(120),
  skills: z.array(z.string().max(64)).max(50),
  availability: z.array(z.string().max(64)).max(30),
  verified: z.boolean(),
  preferredAidCategories: z.array(z.string().max(64)).max(20),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const conversationMetadataRecordSchema = z.object({
  id: z.string().min(1).max(128),
  postUri: atUriSchema,
  requesterDid: didSchema,
  recipientDid: didSchema,
  state: z.enum(["open", "handoff_suggested", "resolved", "blocked"]),
  requestContext: z
    .object({
      source: chatInitiationSourceSchema,
      postTitle: z.string().min(1).max(180),
      category: aidCategorySchema,
      urgency: z.number().int().min(1).max(5),
      areaLabel: z.string().max(200).optional(),
    })
    .optional(),
  routingDestinationType: z
    .enum(["post_author", "volunteer_pool", "resource_directory", "manual_review"])
    .optional(),
  routingDestinationId: z.string().max(256).optional(),
  routingRationale: z.string().max(2000).optional(),
  transportMode: transportModeSchema.optional(),
  fallbackReason: fallbackReasonSchema.optional(),
  fallbackNotice: z.string().max(500).optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const moderationReportRecordSchema = z.object({
  id: z.string().min(1).max(128),
  targetUri: atUriSchema,
  reason: z.enum(["spam", "harassment", "fraud", "unsafe_content", "other"]),
  reporterDid: didSchema,
  details: z.string().max(2000).optional(),
  createdAt: timestampSchema,
});

export const resourceDirectoryRecordSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(180),
  type: z.enum(["shelter", "clinic", "food_bank", "support_service"]),
  location: approximateLocationSchema,
  openHours: z.string().max(500).optional(),
  eligibilityNotes: z.string().max(1000).optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type AidPostLexiconRecord = z.infer<typeof aidPostRecordSchema>;
export type VolunteerProfileLexiconRecord = z.infer<typeof volunteerProfileRecordSchema>;
export type ConversationMetadataLexiconRecord = z.infer<typeof conversationMetadataRecordSchema>;
export type ModerationReportLexiconRecord = z.infer<typeof moderationReportRecordSchema>;
export type ResourceDirectoryLexiconRecord = z.infer<typeof resourceDirectoryRecordSchema>;

export interface AtRecordByCollection {
  [atLexiconCollections.aidPost]: AidPostLexiconRecord;
  [atLexiconCollections.volunteerProfile]: VolunteerProfileLexiconRecord;
  [atLexiconCollections.conversationMetadata]: ConversationMetadataLexiconRecord;
  [atLexiconCollections.moderationReport]: ModerationReportLexiconRecord;
  [atLexiconCollections.resourceDirectory]: ResourceDirectoryLexiconRecord;
}

export type AtRecordForCollection<C extends AtCollectionName> = AtRecordByCollection[C];

export const recordSchemas: {
  [C in AtCollectionName]: z.ZodType<AtRecordByCollection[C]>;
} = {
  [atLexiconCollections.aidPost]: aidPostRecordSchema,
  [atLexiconCollections.volunteerProfile]: volunteerProfileRecordSchema,
  [atLexiconCollections.conversationMetadata]: conversationMetadataRecordSchema,
  [atLexiconCollections.moderationReport]: moderationReportRecordSchema,
  [atLexiconCollections.resourceDirectory]: resourceDirectoryRecordSchema,
};
