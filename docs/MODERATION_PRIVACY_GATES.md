## Moderation + Privacy Release Gates

This document defines the regression gate criteria for roadmap Phase 7 (`#34`, `#36`, `#38`, `#40`).

### Gate objective

Block release when moderation controls or geoprivacy safeguards regress.

### Gate command

- Workspace command: `npm run test:moderation-privacy`
- CI step: **Run moderation/privacy release gates** in `.github/workflows/ci.yml`

### Required coverage areas

1. **Moderation queue + policy actions**
    - Reported content enters queue with context (`reason`, `details`, reporter count)
    - Policy actions deterministically set visibility (`allow`, `delist`, `suspend_visibility`)
    - Appeal states are represented and transitionable (`submitted`, `under_review`, `approved`, `rejected`)
    - Moderator action audit trail is persisted and queryable

2. **Anti-spam controls**
    - Chat burst throttling blocks abusive send rate
    - Post submission throttling blocks abusive bursts
    - Duplicate-content heuristics block repeated spam patterns
    - Suspicious pattern signals are generated for moderation monitoring
    - Abuse metrics counters are emitted for operational visibility

3. **Privacy hardening**
    - Public indexed coordinates are snapped to privacy grid and minimum precision policy
    - Repeated updates do not degrade privacy precision guarantees
    - Sensitive fields in logs/diagnostics are redacted consistently
    - Minimal logging policy emits allowlisted, redacted payloads

### Failure policy

Any failure in these suites blocks merge/release flow until fixed.
