# Mutual Hub (Phase 6 Baseline)

This repository is scaffolded through **Phase 6** of roadmap issue #41.

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

## Phase 3 additions

- Firehose ingestion consumer with deterministic normalization and replay support.
- In-memory geo/full-text/category/status index strategy for aid + directory records.
- Server-side query APIs for map/feed/directory with validation, filters, and pagination.
- Deterministic ranking pipeline combining distance band, recency, and trust signals.

## Phase 4 additions

- Shared discovery filter model + chip primitives for map/feed surfaces.
- Map UX logic for clustering, approximate markers, and detail drawer actions.
- Feed UX logic for latest/nearby tabs and post lifecycle interactions.
- Shared posting form validation + geoprivacy payload shaping.

## Phase 5 additions

- Post-linked 1:1 chat initiation contract with map/feed/detail source context.
- Deterministic routing assistant for post author vs volunteer pool vs verified resource.
- Conversation metadata persistence with recipient-capability fallback notices.
- Chat safety controls: block/mute/report, abuse keyword flagging, and rate limits.

## Phase 6 additions

- Resource directory operational metadata ingestion/indexing (location overlays, open hours, eligibility notes).
- Resource directory UX logic for overlays, detail panel actions, and accessible loading/empty/error states.
- Volunteer onboarding/profile management domain with validation and checkpoint tracking.
- Preference-aware volunteer routing inputs integrated into deterministic routing decisions.

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
- `docs/architecture/phase3-ingestion-query.md`
- `docs/architecture/phase5-chat-routing.md`
- `docs/architecture/phase6-directory-onboarding.md`

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

Each backend service exposes a health endpoint:

- API: `GET http://localhost:4000/health`
- Indexer: `GET http://localhost:4100/health`
- Moderation worker: `GET http://localhost:4200/health`

Phase 6 service endpoints:

- API:
    - `GET /query/map`
    - `GET /query/feed`
    - `GET /query/directory`
    - `GET /chat/initiate`
    - `GET /chat/route`
    - `GET /chat/conversations`
    - `GET /chat/safety/evaluate`
    - `GET /chat/safety/block`
    - `GET /chat/safety/mute`
    - `GET /chat/safety/report`
    - `GET /chat/safety/signals/drain`
    - `GET /chat/route/preference-aware`
    - `GET /volunteer/profile/upsert`
    - `GET /volunteer/profiles`
- Indexer:
    - `GET /ingestion/metrics`
    - `GET /ingestion/logs`
    - `GET /indexes/stats`

## Quality gates

- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Unit tests: `npm run test`
- Combined: `npm run check`

CI runs these on pull requests and pushes to `main`.
