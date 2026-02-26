import type { Did } from './identity.js';

export type ModerationAction =
    | 'allow'
    | 'review'
    | 'delist'
    | 'suspend_visibility';
export type ReportReason =
    | 'spam'
    | 'harassment'
    | 'fraud'
    | 'unsafe_content'
    | 'other';
export type ModerationVisibilityState = 'visible' | 'delisted' | 'suspended';
export type ModerationQueueState = 'queued' | 'in_review' | 'resolved';
export type AppealStatus =
    | 'none'
    | 'submitted'
    | 'under_review'
    | 'approved'
    | 'rejected';
export type ModerationAuditAction =
    | ModerationAction
    | 'appeal_submitted'
    | 'appeal_approved'
    | 'appeal_rejected';

export interface ModerationReportRecord {
    id: string;
    targetUri: string;
    reason: ReportReason;
    reporterDid: Did;
    details?: string;
    createdAt: string;
}

export interface ModerationDecision {
    targetUri: string;
    action: ModerationAction;
    explanation: string;
}

export interface ModerationQueueItem {
    targetUri: string;
    queueState: ModerationQueueState;
    visibility: ModerationVisibilityState;
    appealStatus: AppealStatus;
    reportCount: number;
    reasonCounts: Record<ReportReason, number>;
    reporterDids: readonly Did[];
    latestReason: ReportReason;
    latestDetails?: string;
    latestReportAt: string;
    updatedAt: string;
}

export interface ModerationActionAuditRecord {
    id: string;
    targetUri: string;
    actorDid: Did;
    action: ModerationAuditAction;
    explanation: string;
    previousState: {
        queueState: ModerationQueueState;
        visibility: ModerationVisibilityState;
        appealStatus: AppealStatus;
    };
    nextState: {
        queueState: ModerationQueueState;
        visibility: ModerationVisibilityState;
        appealStatus: AppealStatus;
    };
    createdAt: string;
}

export interface ApplyModerationPolicyInput {
    targetUri: string;
    moderatorDid: Did;
    action: ModerationAction;
    explanation: string;
    createdAt?: string;
}

export interface SubmitAppealInput {
    targetUri: string;
    appellantDid: Did;
    explanation: string;
    createdAt?: string;
}

export interface ReviewAppealInput {
    targetUri: string;
    moderatorDid: Did;
    approve: boolean;
    explanation: string;
    createdAt?: string;
}

export interface ModerationQueueQuery {
    queueState?: ModerationQueueState;
    visibility?: ModerationVisibilityState;
    appealStatus?: AppealStatus;
}

function toReasonCounts(): Record<ReportReason, number> {
    return {
        spam: 0,
        harassment: 0,
        fraud: 0,
        unsafe_content: 0,
        other: 0,
    };
}

function stableHash(input: string): string {
    let hash = 0;
    for (let index = 0; index < input.length; index += 1) {
        hash = (hash * 33 + input.charCodeAt(index)) >>> 0;
    }

    return hash.toString(16).padStart(8, '0');
}

function toVisibility(
    action: ModerationAction,
    current: ModerationVisibilityState,
): ModerationVisibilityState {
    switch (action) {
        case 'allow':
            return 'visible';
        case 'delist':
            return 'delisted';
        case 'suspend_visibility':
            return 'suspended';
        case 'review':
            return current;
    }
}

function toQueueState(action: ModerationAction): ModerationQueueState {
    if (action === 'review') {
        return 'in_review';
    }

    return 'resolved';
}

function defaultQueueItem(
    targetUri: string,
    nowIso: string,
): ModerationQueueItem {
    return {
        targetUri,
        queueState: 'queued',
        visibility: 'visible',
        appealStatus: 'none',
        reportCount: 0,
        reasonCounts: toReasonCounts(),
        reporterDids: [],
        latestReason: 'other',
        latestReportAt: nowIso,
        updatedAt: nowIso,
    };
}

