import type { ModerationDecision, ReportReason } from "@mutual-hub/shared";

const autoEscalateReasons: readonly ReportReason[] = ["harassment", "fraud", "unsafe_content"];

export interface ModerationInput {
  targetUri: string;
  reason: ReportReason;
  detailText?: string;
}

export function evaluateModeration(input: ModerationInput): ModerationDecision {
  if (autoEscalateReasons.includes(input.reason)) {
    return {
      targetUri: input.targetUri,
      action: "review",
      explanation: `Escalated for human review due to reason: ${input.reason}`,
    };
  }

  const maybeSpam = input.detailText?.toLowerCase().includes("crypto giveaway") ?? false;
  if (maybeSpam) {
    return {
      targetUri: input.targetUri,
      action: "delist",
      explanation: "Automatically delisted due to known scam pattern",
    };
  }

  return {
    targetUri: input.targetUri,
    action: "allow",
    explanation: "No immediate policy risk detected",
  };
}
