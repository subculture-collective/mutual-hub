import type { Did, ModerationReportRecord, ReportReason } from "@mutual-hub/shared";

import { evaluateModeration } from "./worker.js";

export type ChatModerationSignalType = "report_submitted" | "abuse_keyword" | "rate_limit";

export interface ChatModerationSignal {
  id: string;
  type: ChatModerationSignalType;
  conversationId: string;
  targetDid: Did;
  reason: ReportReason;
  details: string;
  createdAt: string;
  moderationAction: ReturnType<typeof evaluateModeration>["action"];
  moderationExplanation: string;
}

export interface ChatRateLimitPolicy {
  windowMs: number;
  maxMessages: number;
}

export interface ChatSafetyEngineOptions {
  abuseKeywords?: readonly string[];
  rateLimit?: Partial<ChatRateLimitPolicy>;
  now?: () => number;
}

export interface ChatReportInput {
  reporterDid: Did;
  targetDid: Did;
  conversationId: string;
  reason: ReportReason;
  details?: string;
  createdAt?: string;
}

export interface ChatBlockInput {
  actorDid: Did;
  targetDid: Did;
  createdAt?: string;
}

export interface ChatMuteInput {
  actorDid: Did;
  targetDid: Did;
  durationMinutes: number;
  createdAt?: string;
}

export interface EvaluateChatMessageInput {
  conversationId: string;
  senderDid: Did;
  recipientDid: Did;
  text: string;
  sentAt?: string;
}

export interface ChatControlResult {
  ok: boolean;
  code: string;
  message: string;
  moderationSignals: readonly ChatModerationSignal[];
}

export interface ChatMessageSafetyResult extends ChatControlResult {
  flaggedKeywords: readonly string[];
}

const defaultAbuseKeywords = [
  "crypto giveaway",
  "seed phrase",
  "wire money now",
  "kill yourself",
] as const;

function didPairKey(left: Did, right: Did): string {
  return `${left}->${right}`;
}

function senderConversationKey(senderDid: Did, conversationId: string): string {
  return `${senderDid}::${conversationId}`;
}

function signalId(prefix: string, value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }

  return `${prefix}-${hash.toString(16).padStart(8, "0")}`;
}

export class ChatSafetyEngine {
  private readonly blockedPairs = new Set<string>();
  private readonly mutedPairsUntil = new Map<string, number>();
  private readonly sentMessageTimestamps = new Map<string, number[]>();
  private readonly moderationQueue: ChatModerationSignal[] = [];
  private readonly abuseKeywords: readonly string[];
  private readonly rateLimit: ChatRateLimitPolicy;

  constructor(private readonly options: ChatSafetyEngineOptions = {}) {
    this.abuseKeywords = options.abuseKeywords ?? [...defaultAbuseKeywords];
    this.rateLimit = {
      windowMs: options.rateLimit?.windowMs ?? 60_000,
      maxMessages: options.rateLimit?.maxMessages ?? 5,
    };
  }

  reportParticipant(input: ChatReportInput): {
    report: ModerationReportRecord;
    moderationSignal: ChatModerationSignal;
  } {
    const createdAt = input.createdAt ?? new Date(this.now()).toISOString();
    const report: ModerationReportRecord = {
      id: signalId(
        "report",
        `${input.reporterDid}|${input.targetDid}|${input.conversationId}|${createdAt}`,
      ),
      targetUri: `at://${input.targetDid}/com.mutualaid.hub.conversationMetadata/${input.conversationId}`,
      reason: input.reason,
      reporterDid: input.reporterDid,
      details: input.details,
      createdAt,
    };

    const decision = evaluateModeration({
      targetUri: report.targetUri,
      reason: report.reason,
      detailText: report.details,
    });

    const moderationSignal: ChatModerationSignal = {
      id: signalId("signal", `${report.id}|report_submitted`),
      type: "report_submitted",
      conversationId: input.conversationId,
      targetDid: input.targetDid,
      reason: input.reason,
      details: input.details ?? "User submitted a chat report.",
      createdAt,
      moderationAction: decision.action,
      moderationExplanation: decision.explanation,
    };

    this.moderationQueue.push(moderationSignal);
    return { report, moderationSignal };
  }

  blockParticipant(input: ChatBlockInput): ChatControlResult {
    this.blockedPairs.add(didPairKey(input.actorDid, input.targetDid));

    return {
      ok: true,
      code: "blocked",
      message: "Participant blocked. New chat messages will be prevented.",
      moderationSignals: [],
    };
  }

  muteParticipant(input: ChatMuteInput): ChatControlResult {
    const mutedUntilMs =
      Date.parse(input.createdAt ?? new Date(this.now()).toISOString()) +
      Math.max(1, input.durationMinutes) * 60_000;
    this.mutedPairsUntil.set(didPairKey(input.actorDid, input.targetDid), mutedUntilMs);

    return {
      ok: true,
      code: "muted",
      message: `Participant muted for ${Math.max(1, input.durationMinutes)} minute(s).`,
      moderationSignals: [],
    };
  }

