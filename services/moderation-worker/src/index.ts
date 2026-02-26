import { parseEnv } from '@mutual-hub/config';

import { createChatSafetyEngine } from './chat-safety.js';
import { evaluateModeration } from './worker.js';

export { ChatSafetyEngine, createChatSafetyEngine } from './chat-safety.js';

export interface ModerationWorkerService {
    service: 'moderation-worker';
    port: number;
    evaluateModeration: typeof evaluateModeration;
    chatSafety: ReturnType<typeof createChatSafetyEngine>;
}

export function createModerationWorkerService(
    rawEnv: NodeJS.ProcessEnv = process.env,
): ModerationWorkerService {
    const env = parseEnv(rawEnv);

    return {
        service: 'moderation-worker',
        port: env.MODERATION_WORKER_PORT,
        evaluateModeration,
        chatSafety: createChatSafetyEngine(),
    };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    console.log(
        JSON.stringify({ service: 'moderation-worker', ready: true }, null, 2),
    );
}
