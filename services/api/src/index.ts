import { createServer } from 'node:http';
import { CONTRACT_VERSION, loadApiConfig, type ApiQueryAidResponse, type ServiceHealth } from '@mutual-hub/shared';

const config = loadApiConfig();

const healthPayload: ServiceHealth = {
  service: 'api',
  status: 'ok',
  contractVersion: CONTRACT_VERSION,
  did: config.ATPROTO_SERVICE_DID
};

const sampleResponse: ApiQueryAidResponse = {
  results: []
};

const server = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(healthPayload));
    return;
  }

  if (request.url === '/contracts') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ sample: sampleResponse, contractVersion: CONTRACT_VERSION }));
    return;
  }

  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(config.API_PORT, config.API_HOST, () => {
  console.log(
    `[api] listening on http://${config.API_HOST}:${config.API_PORT} (contracts=${CONTRACT_VERSION})`
  );
});
