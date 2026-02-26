import { parseEnv } from "@mutual-hub/config";

import {
  type AidDiscoveryFilters,
  type DirectoryDiscoveryFilters,
  searchDirectoryResources,
  searchFeedCards,
  searchMapCards,
} from "./api/search.js";
import {
  type FirehoseEvent,
  type NormalizedFirehoseEvent,
  normalizeFirehoseEvent,
  normalizeFirehoseEvents,
} from "./firehose/consumer.js";
import { type IndexStoreSnapshot, QueryIndexStore } from "./indexing/query-store.js";

export interface IndexerService {
  service: "indexer";
  port: number;
  normalizeFirehoseEvent: typeof normalizeFirehoseEvent;
  normalizeFirehoseEvents: typeof normalizeFirehoseEvents;
  ingestFirehoseEvent: (event: FirehoseEvent) => NormalizedFirehoseEvent;
  ingestFirehoseEvents: (events: readonly FirehoseEvent[]) => NormalizedFirehoseEvent[];
  searchMapCards: (filters?: AidDiscoveryFilters) => ReturnType<typeof searchMapCards>;
  searchFeedCards: (filters?: AidDiscoveryFilters) => ReturnType<typeof searchFeedCards>;
  searchDirectoryResources: (
    filters?: DirectoryDiscoveryFilters,
  ) => ReturnType<typeof searchDirectoryResources>;
  getSnapshot: () => IndexStoreSnapshot;
}

export function createIndexerService(rawEnv: NodeJS.ProcessEnv = process.env): IndexerService {
  const env = parseEnv(rawEnv);
  const store = new QueryIndexStore(env.GEO_PUBLIC_PRECISION_METERS);

  const ingestFirehoseEvent = (event: FirehoseEvent): NormalizedFirehoseEvent => {
    const normalized = normalizeFirehoseEvent(event);
    store.applyFirehoseEvent(normalized);
    return normalized;
  };

  const ingestFirehoseEvents = (events: readonly FirehoseEvent[]): NormalizedFirehoseEvent[] => {
    const normalizedEvents = normalizeFirehoseEvents(events);
    for (const event of normalizedEvents) {
      store.applyFirehoseEvent(event);
    }

    return normalizedEvents;
  };

  return {
    service: "indexer",
    port: env.INDEXER_PORT,
    normalizeFirehoseEvent,
    normalizeFirehoseEvents,
    ingestFirehoseEvent,
    ingestFirehoseEvents,
    searchMapCards: (filters = {}) => searchMapCards(store, filters),
    searchFeedCards: (filters = {}) => searchFeedCards(store, filters),
    searchDirectoryResources: (filters = {}) => searchDirectoryResources(store, filters),
    getSnapshot: () => store.getSnapshot(),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify({ service: "indexer", ready: true }, null, 2));
}
