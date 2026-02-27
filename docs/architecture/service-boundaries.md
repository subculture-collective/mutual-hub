# Service boundaries and ownership

## apps/web

- Renders user-facing map/feed/posting surfaces.
- Uses API contracts only; does not directly consume indexer/worker internals.

## services/api

- Responsible for synchronous request/response APIs.
- Owns identity flow boundaries and external client contract compatibility.
- Owns chat anti-spam safety evaluation and safety metrics exposure.

## services/indexer

- Responsible for ingestion normalization and read-model indexing.
- Produces/consumes event contracts defined in shared package.

## services/moderation-worker

- Responsible for asynchronous moderation queue views and policy action workflows.
- Owns moderation decision/event + appeal audit boundaries.

## packages/shared

- Shared env/config contract and validation.
- Shared cross-service contracts and event interfaces.
- Shared moderation queue domain, anti-spam logic primitives, and privacy redaction utilities.
