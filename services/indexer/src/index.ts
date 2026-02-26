import { createServer } from 'node:http';
import {
  CONTRACT_VERSION,
  loadIndexerConfig,
  type IndexerNormalizedAidEvent,
  type ServiceHealth
} from '@mutual-hub/shared';

const config = loadIndexerConfig();

const healthPayload: ServiceHealth = {
  service: 'indexer',
  status: 'ok',
  contractVersion: CONTRACT_VERSION,
  did: config.ATPROTO_SERVICE_DID
};

const sampleEvent: IndexerNormalizedAidEvent = {
  eventId: 'evt-phase1-sample',
  atUri: 'at://did:example:author/app.mutual.aid/abc123',
  authorDid: 'did:example:author',
  normalizedAt: new Date().toISOString(),
  domain: 'aid-records'
};

const server = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(healthPayload));
    return;
  }

  if (request.url === '/events/sample') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(sampleEvent));
    return;
  }

  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(config.INDEXER_PORT, '0.0.0.0', () => {
  console.log(
    `[indexer] listening on http://0.0.0.0:${config.INDEXER_PORT} (firehose=${config.INDEXER_FIREHOSE_URL})`
  );
});
