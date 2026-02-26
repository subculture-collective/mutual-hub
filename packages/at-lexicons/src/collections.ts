export const atLexiconCollections = {
  aidPost: "com.mutualaid.hub.aidPost",
  volunteerProfile: "com.mutualaid.hub.volunteerProfile",
  conversationMetadata: "com.mutualaid.hub.conversationMetadata",
  moderationReport: "com.mutualaid.hub.moderationReport",
  resourceDirectory: "com.mutualaid.hub.resourceDirectory",
} as const;

export type AtCollectionName = (typeof atLexiconCollections)[keyof typeof atLexiconCollections];
