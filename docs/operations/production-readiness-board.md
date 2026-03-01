# Production Readiness Board -- Milestone Map

Tracks: #68 (Production Readiness), #95 (Board + Milestone Map), #71 (Epic A -- Governance)

---

## Milestone Overview

| Milestone | Title | Target Date | Epic(s) | Sub-Epic |
|-----------|-------|-------------|---------|----------|
| **M0** | Foundation & Governance (Wave 0) | 2026-03-15 | A (#71) | #82 |
| **M1** | Runtime Durability | 2026-04-05 | B (#70) | #84 |
| **M2** | Core Product Lifecycle | 2026-04-19 | C (#72) | #83 |
| **M3** | Account & Privacy | 2026-05-03 | D (#75) | #85 |
| **M4** | Global UX (i18n + a11y) | 2026-05-17 | E (#73) | #86 |
| **M5** | Trust & Verification | 2026-06-07 | F (#74) | #87 |

---

## Issue-to-Milestone Assignment

### M0: Foundation & Governance (Wave 0)

| Issue | Title | Track | Owner | Status |
|-------|-------|-------|-------|--------|
| #94 | Define RACI for product, infra, moderation, incident command | A2 | TBD | Open |
| #95 | Create production readiness board and milestone map | A1 | TBD | Open |

### M1: Runtime Durability

| Issue | Title | Track | Owner | Status |
|-------|-------|-------|-------|--------|
| #96 | Replace moderation fixture service with durable queue/state backend | B2 | TBD | Open |
| #97 | Replace indexer fixture pipeline with persistent ingestion runtime | B1 | TBD | Open |
| #98 | Enforce strict production datasource modes and startup guards | B3 | TBD | Open |
| #99 | Add E2E contract path against production-like dependencies | B4 | TBD | Open |

### M2: Core Product Lifecycle

| Issue | Title | Track | Owner | Status |
|-------|-------|-------|-------|--------|
| #100 | Secrets management hardening | C1 | TBD | Open |
| #101 | Add supply-chain and container security gates in CI | C2 | TBD | Open |
| #102 | Harden API perimeter (rate limits, CORS, abuse controls) | C3 | TBD | Open |
| #103 | Implement data retention and deletion policy | C4 | TBD | Open |
| #116 | Implement canonical request lifecycle state machine end-to-end | G1 | TBD | Open |

### M3: Account & Privacy

| Issue | Title | Track | Owner | Status |
|-------|-------|-------|-------|--------|
| #104 | Build centralized metrics dashboards and SLI definitions | D1 | TBD | Open |
| #105 | Implement alerting policy for SLO burn and critical failures | D2 | TBD | Open |
| #106 | Implement backup, restore, and disaster recovery drills | D3 | TBD | Open |
| #107 | Create incident response runbook and execute game day | D4 | TBD | Open |
| #120 | Add account settings and privacy controls center | H2 | TBD | Open |

### M4: Global UX (i18n + a11y)

| Issue | Title | Track | Owner | Status |
|-------|-------|-------|-------|--------|
| #108 | Introduce staging environment parity with production | E1 | TBD | Open |
| #109 | Implement immutable image versioning and rollback strategy | E2 | TBD | Open |
| #110 | Implement progressive delivery (canary or weighted rollout) | E3 | TBD | Open |
| #111 | Run performance and scale validation | E4 | TBD | Open |
| #133 | Implement internationalization and localization framework | K4 | TBD | Open |
| #134 | Execute accessibility AA+ compliance program | K3 | TBD | Open |

### M5: Trust & Verification

| Issue | Title | Track | Owner | Status |
|-------|-------|-------|-------|--------|
| #112 | Build moderator operations console MVP and SOPs | F1 | TBD | Open |
| #113 | Publish legal and policy readiness pack | F2 | TBD | Open |
| #114 | Execute pilot rollout and go/no-go checklist | F3 | TBD | Open |
| #115 | Execute GA release and 7-day hypercare | F4 | TBD | Open |
| #131 | Add verification tiers for volunteers and organizations | J2 | TBD | Open |

---

## Board Views

### By Epic

| Epic | Ref | Issues | Milestone(s) |
|------|-----|--------|-------------|
| A: Program Governance | #71 | #94, #95 | M0 |
| B: Runtime Completeness | #70 | #96, #97, #98, #99 | M1 |
| C: Security & Privacy | #72 | #100, #101, #102, #103 | M2 |
| D: Reliability & Observability | #75 | #104, #105, #106, #107 | M3 |
| E: Release Engineering | #73 | #108, #109, #110, #111 | M4 |
| F: Trust-Safety & Launch | #74 | #112, #113, #114, #115 | M5 |

### By Blocker State

| Issue | Blocked By | Blocking | Notes |
|-------|-----------|----------|-------|
| #120 | #121 (H1) | -- | Informational dependency; does not block Wave 0 |
| #131 | #123 (H3) | -- | Informational dependency; does not block Wave 0 |
| #96 | -- | #98, #99 | Moderation runtime must exist before guards/E2E |
| #97 | -- | #98, #99 | Indexer runtime must exist before guards/E2E |
| #114 | #112, #113 | #115 | Pilot requires console + legal pack |
| #115 | #114 | -- | GA requires successful pilot |

### Wave 0 Issues (all link to #68)

All Wave 0 issues are tracked under the production readiness program (#68):

- #94 -- RACI definition (A2)
- #95 -- Board and milestone map (A1)
- #96 -- Moderation runtime (B2)
- #97 -- Indexer runtime (B1)
- #116 -- Request lifecycle (G1)
- #120 -- Account settings (H2)
- #131 -- Verification tiers (J2)
- #133 -- i18n framework (K4)
- #134 -- a11y compliance (K3)

---

## Setup Scripts

The following scripts automate GitHub milestone creation and issue linking. They require a `gh` CLI token with Issues (read/write) permission.

- `docs/operations/milestone-setup.sh` -- Creates milestones M0-M5
- `docs/operations/link-issues.sh` -- Adds tracking comments and blocker clarifications

### Running the scripts

```bash
# Ensure your gh token has Issues read/write scope
gh auth status

# Create milestones
./docs/operations/milestone-setup.sh

# Link issues to #68 and add blocker notes
./docs/operations/link-issues.sh

# Assign issues to milestones (manual step, example):
gh issue edit 94 --milestone "M0: Foundation & Governance (Wave 0)"
gh issue edit 95 --milestone "M0: Foundation & Governance (Wave 0)"
gh issue edit 96 --milestone "M1: Runtime Durability"
gh issue edit 97 --milestone "M1: Runtime Durability"
# ... etc.
```

---

## Assigning Issues to Milestones (Reference Commands)

```bash
# M0
gh issue edit 94 --milestone "M0: Foundation & Governance (Wave 0)"
gh issue edit 95 --milestone "M0: Foundation & Governance (Wave 0)"

# M1
gh issue edit 96 --milestone "M1: Runtime Durability"
gh issue edit 97 --milestone "M1: Runtime Durability"
gh issue edit 98 --milestone "M1: Runtime Durability"
gh issue edit 99 --milestone "M1: Runtime Durability"

# M2
gh issue edit 100 --milestone "M2: Core Product Lifecycle"
gh issue edit 101 --milestone "M2: Core Product Lifecycle"
gh issue edit 102 --milestone "M2: Core Product Lifecycle"
gh issue edit 103 --milestone "M2: Core Product Lifecycle"
gh issue edit 116 --milestone "M2: Core Product Lifecycle"

# M3
gh issue edit 104 --milestone "M3: Account & Privacy"
gh issue edit 105 --milestone "M3: Account & Privacy"
gh issue edit 106 --milestone "M3: Account & Privacy"
gh issue edit 107 --milestone "M3: Account & Privacy"
gh issue edit 120 --milestone "M3: Account & Privacy"

# M4
gh issue edit 108 --milestone "M4: Global UX (i18n + a11y)"
gh issue edit 109 --milestone "M4: Global UX (i18n + a11y)"
gh issue edit 110 --milestone "M4: Global UX (i18n + a11y)"
gh issue edit 111 --milestone "M4: Global UX (i18n + a11y)"
gh issue edit 133 --milestone "M4: Global UX (i18n + a11y)"
gh issue edit 134 --milestone "M4: Global UX (i18n + a11y)"

# M5
gh issue edit 112 --milestone "M5: Trust & Verification"
gh issue edit 113 --milestone "M5: Trust & Verification"
gh issue edit 114 --milestone "M5: Trust & Verification"
gh issue edit 115 --milestone "M5: Trust & Verification"
gh issue edit 131 --milestone "M5: Trust & Verification"
```

---

*Created as part of Wave 0 governance lane. Tracked by #95, #71, #68.*
