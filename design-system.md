# Patchwork Design System

## Style Selection: Dark Convergence (13 + 14 + 28 + 8)

Selected strategy: **Preset merge (Option 2)** with a custom dark blend of:

- **13 Neo-brutalism** → hard structure, tactile controls, bold contrast
- **14 Bold Typography** → editorial hierarchy, dark palette, precise rhythm
- **28 Organic** → subtle natural warmth, softer curves in selected surfaces
- **8 Swiss Minimalist** → grid discipline, asymmetry, objective information layout

Design intent: **high-trust mutual-aid UX** that feels urgent and readable at night, while remaining human and non-corporate.

---

## 1) Core Principles

1. **Structure is visible**: layout must read clearly from borders, spacing, and hierarchy.
2. **Typography leads**: headlines and labels establish scanning order before decoration.
3. **Dark-first clarity**: contrast and focus visibility are mandatory, not optional.
4. **Controlled personality**: organic accents exist, but never reduce legibility.
5. **Mechanical interactions**: motion should feel intentional and tactile, not floaty.

---

## 2) Token System (source of truth)

### Color tokens

```txt
--mh-bg:               #0A0A0A;
--mh-surface:          #121212;
--mh-surface-elev:     #1A1A1A;
--mh-panel:            #161616;

--mh-text:             #FAFAFA;
--mh-text-muted:       #A3A3A3;
--mh-text-soft:        #737373;

--mh-accent:           #FF3D00;   // bold editorial accent
--mh-accent-2:         #7C3AED;   // community primary
--mh-accent-3:         #A78BFA;   // community secondary
--mh-cta:              #F97316;   // urgent CTA
--mh-organic-moss:     #5D7052;   // organic warmth for limited use

--mh-success:          #22C55E;
--mh-danger:           #EF4444;

--mh-border:           #000000;
--mh-border-subtle:    #262626;
--mh-border-soft:      #3A3A3A;

--mh-link:             #C4B5FD;
--mh-link-visited:     #A78BFA;

--mh-focus:            #FF3D00;
--mh-focus-offset:     #0A0A0A;
```

### Typography tokens

- **Heading**: `Inter Tight`, `Space Grotesk`, system sans-serif
- **Body**: `Inter`, `Public Sans`, system sans-serif
- **Accent serif (optional for quotes only)**: `Fraunces`
- **Mono**: `JetBrains Mono`

Rules:

- Headings: heavy (`700-900`), tight tracking (`-0.02em` to `-0.06em`)
- Labels/actions: uppercase + wide tracking (`0.08em` to `0.14em`)
- Body text: `16px+`, line-height `1.5+`

### Spacing/radius/shadow

- Base spacing scale: `4px`
- Touch targets: `min-height: 44px`
- Radius: default `0px`, optional organic corners only in non-critical decorative containers
- Hard shadows (neo-brutal):
    - default: `6px 6px 0 0 #000`
    - hover: `10px 10px 0 0 #000`

---

## 3) Texture + Layout System

### Swiss grid discipline

- Prefer asymmetric layouts (e.g. `8:4`, `7:5`, `5:7`) over centered symmetry.
- Keep flush-left typography for primary content blocks.
- Use clear section separators (`border-t`, `border-b`) to reinforce structure.

### Pattern layers (low intensity)

Use only subtle overlays (`1.5%` to `6%` opacity):

- `mh-grid-pattern`: 24px line grid on muted sections
- `mh-dots`: dot matrix for side rails or metadata blocks
- `mh-grain`: global noise/paper texture on root background

### Organic accents

- Organic forms are allowed only for decorative surfaces (hero backdrops, quote blobs).
- Avoid organic radii on forms, data tables, and critical action controls.

---

## 4) Component Contracts

Keep these stable primitive class contracts:

- `mh-button`
- `mh-card`
- `mh-panel`
- `mh-input`
- `mh-link`
- `mh-badge`

### Buttons

- Shape: rectangular (`0px` radius)
- Primary: `--mh-accent` bg + black border + dark text
- Secondary: `--mh-accent-2` bg + white text
- Neutral: `--mh-surface-elev` bg + white text + subtle border
- Interaction:
    - hover: slight lift + hard shadow increase
    - active: press-in translate + reduced shadow
    - disabled: no lift, reduced opacity

### Cards / Panels

- `mh-card`: high-contrast panel with hard border and optional hard shadow
- `mh-panel`: darker container for grouped actions, may include subtle grid texture
- Optional “organic variant” for storytelling cards only (`mh-card--organic`)

### Inputs

- Dark inset feel with clear border (`--mh-border-soft`)
- Focus switches border/ring to `--mh-focus`
- Placeholder must stay readable against dark surfaces
- Error state must be announced via `role="alert"` or `aria-live`

### Links

- Default underlined links are required
- Hover/focus state must alter both color and underline thickness/offset
- Preserve visited distinction

---

## 5) Motion Rules

1. Respect `prefers-reduced-motion: reduce` globally.
2. Animate at most **1-2 key elements per viewport**.
3. Use `150ms-250ms` durations for controls.
4. Prefer `ease-out` for enter/hover transitions.
5. Decorative infinite animations are disallowed.

---

## 6) Accessibility Baseline (must pass)

- Normal text contrast must meet at least $4.5:1$.
- Keyboard focus must be visible on all interactive elements.
- Do not remove default outline without an equivalent replacement.
- Color cannot be the sole status indicator.
- Form errors must be machine-readable.

Recommended focus style:

```css
:where(a, button, input, textarea, select, [role='button']):focus-visible {
    outline: 2px solid var(--mh-focus);
    outline-offset: 2px;
    box-shadow: 0 0 0 2px var(--mh-focus-offset);
}
```

---

## 7) Tailwind + Vite Implementation Notes

For `apps/web` (`Vite + React + TypeScript + Tailwind`):

1. Keep all variables in `src/styles/tokens.css`.
2. Map tokens in `tailwind.config.ts` (`mh.*` namespace).
3. Build variants in primitives, avoid page-level one-off hex values.
4. Keep responsive container rhythm consistent (`px-4 sm:px-6 lg:px-8`).
5. Maintain a single interaction language across all surfaces.

---

## 8) UI/UX Transformation Plan (next execution phase)

### Phase A — Token and primitive convergence

- Update token set to dark convergence values.
- Align `Button`, `Card`, `Panel`, `Input`, `TextLink`, `Badge` variants.
- Ensure focus/hover/active states are consistent.

### Phase B — First-impression shell

- Apply new style to `App` landing/discovery shell.
- Introduce swiss-grid + subtle grain layer.
- Maintain clean asymmetric layout and strong typography hierarchy.

### Phase C — Core flow screens

- Roll out to request feed, posting form, directory cards, volunteer cards.
- Reserve organic accents for non-critical decorative zones.

### Acceptance criteria

- [ ] No scattered raw hex values in feature UI components
- [ ] Focus-visible works on keyboard navigation end-to-end
- [ ] Reduced-motion mode disables decorative motion
- [ ] Mobile (320px) to desktop (1440px) has no horizontal scroll
- [ ] Urgent states remain visually prominent in dark mode

---

## 9) Anti-Patterns

- Mixing unrelated style vocabularies per page.
- Adding soft/glassy effects that weaken structure.
- Overusing organic blobs on operational forms.
- Animating more than the user needs to complete tasks.

This system should feel **bold, editorial, and trustworthy in dark mode** with a clear community identity.
