import type { RoutingDecisionInput, RoutingDestinationType } from "./chat-routing.js";

export interface RoutingFixture {
  name: string;
  input: RoutingDecisionInput;
  expectedDestination: RoutingDestinationType;
  expectedRule: string;
}

export const routingFixtures: readonly RoutingFixture[] = [
  {
    name: "direct author route wins when reachable",
    input: {
      requesterDid: "did:plc:req-1",
      postAuthorDid: "did:plc:author-1",
      postUri: "at://did:plc:author-1/com.mutualaid.hub.aidPost/p1",
      postCategory: "food",
      postAuthorReachable: true,
      volunteerCandidates: [
        {
          did: "did:plc:vol-1",
          verified: true,
          acceptsChats: true,
          supportedCategories: ["food"],
          distanceMeters: 100,
        },
      ],
    },
    expectedDestination: "post_author",
    expectedRule: "direct_post_author",
  },
  {
    name: "verified volunteer fallback selected deterministically",
    input: {
      requesterDid: "did:plc:req-2",
      postAuthorDid: "did:plc:author-2",
      postUri: "at://did:plc:author-2/com.mutualaid.hub.aidPost/p2",
      postCategory: "medical",
      postAuthorReachable: false,
      volunteerCandidates: [
        {
          did: "did:plc:vol-b",
          verified: true,
          acceptsChats: true,
          supportedCategories: ["medical"],
          distanceMeters: 1800,
          lastActiveAt: "2026-02-25T06:00:00.000Z",
        },
        {
          did: "did:plc:vol-a",
          verified: true,
          acceptsChats: true,
          supportedCategories: ["medical"],
          distanceMeters: 400,
          lastActiveAt: "2026-02-25T07:00:00.000Z",
        },
      ],
    },
    expectedDestination: "volunteer_pool",
    expectedRule: "verified_volunteer_match",
  },
  {
    name: "resource directory fallback used when volunteer unavailable",
    input: {
      requesterDid: "did:plc:req-3",
      postAuthorDid: "did:plc:author-3",
      postUri: "at://did:plc:author-3/com.mutualaid.hub.aidPost/p3",
      postCategory: "shelter",
      postAuthorReachable: false,
      volunteerCandidates: [
        {
          did: "did:plc:vol-z",
          verified: false,
          acceptsChats: true,
          supportedCategories: ["shelter"],
        },
      ],
      resourceCandidates: [
        {
          id: "resource-b",
          uri: "at://did:plc:org/com.mutualaid.hub.resourceDirectory/rb",
          type: "shelter",
          verified: true,
          acceptsIntake: true,
          priority: 3,
          supportedCategories: ["shelter"],
        },
        {
          id: "resource-a",
          uri: "at://did:plc:org/com.mutualaid.hub.resourceDirectory/ra",
          type: "shelter",
          verified: true,
          acceptsIntake: true,
          priority: 1,
          supportedCategories: ["shelter"],
        },
      ],
    },
    expectedDestination: "resource_directory",
    expectedRule: "verified_resource_match",
  },
  {
    name: "manual review fallback when no route is available",
    input: {
      requesterDid: "did:plc:req-4",
      postAuthorDid: "did:plc:author-4",
      postUri: "at://did:plc:author-4/com.mutualaid.hub.aidPost/p4",
      postCategory: "transport",
      postAuthorReachable: false,
      volunteerCandidates: [],
      resourceCandidates: [],
    },
    expectedDestination: "manual_review",
    expectedRule: "manual_review_fallback",
  },
];