export class ModerationQueueStore {
    private readonly queueByTargetUri = new Map<string, ModerationQueueItem>();
    private readonly reportsByTargetUri = new Map<
        string,
        ModerationReportRecord[]
    >();
    private readonly auditsByTargetUri = new Map<
        string,
        ModerationActionAuditRecord[]
    >();

    private nowIso(): string {
        return new Date().toISOString();
    }

    private saveQueueItem(item: ModerationQueueItem): ModerationQueueItem {
        this.queueByTargetUri.set(item.targetUri, item);
        return item;
    }

    private appendAuditRecord(record: ModerationActionAuditRecord): void {
        const existing = this.auditsByTargetUri.get(record.targetUri) ?? [];
        existing.push(record);
        this.auditsByTargetUri.set(record.targetUri, existing);
    }

    private buildAuditRecord(input: {
        targetUri: string;
        actorDid: Did;
        action: ModerationAuditAction;
        explanation: string;
        createdAt: string;
        previousState: ModerationActionAuditRecord['previousState'];
        nextState: ModerationActionAuditRecord['nextState'];
    }): ModerationActionAuditRecord {
        return {
            id: `audit-${stableHash(
                `${input.targetUri}|${input.actorDid}|${input.action}|${input.createdAt}|${input.explanation}`,
            )}`,
            targetUri: input.targetUri,
            actorDid: input.actorDid,
            action: input.action,
            explanation: input.explanation,
            previousState: input.previousState,
            nextState: input.nextState,
            createdAt: input.createdAt,
        };
    }

    private upsertQueueItem(
        targetUri: string,
        nowIso: string,
    ): ModerationQueueItem {
        return (
            this.queueByTargetUri.get(targetUri) ??
            defaultQueueItem(targetUri, nowIso)
        );
    }

    submitReport(report: ModerationReportRecord): ModerationQueueItem {
        const existingReports =
            this.reportsByTargetUri.get(report.targetUri) ?? [];
        existingReports.push(report);
        this.reportsByTargetUri.set(report.targetUri, existingReports);

        const currentItem = this.upsertQueueItem(
            report.targetUri,
            report.createdAt,
        );
        const nextReasonCounts = {
            ...currentItem.reasonCounts,
            [report.reason]: currentItem.reasonCounts[report.reason] + 1,
        };

        const nextReporterDids = new Set(currentItem.reporterDids);
        nextReporterDids.add(report.reporterDid);

        const nextQueue: ModerationQueueItem = {
            ...currentItem,
            queueState:
                currentItem.queueState === 'resolved' ?
                    'queued'
                :   currentItem.queueState,
            reportCount: currentItem.reportCount + 1,
            reasonCounts: nextReasonCounts,
            reporterDids: [...nextReporterDids].sort(),
            latestReason: report.reason,
            latestDetails: report.details,
            latestReportAt: report.createdAt,
            updatedAt: report.createdAt,
        };

        return this.saveQueueItem(nextQueue);
    }

    applyPolicyAction(input: ApplyModerationPolicyInput): ModerationQueueItem {
        const createdAt = input.createdAt ?? this.nowIso();
        const current = this.upsertQueueItem(input.targetUri, createdAt);

        const previousState = {
            queueState: current.queueState,
            visibility: current.visibility,
            appealStatus: current.appealStatus,
        };

        const nextAppealStatus: AppealStatus =
            input.action === 'review' && current.appealStatus === 'submitted' ?
                'under_review'
            :   current.appealStatus;

        const nextState = {
            queueState: toQueueState(input.action),
            visibility: toVisibility(input.action, current.visibility),
            appealStatus: nextAppealStatus,
        };

        const nextQueue: ModerationQueueItem = {
            ...current,
            ...nextState,
            updatedAt: createdAt,
        };

        this.appendAuditRecord(
            this.buildAuditRecord({
                targetUri: input.targetUri,
                actorDid: input.moderatorDid,
                action: input.action,
                explanation: input.explanation,
                previousState,
                nextState,
                createdAt,
            }),
        );

        return this.saveQueueItem(nextQueue);
    }

