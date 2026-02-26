import assert from 'node:assert/strict';
import test from 'node:test';

import { createModerationWorkerService } from './index.js';

test('moderation worker initializes with configured port', () => {
    const worker = createModerationWorkerService({
        MODERATION_WORKER_PORT: '4201',
    });

    assert.equal(worker.service, 'moderation-worker');
    assert.equal(worker.port, 4201);
    assert.ok(worker.chatSafety);
    assert.ok(worker.moderationQueue);
});

test('chat reports are mirrored into moderation review queue', () => {
    const worker = createModerationWorkerService({
        MODERATION_WORKER_PORT: '4201',
    });

    worker.chatSafety.reportParticipant({
        reporterDid: 'did:plc:reporter-queue',
        targetDid: 'did:plc:target-queue',
        conversationId: 'conv-queue-1',
        reason: 'harassment',
        details: 'Escalation needed',
        createdAt: '2026-02-25T15:00:00.000Z',
    });

    const queue = worker.moderationQueue.listQueue();
    assert.equal(queue.length, 1);
    assert.equal(queue[0]?.latestReason, 'harassment');
});
