import type { AidCategory } from "./aid-records.js";
import type { Did } from "./identity.js";

export type ConversationState = "open" | "handoff_suggested" | "resolved" | "blocked";

export type ChatInitiationSource = "map_detail" | "feed_card" | "post_detail";

export type ChatTransportMode = "atproto_native" | "fallback_notice";

export type ChatFallbackReason =
  | "recipient_unsupported"
  | "recipient_opt_out"
  | "recipient_unreachable";

export interface ConversationRequestContext {
  source: ChatInitiationSource;
  postTitle: string;
  category: AidCategory;
  urgency: 1 | 2 | 3 | 4 | 5;
  areaLabel?: string;
}

export interface ConversationRoutingMetadata {
  destinationType: "post_author" | "volunteer_pool" | "resource_directory" | "manual_review";
  destinationId?: string;
  rationale: string;
}

export interface ConversationTransportMetadata {
  mode: ChatTransportMode;
  fallbackReason?: ChatFallbackReason;
  fallbackNotice?: string;
}

export interface ConversationMetadata {
  id: string;
  postUri: string;
  requesterDid: Did;
  recipientDid: Did;
  state: ConversationState;
  createdAt: string;
  updatedAt: string;
  requestContext?: ConversationRequestContext;
  routing?: ConversationRoutingMetadata;
  transport?: ConversationTransportMetadata;
}

export interface PostLinkedChatInitiationInput {
  requesterDid: Did;
  recipientDid: Did;
  postUri: string;
  requestContext: ConversationRequestContext;
  initiatedAt?: string;
  conversationId?: string;
}

export interface ChatPermissionSnapshot {
  requesterCanInitiate?: boolean;
  recipientAcceptsChats?: boolean;
  blockedByRequester?: boolean;
  blockedByRecipient?: boolean;
}

export type ChatInitFailureCode =
  | "invalid_requester_did"
  | "invalid_recipient_did"
  | "invalid_post_uri"
  | "same_participant"
  | "requester_not_allowed"
  | "recipient_not_available"
  | "requester_blocked_recipient"
  | "recipient_blocked_requester";

export type ChatInitOutcome =
  | {
      ok: true;
      conversation: ConversationMetadata;
      ux: {
        severity: "success";
        title: string;
        message: string;
      };
    }
  | {
      ok: false;
      code: ChatInitFailureCode;
      ux: {
        severity: "error";
        title: string;
        message: string;
      };
    };

const didPattern = /^did:[a-z0-9:._%-]+$/i;
const atUriPattern = /^at:\/\/[^/]+\/[a-z0-9.]+\/.+$/i;

function stableHash(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash.toString(16).padStart(8, "0");
}

function defaultConversationId(input: PostLinkedChatInitiationInput): string {
  return `conv-${stableHash(`${input.requesterDid}|${input.recipientDid}|${input.postUri}`)}`;
}

function mapFailureToUx(code: ChatInitFailureCode): {
  severity: "error";
  title: string;
  message: string;
} {
  switch (code) {
    case "invalid_requester_did":
      return {
        severity: "error",
        title: "Cannot start chat",
        message: "Your account identity is invalid. Refresh and try again.",
      };
    case "invalid_recipient_did":
      return {
        severity: "error",
        title: "Cannot start chat",
        message: "This helper account is invalid or unavailable right now.",
      };
    case "invalid_post_uri":
      return {
        severity: "error",
        title: "Cannot start chat",
        message: "The request context is invalid. Open the post again and retry.",
      };
    case "same_participant":
      return {
        severity: "error",
        title: "Cannot start chat",
        message: "You cannot start a 1:1 chat with yourself.",
      };
    case "requester_not_allowed":
      return {
        severity: "error",
        title: "Chat unavailable",
        message:
          "Your account cannot start new chats right now. Contact support if this seems wrong.",
      };
    case "recipient_not_available":
      return {
        severity: "error",
        title: "Helper unavailable",
        message: "This helper is not accepting chats at the moment. Try a different destination.",
      };
    case "requester_blocked_recipient":
      return {
        severity: "error",
        title: "Chat blocked",
        message: "You blocked this account. Unblock first to start a chat.",
      };
    case "recipient_blocked_requester":
      return {
        severity: "error",
        title: "Chat unavailable",
        message: "This account is not available for direct chat. Try an alternative handoff path.",
      };
  }
}

export function isDid(value: string): value is Did {
  return didPattern.test(value);
}

export function isAtUri(value: string): boolean {
  return atUriPattern.test(value);
}

export function validateConversationPermissions(
  input: Pick<PostLinkedChatInitiationInput, "requesterDid" | "recipientDid" | "postUri">,
  permissions: ChatPermissionSnapshot = {},
): ChatInitFailureCode | undefined {
  if (!isDid(input.requesterDid)) {
    return "invalid_requester_did";
  }

  if (!isDid(input.recipientDid)) {
    return "invalid_recipient_did";
  }

  if (!isAtUri(input.postUri)) {
    return "invalid_post_uri";
  }

  if (input.requesterDid === input.recipientDid) {
    return "same_participant";
  }

  if (permissions.requesterCanInitiate === false) {
    return "requester_not_allowed";
  }

  if (permissions.recipientAcceptsChats === false) {
    return "recipient_not_available";
  }

  if (permissions.blockedByRequester) {
    return "requester_blocked_recipient";
  }

  if (permissions.blockedByRecipient) {
    return "recipient_blocked_requester";
  }

  return undefined;
}

export function initiatePostLinkedChat(
  input: PostLinkedChatInitiationInput,
  permissions: ChatPermissionSnapshot = {},
): ChatInitOutcome {
  const failure = validateConversationPermissions(input, permissions);
  if (failure) {
    return {
      ok: false,
      code: failure,
      ux: mapFailureToUx(failure),
    };
  }

  const timestamp = input.initiatedAt ?? new Date().toISOString();
  const id = input.conversationId ?? defaultConversationId(input);

  return {
    ok: true,
    conversation: {
      id,
      postUri: input.postUri,
      requesterDid: input.requesterDid,
      recipientDid: input.recipientDid,
      state: "open",
      createdAt: timestamp,
      updatedAt: timestamp,
      requestContext: input.requestContext,
    },
    ux: {
      severity: "success",
      title: "Chat ready",
      message: "Conversation opened with request context attached for safe handoff.",
    },
  };
}
