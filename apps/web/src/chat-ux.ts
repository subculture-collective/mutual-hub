export type ChatEntrySurface = 'map' | 'feed' | 'detail';

export interface ChatInitiationIntent {
    aidPostUri: string;
    aidPostTitle: string;
    recipientDid: string;
    initiatedFrom: ChatEntrySurface;
}

export interface ChatInitiationRequest {
    aidPostUri: string;
    initiatedByDid: string;
    recipientDid: string;
    initiatedFrom: ChatEntrySurface;
}

export interface ChatFallbackNotice {
    code: 'RECIPIENT_CAPABILITY_MISSING';
    message: string;
    safeForUser: true;
    transportPath: 'resource-fallback' | 'manual-fallback';
}

export interface ChatLaunchSuccess {
    conversationUri: string;
    created: boolean;
    transportPath: 'atproto-direct' | 'resource-fallback' | 'manual-fallback';
    fallbackNotice?: ChatFallbackNotice;
}

export interface ChatLaunchState {
    status: 'idle' | 'submitting' | 'success' | 'error';
    surface?: ChatEntrySurface;
    conversationUri?: string;
    fallbackNotice?: ChatFallbackNotice;
    errorMessage?: string;
}

export type ChatLaunchEvent =
    | {
          type: 'submit';
          intent: ChatInitiationIntent;
      }
    | {
          type: 'success';
          intent: ChatInitiationIntent;
          result: ChatLaunchSuccess;
      }
    | {
          type: 'failure';
          intent: ChatInitiationIntent;
          errorMessage: string;
      }
    | {
          type: 'reset';
      };

export const defaultChatLaunchState: Readonly<ChatLaunchState> = Object.freeze({
    status: 'idle' as const,
});

export const buildChatInitiationRequest = (
    intent: ChatInitiationIntent,
    initiatedByDid: string,
): ChatInitiationRequest => {
    return {
        aidPostUri: intent.aidPostUri,
        initiatedByDid,
        recipientDid: intent.recipientDid,
        initiatedFrom: intent.initiatedFrom,
    };
};

export const isChatInitiationAllowed = (input: {
    initiatedByDid: string;
    recipientDid: string;
    hasPermission: boolean;
}): boolean => {
    if (!input.hasPermission) {
        return false;
    }

    return input.initiatedByDid !== input.recipientDid;
};

export const reduceChatLaunchState = (
    _current: ChatLaunchState,
    event: ChatLaunchEvent,
): ChatLaunchState => {
    if (event.type === 'reset') {
        return { ...defaultChatLaunchState };
    }

    if (event.type === 'submit') {
        return {
            status: 'submitting',
            surface: event.intent.initiatedFrom,
        };
    }

    if (event.type === 'success') {
        return {
            status: 'success',
            surface: event.intent.initiatedFrom,
            conversationUri: event.result.conversationUri,
            fallbackNotice: event.result.fallbackNotice,
        };
    }

    return {
        status: 'error',
        surface: event.intent.initiatedFrom,
        errorMessage: event.errorMessage,
    };
};

export interface ChatStatusNotice {
    tone: 'success' | 'warning' | 'danger';
    message: string;
}

export const toChatStatusNotice = (
    state: ChatLaunchState,
): ChatStatusNotice | undefined => {
    if (state.status === 'error' && state.errorMessage) {
        return {
            tone: 'danger',
            message: state.errorMessage,
        };
    }

    if (state.status === 'success' && state.fallbackNotice) {
        return {
            tone: 'warning',
            message: state.fallbackNotice.message,
        };
    }

    if (state.status === 'success' && state.conversationUri) {
        return {
            tone: 'success',
            message: `Chat ready: ${state.conversationUri}`,
        };
    }

    return undefined;
};
