## Plan: AT-Native Mutual Aid Hub v1

Build a web-first, fully AT Protocol-native mutual aid hub with map + feed + 1:1 chat, plus resource directory and volunteer onboarding. Use a phased, testable architecture: AT identity and records as source of truth, a dedicated indexer for geospatial/feed discovery, and strict geoprivacy/moderation from day one.

**Steps**
1. Phase 1 — Project foundation and architecture baseline
   1.1 Create a web app shell and service boundaries (web client, AT indexer/query API, moderation worker).
   1.2 Define shared config, environment model, lint/test setup, and CI checks for all services.
   1.3 Establish domain modules: identity, aid records, geo, feed ranking, messaging, moderation, directory, volunteer onboarding.

2. Phase 2 — AT Protocol data model and identity (*depends on 1*)
   2.1 Define and version AT Lexicon schemas for: aid posts, volunteer profile metadata, conversation metadata, moderation/report records, resource-directory records.
   2.2 Implement AT auth/session flow (DID-based identity, handle resolution, session refresh).
   2.3 Add record creation/update/delete primitives with schema validation and tombstone/delete handling.

3. Phase 3 — Firehose ingestion + query layer (*depends on 2*)
   3.1 Build firehose consumer to ingest hub records and normalize into query-optimized storage.
   3.2 Implement geospatial indexing (approximate coordinates only), full-text search, category/status indexes.
   3.3 Expose query endpoints for map/feed/directory with server-side filters (radius, category, urgency, freshness, status).
   3.4 Add ranking pipeline for feed/map cards (distance band + recency + trust signals).

4. Phase 4 — Core UX: map + feed + posting (*depends on 3; 4.2 parallel with 4.1 after shared UI primitives exist*)
   4.1 Map experience: clustered markers, approximate-area display, detail drawer, filter chips, and “contact helper” CTA.
   4.2 Feed experience: latest + nearby tabs, create/edit/close post flow, urgency badges, status lifecycle.
   4.3 Shared posting form with category taxonomy, time window, accessibility tags, and geoprivacy guardrails.

5. Phase 5 — Chat triage/routing (*depends on 2 and 3*)
   5.1 Implement 1:1 chat initiation from a post with request context attached.
   5.2 Implement routing assistant logic: determines best destination (post author, volunteer pool, verified resource) and suggests handoff path.
   5.3 Persist conversation metadata on-protocol; keep message transport AT-native (DID-targeted/encrypted path) and provide graceful fallback notice if recipient cannot receive messages.
   5.4 Add safety controls: report/block/mute in chat, abuse keyword flagging, rate limits.

6. Phase 6 — v1 extras requested by user (*depends on 3; parallel with 4/5 for UI pieces*)
   6.1 Resource directory: shelters/clinics/food banks with map overlays, open-hours metadata, and eligibility notes.
   6.2 Volunteer onboarding: create volunteer profile, skills/availability capture, verification checkpoints, and match-preference settings.

7. Phase 7 — Moderation, trust, and privacy hardening (*depends on 4/5/6*)
   7.1 Add content/report review queues and policy actions (delist, suspend visibility, appeal status).
   7.2 Enforce anti-spam controls (post/chat rate limiting, duplicate detection, suspicious pattern detection).
   7.3 Privacy hardening: coordinate precision limits, no exact public pins, redaction and minimal logging policy.

8. Phase 8 — Verification, launch readiness, and pilot rollout (*depends on 1-7*)
   8.1 Automated tests: schema validation, ingestion correctness, ranking logic, privacy constraints, chat routing flows.
   8.2 End-to-end tests: create request → discover via map/feed → initiate chat → successful handoff to aid source.
   8.3 Operational checks: monitoring/alerts, moderation SLA dashboards, incident playbook, seed-data scripts.
   8.4 Pilot rollout: one-region beta, telemetry review, and issue triage cadence before wider launch.

