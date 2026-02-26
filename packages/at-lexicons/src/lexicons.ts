import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { recordNsid, type RecordNsid } from './validators.js';

const lexiconDocSchema = z.object({
    lexicon: z.literal(1),
    id: z.enum([
        recordNsid.aidPost,
        recordNsid.volunteerProfile,
        recordNsid.conversationMeta,
        recordNsid.moderationReport,
        recordNsid.directoryResource,
    ] as const),
    revision: z.string(),
    description: z.string(),
    defs: z.object({
        main: z.object({
            type: z.literal('record'),
            key: z.literal('tid'),
            record: z.object({
                type: z.literal('object'),
                required: z.array(z.string()),
                properties: z.record(z.unknown()),
            }),
        }),
    }),
});

export type AtLexiconDoc = z.infer<typeof lexiconDocSchema>;

const here = dirname(fileURLToPath(import.meta.url));
const lexiconDir = resolve(here, 'lexicons');

const readLexicon = (fileName: string): AtLexiconDoc => {
    const json = JSON.parse(
        readFileSync(resolve(lexiconDir, fileName), 'utf8'),
    );
    return lexiconDocSchema.parse(json);
};

export const lexiconDocs: Record<RecordNsid, AtLexiconDoc> = {
    [recordNsid.aidPost]: readLexicon('app.mutualhub.aid.post.v1.json'),
    [recordNsid.volunteerProfile]: readLexicon(
        'app.mutualhub.volunteer.profile.v1.json',
    ),
    [recordNsid.conversationMeta]: readLexicon(
        'app.mutualhub.conversation.meta.v1.json',
    ),
    [recordNsid.moderationReport]: readLexicon(
        'app.mutualhub.moderation.report.v1.json',
    ),
    [recordNsid.directoryResource]: readLexicon(
        'app.mutualhub.directory.resource.v1.json',
    ),
};
