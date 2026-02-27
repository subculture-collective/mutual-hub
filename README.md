# Mutual Hub

AT Protocol-native mutual aid platform with a web client, query API, ingestion/indexing pipeline, and moderation worker.

This monorepo is designed for fast local development with deterministic fixtures, strong type contracts, and CI quality gates.

## What’s in this repo

- `apps/web` — Vite + React + TypeScript + Tailwind frontend
- `services/api` — HTTP API for query/chat/volunteer flows
- `services/indexer` — ingestion + indexing service
- `services/moderation-worker` — moderation/trust-safety worker
- `packages/shared` — shared contracts, config/env schemas, utilities
- `packages/at-lexicons` — AT lexicon schemas, fixtures, and validators

## Tech stack

- Node.js + TypeScript (monorepo workspaces)
- React + Vite + Tailwind (web)
- Vitest + Playwright (unit + browser E2E)
- Optional local Postgres for API datasource mode

## Prerequisites

- Node.js `>=20.19.0`
- npm
- Docker (only needed for Postgres mode)

## Quick start

1. Install dependencies: `npm ci`
2. Create local env file: copy `.env.example` → `.env`
3. Start the app surfaces you need:
   - Web: `npm run dev:web`
   - API: `npm run dev:api`
   - Indexer: `npm run dev:indexer`
   - Moderation worker: `npm run dev:moderation`

Default local URLs:

- Web: `http://localhost:5173`
- API health: `http://localhost:4000/health`
- Indexer health: `http://localhost:4100/health`
- Moderation health: `http://localhost:4200/health`

## API datasource modes

The API supports two datasource modes:

- `fixture` (default): deterministic in-memory data for local development
- `postgres`: local DB-backed mode for integration testing

### Postgres mode

1. Start Postgres: `npm run db:up`
2. Set in `.env`:
   - `API_DATA_SOURCE=postgres`
   - `API_DATABASE_URL=postgresql://mutual_hub:mutual_hub@localhost:5432/mutual_hub`
3. Seed deterministic data: `npm run db:seed`
4. Start API in postgres mode: `npm run dev:api:postgres`

Additional seed scripts (API workspace):

- Append mode: `npm run db:seed:append -w @mutual-hub/api`
- Phase 3 fixtures only: `npm run db:seed:phase3 -w @mutual-hub/api`

Stop Postgres when done: `npm run db:down`

## Common commands

- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Unit tests: `npm run test`
- Moderation/privacy regression suite: `npm run test:phase7`
- End-to-end contract flow: `npm run test:phase8-e2e`
- Browser E2E (web): `npm run test:e2e -w @mutual-hub/web`
- Build all workspaces: `npm run build`
- Combined local gate: `npm run check`

## Architecture and protocol docs

- `docs/architecture/domain-map.md`
- `docs/architecture/service-boundaries.md`
- `docs/architecture/adr/0001-v1-stack-and-domain-boundaries.md`
- `docs/at-protocol/README.md`
- `docs/at-protocol/identity-session.md`
- `docs/at-protocol/lexicon-versioning.md`
- `docs/at-protocol/tombstone-contract.md`
- `docs/quality-gates.md`

## Notes for contributors

- Keep cross-service contracts in `packages/shared`.
- Prefer deterministic fixtures in tests.
- Treat geoprivacy/moderation regressions as release blockers.
