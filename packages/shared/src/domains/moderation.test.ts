import assert from 'node:assert/strict';
import test from 'node:test';

import { ModerationQueueStore } from './moderation.js';

test('reported items appear in moderation queue with context', () => {
    const store = new ModerationQueueStore();

    store.submitReport({
        id: 'report-1',
        targetUri: 'at://did:plc:target/com.mutualaid.hub.aidPost/post-1',
        reason: 'harassment',
        reporterDid: 'did:plc:reporter-a',
        details: 'Threatening language in comments',
        createdAt: '2026-02-25T10:00:00.000Z',
    });

    store.submitReport({
        id: 'report-2',
        targetUri: 'at://did:plc:target/com.mutualaid.hub.aidPost/post-1',
        reason: 'spam',
        reporterDid: 'did:plc:reporter-b',
        details: 'Repeated scam links',
        createdAt: '2026-02-25T10:05:00.000Z',
    });

    const queue = store.listQueue();
    assert.equal(queue.length, 1);
    assert.equal(queue[0]?.reportCount, 2);
    assert.equal(queue[0]?.latestReason, 'spam');
    assert.equal(queue[0]?.reasonCounts.harassment, 1);
    assert.equal(queue[0]?.reasonCounts.spam, 1);
    assert.deepEqual(queue[0]?.reporterDids, [
        'did:plc:reporter-a',
        'did:plc:reporter-b',
    ]);

    const reports = store.listReports(
        'at://did:plc:target/com.mutualaid.hub.aidPost/post-1',
    );
    assert.equal(reports.length, 2);
    assert.equal(reports[0]?.id, 'report-1');
    assert.equal(reports[1]?.id, 'report-2');
});

test('policy actions and appeals transition deterministically', () => {
    const store = new ModerationQueueStore();
    const targetUri = 'at://did:plc:target/com.mutualaid.hub.aidPost/post-2';

    store.submitReport({
        id: 'report-3',
        targetUri,
        reason: 'fraud',
        reporterDid: 'did:plc:reporter-c',
        details: 'Impersonation report',
        createdAt: '2026-02-25T11:00:00.000Z',
    });

    const inReview = store.applyPolicyAction({
        targetUri,
        moderatorDid: 'did:plc:mod-1',
        action: 'review',
        explanation: 'Needs moderator verification',
        createdAt: '2026-02-25T11:02:00.000Z',
    });
    assert.equal(inReview.queueState, 'in_review');
    assert.equal(inReview.visibility, 'visible');

    const suspended = store.applyPolicyAction({
        targetUri,
        moderatorDid: 'did:plc:mod-1',
        action: 'suspend_visibility',
        explanation: 'Hidden pending safety review',
        createdAt: '2026-02-25T11:05:00.000Z',
    });
    assert.equal(suspended.queueState, 'resolved');
    assert.equal(suspended.visibility, 'suspended');

    const appealed = store.submitAppeal({
        targetUri,
        appellantDid: 'did:plc:target',
        explanation: 'Content was misclassified',
        createdAt: '2026-02-25T11:10:00.000Z',
    });
    assert.equal(appealed.appealStatus, 'submitted');
    assert.equal(appealed.queueState, 'in_review');

    const underReview = store.applyPolicyAction({
        targetUri,
        moderatorDid: 'did:plc:mod-2',
        action: 'review',
        explanation: 'Appeal moved to manual review',
        createdAt: '2026-02-25T11:12:00.000Z',
    });
    assert.equal(underReview.appealStatus, 'under_review');

    const approvedAppeal = store.reviewAppeal({
        targetUri,
        moderatorDid: 'did:plc:mod-2',
        approve: true,
        explanation: 'Appeal accepted after review',
        createdAt: '2026-02-25T11:15:00.000Z',
    });

    assert.equal(approvedAppeal.queueState, 'resolved');
    assert.equal(approvedAppeal.visibility, 'visible');
    assert.equal(approvedAppeal.appealStatus, 'approved');

    const approvedQueue = store.listQueue({ appealStatus: 'approved' });
    assert.equal(approvedQueue.length, 1);
    assert.equal(approvedQueue[0]?.targetUri, targetUri);
});

test('audit trail is stored and retrievable', () => {
    const store = new ModerationQueueStore();
    const targetUri = 'at://did:plc:target/com.mutualaid.hub.aidPost/post-3';

    store.submitReport({
        id: 'report-4',
        targetUri,
        reason: 'unsafe_content',
        reporterDid: 'did:plc:reporter-d',
        createdAt: '2026-02-25T12:00:00.000Z',
    });

    store.applyPolicyAction({
        targetUri,
        moderatorDid: 'did:plc:mod-3',
        action: 'delist',
        explanation: 'Removed for unsafe content',
        createdAt: '2026-02-25T12:03:00.000Z',
    });

    store.submitAppeal({
        targetUri,
        appellantDid: 'did:plc:target',
        explanation: 'Requesting reconsideration',
        createdAt: '2026-02-25T12:05:00.000Z',
    });

    store.reviewAppeal({
        targetUri,
        moderatorDid: 'did:plc:mod-4',
        approve: false,
        explanation: 'Appeal rejected due to policy evidence',
        createdAt: '2026-02-25T12:08:00.000Z',
    });

    const auditTrail = store.listAuditTrail(targetUri);
    assert.equal(auditTrail.length, 3);
    assert.equal(auditTrail[0]?.action, 'delist');
    assert.equal(auditTrail[1]?.action, 'appeal_submitted');
    assert.equal(auditTrail[2]?.action, 'appeal_rejected');

    assert.equal(auditTrail[0]?.nextState.visibility, 'delisted');
    assert.equal(auditTrail[2]?.nextState.appealStatus, 'rejected');
});
