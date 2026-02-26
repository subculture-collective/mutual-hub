# Lexicon schemas and versioning (Phase 2 / P2.1)

This document defines the v1 AT Lexicon schema set, constraints, and evolution policy.

## v1 schema set

All records are published with revision `1.0.0`:

- `app.mutualhub.aid.post`
- `app.mutualhub.volunteer.profile`
- `app.mutualhub.conversation.meta`
- `app.mutualhub.moderation.report`
- `app.mutualhub.directory.resource`

Canonical schema JSON files live in:

- `packages/at-lexicons/src/lexicons/*.json`

Executable validators and typed record models live in:

- `packages/at-lexicons/src/validators.ts`

## Field-level constraints (summary)

### `app.mutualhub.aid.post`

Required fields:

- `$type`, `version`, `title`, `description`, `category`, `urgency`, `status`, `location`, `createdAt`

Key constraints:

- `title`: 1..140 chars
- `description`: 1..5000 chars
- `urgency`: `low | medium | high | critical`
- `status`: `open | in-progress | resolved | closed`
- `location.precisionKm`: 0.1..50

### `app.mutualhub.volunteer.profile`

Required fields:

- `$type`, `version`, `displayName`, `capabilities`, `availability`, `contactPreference`, `createdAt`

Key constraints:

- `displayName`: 1..80 chars
- `capabilities`: non-empty array
- `availability`: `immediate | within-24h | scheduled | unavailable`

### `app.mutualhub.conversation.meta`

Required fields:

- `$type`, `version`, `aidPostUri`, `participantDids`, `status`, `createdAt`

Key constraints:

- `aidPostUri` must be `at://...`
- exactly 2 participant DIDs
- `status`: `open | handoff | closed`

### `app.mutualhub.moderation.report`

Required fields:

- `$type`, `version`, `subjectUri`, `reporterDid`, `reason`, `createdAt`

Key constraints:

- `subjectUri` must be `at://...`
- `reporterDid` must be DID-formatted
- `reason`: `spam | abuse | fraud | other`

### `app.mutualhub.directory.resource`

Required fields:

- `$type`, `version`, `name`, `category`, `serviceArea`, `contact`, `verificationStatus`, `createdAt`

Key constraints:

- `name`: 1..120 chars
- `serviceArea`: 1..120 chars
- `contact`: must include at least one of `url` or `phone`
- `verificationStatus`: `unverified | community-verified | partner-verified`

## Semantic versioning policy

- **PATCH**: doc clarifications or non-breaking validator bug fixes.
- **MINOR**: backward-compatible additive fields (optional only).
- **MAJOR**: breaking field removals/renames/constraint tightening.

Migration notes are required for MAJOR changes.

## Fixtures and validation evidence

Fixtures used by tests:

- Valid: `packages/at-lexicons/src/fixtures/valid/*.json`
- Invalid: `packages/at-lexicons/src/fixtures/invalid/*.json`

Validation and schema coverage tests:

- `packages/at-lexicons/src/lexicons.test.ts`
