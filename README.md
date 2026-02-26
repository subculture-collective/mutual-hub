# Mutual Hub (Phase 2 Baseline)

This repository is scaffolded through **Phase 2** of roadmap issue #41.

## Stack

- Frontend: `apps/web` → Vite + React + TypeScript + Tailwind
- Backend services:
  - `services/api` (TypeScript)
  - `services/indexer` (TypeScript)
  - `services/moderation-worker` (TypeScript)
- Shared contracts/config: `packages/shared`
- AT Lexicon schemas + fixtures: `packages/at-lexicons`

## Phase 2 additions

- Versioned AT Lexicon schema set for all v1 record types.
- DID identity/session primitives with handle resolution and refresh semantics.
- Typed create/update/delete record primitives with schema validation and structured errors.
- Tombstone/delete propagation contract with round-trip serialization tests.

## Service boundaries

- **API service**: request/response boundary for web clients and downstream contracts.
- **Indexer service**: ingestion and normalization boundary for event streams.
- **Moderation worker**: asynchronous moderation and trust/safety processing boundary.
- **Shared package**: env/config schema and inter-service contract stubs.

Detailed domain and boundary docs:

- `docs/architecture/domain-map.md`
- `docs/architecture/service-boundaries.md`
- `docs/architecture/adr/0001-v1-stack-and-domain-boundaries.md`
- `docs/at-protocol/lexicon-versioning.md`
- `docs/at-protocol/identity-session.md`
- `docs/at-protocol/tombstone-contract.md`

## Local setup

1. Install dependencies:
   - `npm ci`
2. Copy config:
   - `.env.example` is provided
   - `.env` is included for local placeholder defaults

## Run services

- Web: `npm run dev:web`
- API: `npm run dev:api`
- Indexer: `npm run dev:indexer`
- Moderation worker: `npm run dev:moderation`

Each backend service exposes a stub health endpoint:

- API: `GET http://localhost:4000/health`
- Indexer: `GET http://localhost:4100/health`
- Moderation worker: `GET http://localhost:4200/health`

## Quality gates

- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Unit tests: `npm run test`
- Combined: `npm run check`

CI runs these on pull requests and pushes to `main`.
