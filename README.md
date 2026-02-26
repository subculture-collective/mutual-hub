# mutual-hub

Phase 1 scaffold for an AT Protocol-native mutual aid hub.

## Included in this baseline

- Monorepo service boundaries:
  - `apps/web` (web shell)
  - `services/indexer` (firehose + query/ranking boundary)
  - `services/moderation-worker` (policy and safety worker boundary)
  - `packages/config` (shared environment model)
  - `packages/shared` (domain modules)
- Shared lint/typecheck/test scripts across all services.
- CI workflow (`.github/workflows/ci.yml`) running lint + typecheck + tests.

## Local verification

1. Install dependencies
2. Run `npm run ci`