    submitAppeal(input: SubmitAppealInput): ModerationQueueItem {
        const createdAt = input.createdAt ?? this.nowIso();
        const current = this.upsertQueueItem(input.targetUri, createdAt);

        const previousState = {
            queueState: current.queueState,
            visibility: current.visibility,
            appealStatus: current.appealStatus,
        };

        const nextState = {
            queueState: 'in_review' as const,
            visibility: current.visibility,
            appealStatus: 'submitted' as const,
        };

        const nextQueue: ModerationQueueItem = {
            ...current,
            ...nextState,
            updatedAt: createdAt,
        };

        this.appendAuditRecord(
            this.buildAuditRecord({
                targetUri: input.targetUri,
                actorDid: input.appellantDid,
                action: 'appeal_submitted',
                explanation: input.explanation,
                previousState,
                nextState,
                createdAt,
            }),
        );

        return this.saveQueueItem(nextQueue);
    }

    reviewAppeal(input: ReviewAppealInput): ModerationQueueItem {
        const createdAt = input.createdAt ?? this.nowIso();
        const current = this.upsertQueueItem(input.targetUri, createdAt);

        const previousState = {
            queueState: current.queueState,
            visibility: current.visibility,
            appealStatus: current.appealStatus,
        };

        const nextState = {
            queueState: 'resolved' as const,
            visibility:
                input.approve ? ('visible' as const) : current.visibility,
            appealStatus:
                input.approve ? ('approved' as const) : ('rejected' as const),
        };

        const nextQueue: ModerationQueueItem = {
            ...current,
            ...nextState,
            updatedAt: createdAt,
        };

        this.appendAuditRecord(
            this.buildAuditRecord({
                targetUri: input.targetUri,
                actorDid: input.moderatorDid,
                action: input.approve ? 'appeal_approved' : 'appeal_rejected',
                explanation: input.explanation,
                previousState,
                nextState,
                createdAt,
            }),
        );

        return this.saveQueueItem(nextQueue);
    }

    getQueueItem(targetUri: string): ModerationQueueItem | undefined {
        return this.queueByTargetUri.get(targetUri);
    }

    listQueue(query: ModerationQueueQuery = {}): ModerationQueueItem[] {
        return [...this.queueByTargetUri.values()]
            .filter(item => {
                if (query.queueState && item.queueState !== query.queueState) {
                    return false;
                }

                if (query.visibility && item.visibility !== query.visibility) {
                    return false;
                }

                if (
                    query.appealStatus &&
                    item.appealStatus !== query.appealStatus
                ) {
                    return false;
                }

                return true;
            })
            .sort((left, right) => {
                const leftTime = Date.parse(left.updatedAt);
                const rightTime = Date.parse(right.updatedAt);
                const safeLeft = Number.isNaN(leftTime) ? 0 : leftTime;
                const safeRight = Number.isNaN(rightTime) ? 0 : rightTime;

                if (safeLeft !== safeRight) {
                    return safeRight - safeLeft;
                }

                return left.targetUri.localeCompare(right.targetUri);
            });
    }

    listReports(targetUri: string): ModerationReportRecord[] {
        const reports = this.reportsByTargetUri.get(targetUri) ?? [];
        return [...reports].sort((left, right) => {
            const leftTime = Date.parse(left.createdAt);
            const rightTime = Date.parse(right.createdAt);
            const safeLeft = Number.isNaN(leftTime) ? 0 : leftTime;
            const safeRight = Number.isNaN(rightTime) ? 0 : rightTime;
            return safeLeft - safeRight;
        });
    }

    listAuditTrail(targetUri?: string): ModerationActionAuditRecord[] {
        if (targetUri) {
            return [...(this.auditsByTargetUri.get(targetUri) ?? [])].sort(
                (left, right) => left.createdAt.localeCompare(right.createdAt),
            );
        }

        return [...this.auditsByTargetUri.values()]
            .flat()
            .sort((left, right) =>
                left.createdAt.localeCompare(right.createdAt),
            );
    }
}
