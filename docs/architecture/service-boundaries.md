# Service boundaries and ownership

## apps/web

- Renders user-facing map/feed/posting surfaces.
- Uses API contracts only; does not directly consume indexer/worker internals.

## services/api

- Responsible for synchronous request/response APIs.
- Owns identity flow boundaries and external client contract compatibility.

## services/indexer

- Responsible for ingestion normalization and read-model indexing.
- Produces/consumes event contracts defined in shared package.

## services/moderation-worker

- Responsible for asynchronous moderation actions and policy evaluation pipeline stubs.
- Owns moderation decision event boundary.

## packages/shared

- Shared env/config contract and validation.
- Shared cross-service contracts and event interfaces.