**Relevant files**
- `/home/onnwee/Documents/Code/onnwee/mutual-hub/apps/web/package.json` — Web app dependencies/scripts baseline.
- `/home/onnwee/Documents/Code/onnwee/mutual-hub/apps/web/src/app/(public)/map/page.tsx` — Main map discovery surface.
- `/home/onnwee/Documents/Code/onnwee/mutual-hub/apps/web/src/app/(public)/feed/page.tsx` — Feed and posting timeline.
- `/home/onnwee/Documents/Code/onnwee/mutual-hub/apps/web/src/app/(public)/resources/page.tsx` — Resource directory UI.
- `/home/onnwee/Documents/Code/onnwee/mutual-hub/apps/web/src/app/(public)/volunteer/page.tsx` — Volunteer onboarding flow.
- `/home/onnwee/Documents/Code/onnwee/mutual-hub/apps/web/src/features/chat/` — Chat initiation/routing UI and state.
- `/home/onnwee/Documents/Code/onnwee/mutual-hub/apps/web/src/features/posts/` — Aid post creation and lifecycle logic.
- `/home/onnwee/Documents/Code/onnwee/mutual-hub/packages/at-lexicons/com.mutualaid.hub.*.json` — AT schema definitions.
- `/home/onnwee/Documents/Code/onnwee/mutual-hub/services/indexer/src/firehose/consumer.ts` — Firehose ingestion entrypoint.
- `/home/onnwee/Documents/Code/onnwee/mutual-hub/services/indexer/src/indexing/geo-index.ts` — Geospatial normalization/index logic.
- `/home/onnwee/Documents/Code/onnwee/mutual-hub/services/indexer/src/api/search.ts` — Map/feed/directory query handlers.
- `/home/onnwee/Documents/Code/onnwee/mutual-hub/services/indexer/src/ranking/rankAid.ts` — Ranking algorithm.
- `/home/onnwee/Documents/Code/onnwee/mutual-hub/services/indexer/src/moderation/` — Spam/abuse/delist pipelines.
- `/home/onnwee/Documents/Code/onnwee/mutual-hub/packages/shared/src/types/aid.ts` — Shared domain types.
- `/home/onnwee/Documents/Code/onnwee/mutual-hub/packages/shared/src/privacy/location.ts` — Geoprivacy precision/redaction helpers.
- `/home/onnwee/Documents/Code/onnwee/mutual-hub/.github/workflows/ci.yml` — Lint/test/typecheck pipeline.

**Verification**
1. Contract validation: all sample AT records pass schema validation and round-trip serialization tests.
2. Ingestion correctness: firehose replay fixture yields deterministic indexed records and honors deletes/tombstones.
3. Geoprivacy tests: public APIs never return exact coordinates; precision limits remain enforced under repeated posts.
4. Search/ranking tests: map/feed queries satisfy radius/category/status constraints and stable ranking expectations.
5. Chat routing tests: triage picks expected destination for representative scenarios (direct helper, volunteer, resource directory).
6. Moderation tests: report/block/mute and spam-rate limits correctly alter visibility and routing.
7. End-to-end browser tests: request creation, discovery, chat handoff, and closure flow all pass.
8. Pilot readiness checklist: monitoring, alerting, incident playbook, and moderation dashboard validated in staging.

**Decisions**
- Included in v1: web-only launch, fully AT-native architecture, 1:1 post-linked chat, approximate-area geoprivacy, resource directory, volunteer onboarding.
- Excluded from v1: native mobile apps, public group chat rooms, advanced reputation marketplace, route optimization, and multi-region rollout.
- Assumption: AT-native message transport capability is available for recipients; if not, v1 ships with explicit recipient-capability handling and safe fallback messaging status.

**Further Considerations**
1. Coordinate precision policy recommendation: start at ~300–500m public precision; tighten to ~100–200m only for verified local crises with moderator approval.
2. Launch policy recommendation: restrict sensitive categories (childcare/medical) to verified volunteers in v1 to reduce safety risk.
3. Taxonomy recommendation: finalize a constrained category list early, then expand after pilot data to keep moderation manageable.