  evaluateOutgoingMessage(input: EvaluateChatMessageInput): ChatMessageSafetyResult {
    if (
      this.blockedPairs.has(didPairKey(input.senderDid, input.recipientDid)) ||
      this.blockedPairs.has(didPairKey(input.recipientDid, input.senderDid))
    ) {
      return {
        ok: false,
        code: "blocked",
        message: "Message not sent because one participant has blocked the other.",
        moderationSignals: [],
        flaggedKeywords: [],
      };
    }

    const recipientMuteKey = didPairKey(input.recipientDid, input.senderDid);
    const mutedUntil = this.mutedPairsUntil.get(recipientMuteKey);
    if (mutedUntil !== undefined && mutedUntil > this.now()) {
      return {
        ok: false,
        code: "muted",
        message: "Message not delivered because the recipient has muted this conversation.",
        moderationSignals: [],
        flaggedKeywords: [],
      };
    }

    const flaggedKeywords = this.findAbuseKeywords(input.text);
    if (flaggedKeywords.length > 0) {
      const signal = this.emitSignal({
        type: "abuse_keyword",
        conversationId: input.conversationId,
        targetDid: input.senderDid,
        reason: "unsafe_content",
        details: `Flagged keywords: ${flaggedKeywords.join(", ")}`,
        createdAt: input.sentAt,
      });

      return {
        ok: false,
        code: "abuse_flagged",
        message: "Message held for safety review because it triggered abuse detection.",
        moderationSignals: [signal],
        flaggedKeywords,
      };
    }

    const rateLimited = this.isRateLimited(input);
    if (rateLimited) {
      const signal = this.emitSignal({
        type: "rate_limit",
        conversationId: input.conversationId,
        targetDid: input.senderDid,
        reason: "spam",
        details: "Sender exceeded chat message rate limit.",
        createdAt: input.sentAt,
      });

      return {
        ok: false,
        code: "rate_limited",
        message: "Too many messages sent too quickly. Please wait before sending again.",
        moderationSignals: [signal],
        flaggedKeywords: [],
      };
    }

    return {
      ok: true,
      code: "allowed",
      message: "Message accepted.",
      moderationSignals: [],
      flaggedKeywords: [],
    };
  }

  drainModerationQueue(): ChatModerationSignal[] {
    const signals = [...this.moderationQueue];
    this.moderationQueue.length = 0;
    return signals;
  }

  private now(): number {
    return this.options.now ? this.options.now() : Date.now();
  }

  private findAbuseKeywords(text: string): string[] {
    const normalized = text.toLowerCase();
    return this.abuseKeywords.filter((keyword) => normalized.includes(keyword));
  }

  private isRateLimited(input: EvaluateChatMessageInput): boolean {
    const key = senderConversationKey(input.senderDid, input.conversationId);
    const nowMs = input.sentAt ? Date.parse(input.sentAt) : this.now();
    const safeNow = Number.isNaN(nowMs) ? this.now() : nowMs;
    const windowStart = safeNow - this.rateLimit.windowMs;
    const history = this.sentMessageTimestamps.get(key) ?? [];
    const withinWindow = history.filter((timestamp) => timestamp >= windowStart);

    if (withinWindow.length >= this.rateLimit.maxMessages) {
      this.sentMessageTimestamps.set(key, withinWindow);
      return true;
    }

    withinWindow.push(safeNow);
    this.sentMessageTimestamps.set(key, withinWindow);
    return false;
  }

  private emitSignal(input: {
    type: ChatModerationSignalType;
    conversationId: string;
    targetDid: Did;
    reason: ReportReason;
    details: string;
    createdAt?: string;
  }): ChatModerationSignal {
    const createdAt = input.createdAt ?? new Date(this.now()).toISOString();
    const targetUri = `at://${input.targetDid}/com.mutualaid.hub.conversationMetadata/${input.conversationId}`;
    const decision = evaluateModeration({
      targetUri,
      reason: input.reason,
      detailText: input.details,
    });

    const signal: ChatModerationSignal = {
      id: signalId(
        "signal",
        `${input.type}|${input.targetDid}|${input.conversationId}|${createdAt}`,
      ),
      type: input.type,
      conversationId: input.conversationId,
      targetDid: input.targetDid,
      reason: input.reason,
      details: input.details,
      createdAt,
      moderationAction: decision.action,
      moderationExplanation: decision.explanation,
    };

    this.moderationQueue.push(signal);
    return signal;
  }
}

export function createChatSafetyEngine(options: ChatSafetyEngineOptions = {}): ChatSafetyEngine {
  return new ChatSafetyEngine(options);
}
