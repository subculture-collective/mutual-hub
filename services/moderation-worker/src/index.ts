import { parseEnv } from '@mutual-hub/config';
import {
    ModerationQueueStore,
    createMinimalLogEntry,
} from '@mutual-hub/shared';

import { createChatSafetyEngine } from './chat-safety.js';
import { evaluateModeration } from './worker.js';

export { ChatSafetyEngine, createChatSafetyEngine } from './chat-safety.js';

export interface ModerationWorkerService {
    service: 'moderation-worker';
    port: number;
    evaluateModeration: typeof evaluateModeration;
    moderationQueue: ModerationQueueStore;
    chatSafety: ReturnType<typeof createChatSafetyEngine>;
}

export function createModerationWorkerService(
    rawEnv: NodeJS.ProcessEnv = process.env,
): ModerationWorkerService {
    const env = parseEnv(rawEnv);
    const moderationQueue = new ModerationQueueStore();

    return {
        service: 'moderation-worker',
        port: env.MODERATION_WORKER_PORT,
        evaluateModeration,
        moderationQueue,
        chatSafety: createChatSafetyEngine({
            moderationQueueStore: moderationQueue,
        }),
    };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    console.log(
        JSON.stringify(
            createMinimalLogEntry(
                'service.ready',
                { service: 'moderation-worker', ready: true },
                { allowedKeys: ['service', 'ready'] },
            ),
            null,
            2,
        ),
    );
}
