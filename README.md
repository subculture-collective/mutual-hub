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
- Moderation/privacy release gate (`npm run test:moderation-privacy`) documented in
  `docs/MODERATION_PRIVACY_GATES.md` and enforced in CI.

## Local verification

1. Install dependencies
2. Run `npm run ci`
3. Run `npm run test:moderation-privacy` for release-gate checks
