import { z } from 'zod';

export const recordNsid = {
    aidPost: 'app.mutualhub.aid.post',
    volunteerProfile: 'app.mutualhub.volunteer.profile',
    conversationMeta: 'app.mutualhub.conversation.meta',
    moderationReport: 'app.mutualhub.moderation.report',
    directoryResource: 'app.mutualhub.directory.resource',
} as const;

export type RecordNsid = (typeof recordNsid)[keyof typeof recordNsid];

const didSchema = z
    .string()
    .regex(/^did:[a-z0-9]+:[a-z0-9._:%-]+$/i, 'Expected a valid DID');
const atUriSchema = z
    .string()
    .regex(/^at:\/\/[^\s]+$/i, 'Expected a valid at:// URI');
const isoDateTimeSchema = z.string().datetime({ offset: true });

export const aidPostSchema = z.object({
    $type: z.literal(recordNsid.aidPost),
    version: z.literal('1.0.0'),
    title: z.string().min(1).max(140),
    description: z.string().min(1).max(5000),
    category: z.enum([
        'food',
        'shelter',
        'medical',
        'transport',
        'childcare',
        'other',
    ]),
    urgency: z.enum(['low', 'medium', 'high', 'critical']),
    status: z.enum(['open', 'in-progress', 'resolved', 'closed']),
    location: z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        precisionKm: z.number().min(0.1).max(50),
    }),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema.optional(),
});

export const volunteerProfileSchema = z.object({
    $type: z.literal(recordNsid.volunteerProfile),
    version: z.literal('1.0.0'),
    displayName: z.string().min(1).max(80),
    capabilities: z
        .array(
            z.enum([
                'transport',
                'food-delivery',
                'translation',
                'first-aid',
                'childcare',
                'other',
            ]),
        )
        .min(1),
    availability: z.enum([
        'immediate',
        'within-24h',
        'scheduled',
        'unavailable',
    ]),
    contactPreference: z.enum(['chat-only', 'chat-or-call']),
    notes: z.string().max(500).optional(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema.optional(),
});

export const conversationMetaSchema = z.object({
    $type: z.literal(recordNsid.conversationMeta),
    version: z.literal('1.0.0'),
    aidPostUri: atUriSchema,
    participantDids: z.array(didSchema).min(2).max(2),
    status: z.enum(['open', 'handoff', 'closed']),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema.optional(),
});

export const moderationReportSchema = z.object({
    $type: z.literal(recordNsid.moderationReport),
    version: z.literal('1.0.0'),
    subjectUri: atUriSchema,
    reporterDid: didSchema,
    reason: z.enum(['spam', 'abuse', 'fraud', 'other']),
    details: z.string().max(1000).optional(),
    createdAt: isoDateTimeSchema,
});

export const directoryResourceSchema = z.object({
    $type: z.literal(recordNsid.directoryResource),
    version: z.literal('1.0.0'),
    name: z.string().min(1).max(120),
    category: z.enum([
        'food-bank',
        'shelter',
        'clinic',
        'legal-aid',
        'hotline',
        'other',
    ]),
    serviceArea: z.string().min(1).max(120),
    contact: z
        .object({
            url: z.string().url().optional(),
            phone: z.string().min(7).max(32).optional(),
        })
        .refine(value => value.url !== undefined || value.phone !== undefined, {
            message: 'At least one contact method is required.',
        }),
    verificationStatus: z.enum([
        'unverified',
        'community-verified',
        'partner-verified',
    ]),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema.optional(),
});

export type AidPostRecord = z.infer<typeof aidPostSchema>;
export type VolunteerProfileRecord = z.infer<typeof volunteerProfileSchema>;
export type ConversationMetaRecord = z.infer<typeof conversationMetaSchema>;
export type ModerationReportRecord = z.infer<typeof moderationReportSchema>;
export type DirectoryResourceRecord = z.infer<typeof directoryResourceSchema>;

export type RecordByNsid = {
    'app.mutualhub.aid.post': AidPostRecord;
    'app.mutualhub.volunteer.profile': VolunteerProfileRecord;
    'app.mutualhub.conversation.meta': ConversationMetaRecord;
    'app.mutualhub.moderation.report': ModerationReportRecord;
    'app.mutualhub.directory.resource': DirectoryResourceRecord;
};

const recordValidators: { [K in RecordNsid]: z.ZodType<RecordByNsid[K]> } = {
    [recordNsid.aidPost]: aidPostSchema,
    [recordNsid.volunteerProfile]: volunteerProfileSchema,
    [recordNsid.conversationMeta]: conversationMetaSchema,
    [recordNsid.moderationReport]: moderationReportSchema,
    [recordNsid.directoryResource]: directoryResourceSchema,
};

export const validateRecordPayload = <N extends RecordNsid>(
    nsid: N,
    payload: unknown,
): RecordByNsid[N] => {
    return recordValidators[nsid].parse(payload);
};
