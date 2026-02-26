import { type ResourceDirectoryLexiconRecord, atLexiconCollections } from "@mutual-hub/at-lexicons";

import type { FirehoseEvent } from "../firehose/consumer.js";

export interface ResourceDirectoryFixture {
  uri: string;
  record: ResourceDirectoryLexiconRecord;
}

const fixtureTimestamp = "2026-02-26T08:00:00.000Z";

export const resourceDirectoryFixtures: readonly ResourceDirectoryFixture[] = [
  {
    uri: `at://did:plc:org-harbor/${atLexiconCollections.resourceDirectory}/harbor-shelter`,
    record: {
      id: "harbor-shelter",
      name: "Harbor Night Shelter",
      type: "shelter",
      location: {
        lat: 1.3044,
        lng: 103.8212,
        precisionMeters: 250,
        areaLabel: "Harbor District",
      },
      openHours: "Open 24/7 for emergency overnight intake",
      eligibilityNotes: "Adults and families welcome. Pet-friendly beds available by request.",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp,
    },
  },
  {
    uri: `at://did:plc:org-northside/${atLexiconCollections.resourceDirectory}/northside-clinic`,
    record: {
      id: "northside-clinic",
      name: "Northside Community Clinic",
      type: "clinic",
      location: {
        lat: 1.3162,
        lng: 103.8138,
        precisionMeters: 200,
        areaLabel: "Northside",
      },
      openHours: "Walk-in evenings Mon-Fri 18:00-22:00",
      eligibilityNotes:
        "Primary care and wound support. No insurance required for urgent consults.",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp,
    },
  },
  {
    uri: `at://did:plc:org-sunrise/${atLexiconCollections.resourceDirectory}/sunrise-food-bank`,
    record: {
      id: "sunrise-food-bank",
      name: "Sunrise Food Bank",
      type: "food_bank",
      location: {
        lat: 1.2978,
        lng: 103.8083,
        precisionMeters: 300,
        areaLabel: "Civic Centre",
      },
      openHours: "Tue-Sat 09:00-17:00",
      eligibilityNotes: "Families with children under 12 receive priority meal bundles.",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp,
    },
  },
];

export function toDirectoryCreateEvents(
  fixtures: readonly ResourceDirectoryFixture[] = resourceDirectoryFixtures,
): FirehoseEvent[] {
  return fixtures.map((fixture) => ({
    op: "create" as const,
    uri: fixture.uri,
    record: fixture.record,
    receivedAt: fixture.record.updatedAt,
  }));
}
