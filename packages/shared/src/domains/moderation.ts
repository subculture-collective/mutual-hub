import type { Did } from "./identity.js";

export type ModerationAction = "allow" | "review" | "delist" | "suspend_visibility";
export type ReportReason = "spam" | "harassment" | "fraud" | "unsafe_content" | "other";

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
