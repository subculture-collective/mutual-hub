# UI/UX Transformation Plan

## Objective

Implement `design-system.md` (Neo-Retro Brutal hybrid) into the web surface in safe, incremental steps.

## Scope

- In scope: `apps/web` shell UI and shared base components used by the shell.
- Out of scope: indexer/moderation service logic and backend package APIs.

## Phased rollout

### Phase 1 — Token and global foundation

1. Add design tokens (color, typography, border, shadow, spacing) in one global style entry point.
2. Add baseline typography and link states.
3. Add focus-visible and reduced-motion base rules.

**Acceptance criteria**

- Tokens are centralized (no duplicate scattered hex values in core UI files).
- Keyboard focus ring is visible on all interactive controls.
- `prefers-reduced-motion` disables non-essential animations.

**Rollback**

- Revert token layer only; UI components continue to render with default styling.

---

### Phase 2 — Base primitives

Create reusable primitives:

- `Button`
- `Card`
- `Panel` (retro titlebar variant)
- `Input`
- `Badge`
- `TextLink`

**Acceptance criteria**

- Components support default + focus + hover + active states.
- Bevel/pressed states are consistent.
- Components are small and single-purpose.

**Rollback**

- Keep old shell markup and remove primitive usage one page at a time.

---

### Phase 3 — Shell page application

Apply primitives and styling to first-impression shell surfaces:

- route tiles for `/map`, `/feed`, `/resources`, `/volunteer`
- top-level CTA/announcement area

**Acceptance criteria**

- Visual style matches `design-system.md` signature
- Readability and contrast pass AA for text
- Keyboard tab order follows visual order

**Rollback**

- Revert shell composition files; primitives remain available for future use.

---

### Phase 4 — Motion and polish

1. Add only 1-2 key animations per view (e.g., one badge pulse + subtle hover lift).
2. Validate reduced-motion behavior.

**Acceptance criteria**

- No animation overload
- Motion remains informative and non-disorienting

**Rollback**

- Disable animation classes while preserving structural UI style.

---

## Quality gates

Before merging each phase:

1. Lint/typecheck pass
2. Existing tests pass
3. Keyboard navigation sanity check
4. Contrast check on primary text surfaces

## Suggested implementation order in repository

1. `apps/web` global style/token entry
2. `apps/web` base UI component files
3. `apps/web/src/app-shell.ts` presentation mapping
4. `apps/web/src/index.ts` bootstrapped shell output integration

## Notes

- Keep this rollout independent of backend domain and indexing logic.
- Prefer incremental commits per phase to simplify rollback.
