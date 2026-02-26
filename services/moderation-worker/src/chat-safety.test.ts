import assert from 'node:assert/strict';
import test from 'node:test';

import { createChatSafetyEngine } from './chat-safety.js';

test('report/block/mute controls update chat safety behavior', () => {
    let now = Date.parse('2026-02-25T10:00:00.000Z');
    const engine = createChatSafetyEngine({ now: () => now });

    const reportResult = engine.reportParticipant({
        reporterDid: 'did:plc:reporter1',
        targetDid: 'did:plc:target1',
        conversationId: 'conv-1',
        reason: 'harassment',
        details: 'Repeated abusive messages',
        createdAt: '2026-02-25T10:00:00.000Z',
    });

    assert.equal(reportResult.report.reporterDid, 'did:plc:reporter1');
    assert.equal(reportResult.moderationSignal.type, 'report_submitted');
    assert.equal(reportResult.moderationSignal.moderationAction, 'review');

    const blockOutcome = engine.blockParticipant({
        actorDid: 'did:plc:target1',
        targetDid: 'did:plc:reporter1',
    });
    assert.equal(blockOutcome.ok, true);

    const blockedMessage = engine.evaluateOutgoingMessage({
        conversationId: 'conv-1',
        senderDid: 'did:plc:reporter1',
        recipientDid: 'did:plc:target1',
        text: 'Can we coordinate pickup?',
    });
    assert.equal(blockedMessage.ok, false);
    assert.equal(blockedMessage.code, 'blocked');

    const muteOutcome = engine.muteParticipant({
        actorDid: 'did:plc:target2',
        targetDid: 'did:plc:sender2',
        durationMinutes: 30,
        createdAt: '2026-02-25T10:00:00.000Z',
    });
    assert.equal(muteOutcome.ok, true);

    const mutedMessage = engine.evaluateOutgoingMessage({
        conversationId: 'conv-2',
        senderDid: 'did:plc:sender2',
        recipientDid: 'did:plc:target2',
        text: 'Following up now',
        sentAt: '2026-02-25T10:05:00.000Z',
    });
    assert.equal(mutedMessage.ok, false);
    assert.equal(mutedMessage.code, 'muted');

    now += 31 * 60_000;
    const postMuteMessage = engine.evaluateOutgoingMessage({
        conversationId: 'conv-2',
        senderDid: 'did:plc:sender2',
        recipientDid: 'did:plc:target2',
        text: 'Following up after cooldown',
        sentAt: '2026-02-25T10:31:01.000Z',
    });

    assert.equal(postMuteMessage.ok, true);
});

test('abuse keyword detection emits moderation signal hooks', () => {
    const engine = createChatSafetyEngine({
        now: () => Date.parse('2026-02-25T11:00:00.000Z'),
    });

    const result = engine.evaluateOutgoingMessage({
        conversationId: 'conv-abuse',
        senderDid: 'did:plc:sender-abuse',
        recipientDid: 'did:plc:recipient-abuse',
        text: 'This is a crypto giveaway, send your seed phrase now.',
        sentAt: '2026-02-25T11:00:00.000Z',
    });

    assert.equal(result.ok, false);
    assert.equal(result.code, 'abuse_flagged');
    assert.equal(result.flaggedKeywords.length >= 1, true);
    assert.equal(result.moderationSignals.length, 1);
    assert.equal(result.moderationSignals[0]?.type, 'abuse_keyword');

    const queue = engine.drainModerationQueue();
    assert.equal(queue.length, 1);
    assert.equal(queue[0]?.type, 'abuse_keyword');
});

test('rate limits prevent abusive chat bursts with clear feedback', () => {
    const engine = createChatSafetyEngine({
        now: () => Date.parse('2026-02-25T12:00:00.000Z'),
        rateLimit: {
            maxMessages: 3,
            windowMs: 60_000,
        },
    });

    const baseTime = Date.parse('2026-02-25T12:00:00.000Z');
    for (let index = 0; index < 3; index += 1) {
        const allowed = engine.evaluateOutgoingMessage({
            conversationId: 'conv-rate',
            senderDid: 'did:plc:sender-rate',
            recipientDid: 'did:plc:recipient-rate',
            text: `message-${index}`,
            sentAt: new Date(baseTime + index * 5_000).toISOString(),
        });
        assert.equal(allowed.ok, true);
    }

    const limited = engine.evaluateOutgoingMessage({
        conversationId: 'conv-rate',
        senderDid: 'did:plc:sender-rate',
        recipientDid: 'did:plc:recipient-rate',
        text: 'message-4',
        sentAt: new Date(baseTime + 20_000).toISOString(),
    });

    assert.equal(limited.ok, false);
    assert.equal(limited.code, 'rate_limited');
    assert.match(limited.message, /Too many messages/i);
    assert.equal(limited.moderationSignals[0]?.type, 'rate_limit');
});
