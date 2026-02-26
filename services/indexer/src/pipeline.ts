import {
    DiscoveryIndexStore,
    FirehoseConsumer,
    buildPhase3FixtureFirehoseEvents,
    type AidQueryInput,
    type DirectoryQueryInput,
} from '@mutual-hub/shared';

export interface IndexerPipelineIngestResult {
    normalizedCount: number;
    failureCount: number;
    checkpointSeq: number;
    metrics: ReturnType<FirehoseConsumer['getMetrics']>;
    failures: ReturnType<FirehoseConsumer['ingest']>['failures'];
}

export class IndexerPipeline {
    private consumer = new FirehoseConsumer();
    private store = new DiscoveryIndexStore();

    ingest(rawEvents: readonly unknown[]): IndexerPipelineIngestResult {
        const ingested = this.consumer.ingest(rawEvents);
        this.store.applyEvents(ingested.normalizedEvents);

        return {
            normalizedCount: ingested.normalizedEvents.length,
            failureCount: ingested.failures.length,
            checkpointSeq: ingested.checkpointSeq,
            metrics: ingested.metrics,
            failures: ingested.failures,
        };
    }

    replay(rawEvents: readonly unknown[]): IndexerPipelineIngestResult {
        this.consumer = new FirehoseConsumer();
        this.store = new DiscoveryIndexStore();

        return this.ingest(rawEvents);
    }

    queryMap(input: AidQueryInput) {
        return this.store.queryMap(input);
    }

    queryFeed(input: AidQueryInput) {
        return this.store.queryFeed(input);
    }

    queryDirectory(input: DirectoryQueryInput) {
        return this.store.queryDirectory(input);
    }

    getStats() {
        return this.store.getStats();
    }

    getMetrics() {
        return this.consumer.getMetrics();
    }

    getCheckpointSeq() {
        return this.consumer.getCheckpointSeq();
    }

    getLogs() {
        return this.consumer.getLogs();
    }
}

export const createFixtureIndexerPipeline = (): IndexerPipeline => {
    const pipeline = new IndexerPipeline();
    pipeline.ingest(buildPhase3FixtureFirehoseEvents());
    return pipeline;
};
