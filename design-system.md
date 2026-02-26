# Mutual Hub Design System

## Style: Neo-Retro Brutal (Hybrid of 13 + 30)

This project uses a **hybrid visual style** combining:

- **13 – Neo-brutalism** (bold borders, hard shadows, playful rebellion)
- **30 – Retro 90s** (window chrome, bevels, nostalgic interaction language)

The result should feel: **funky, warm, community-first, and unmistakably non-corporate** while remaining readable and accessible.

---

## 1) Design Intent

### Product tone

- Community mutual-aid platform
- Trustworthy + human, but not sterile
- High visibility for urgent actions and statuses

### Core visual principles

1. **Visible structure**: every key UI block has explicit borders.
2. **Physicality**: use hard shadows and beveled states to make controls feel tactile.
3. **Controlled chaos**: playful accents and stickers, but clean information hierarchy.
4. **Accessibility first**: color contrast, keyboard focus, reduced-motion support are non-negotiable.

---

## 2) Design Tokens

### Color tokens

```txt
--mh-bg:            #FFFDF5;   // warm paper background
--mh-surface:       #FFFFFF;   // cards/content panels
--mh-panel:         #C0C0C0;   // retro panel gray
--mh-text:          #000000;   // primary text
--mh-text-muted:    #4B5563;   // secondary text

--mh-accent:        #FF6B6B;   // neo brutal primary
--mh-accent-2:      #FFD93D;   // energetic yellow
--mh-accent-3:      #C4B5FD;   // playful violet

--mh-link:          #0000FF;   // retro link blue
--mh-link-visited:  #800080;   // retro visited purple
--mh-success:       #00AA00;
--mh-danger:        #FF0000;

--mh-border:        #000000;
--mh-border-light:  #FFFFFF;   // bevel light edge
--mh-border-dark:   #808080;   // bevel dark edge

--mh-titlebar-start:#000080;   // retro window title bar
--mh-titlebar-end:  #1084D0;
```

### Typography tokens

Based on the typography search enrichment:

- **Heading**: `Space Mono`, `Arial Black`, `Impact`, sans-serif
- **Body**: `MS Sans Serif`, `Tahoma`, `Segoe UI`, sans-serif
- **Decorative/terminal** (optional small areas): `VT323`, monospace

Rules:

- Headings: bold/black weight, tight tracking
- Body: high readability, regular/medium weight
- Labels/buttons: uppercase with wider tracking

### Spacing and radius

- Base spacing scale: `4px`
- Touch targets: minimum `44px`
- Corners: mostly square (`0px`), optional slight rounding only for badges/pills

---

## 3) Signature Effects

### A) Hard neo-brutal shadows

```css
box-shadow: 8px 8px 0 0 #000;
```

Hover state:

```css
transform: translateY(-2px);
box-shadow: 12px 12px 0 0 #000;
```

### B) Retro bevels (3D button/window feel)

Outset (default):

```css
border: 2px solid;
border-color: #fff #808080 #808080 #fff;
```

Inset (pressed):

```css
border: 2px solid;
border-color: #808080 #fff #fff #808080;
transform: translate(1px, 1px);
```

### C) Pattern textures

Use subtle pattern overlays (`opacity 0.05 - 0.12`) such as:

- dot matrix backgrounds
- soft checker/stripe overlays

Do **not** overwhelm content with dense textures.

---

## 4) Component Rules

### Buttons

- Default: retro bevel + hard shadow
- Primary CTA: `--mh-accent` fill + black border + white text
- Secondary CTA: `--mh-accent-2` fill + black text
- Interaction:
  - hover: slight lift + stronger hard shadow
  - active: inset/pressed state
  - focus-visible: high contrast ring (see a11y section)

### Links

- Unvisited: `--mh-link`
- Visited: `--mh-link-visited`
- Hover: `--mh-danger`
- Keep links underlined by default

### Cards and panels

- Outer shell: bold black border
- Optional window mode: retro title bar gradient (`--mh-titlebar-start -> --mh-titlebar-end`)
- Content surfaces: `--mh-surface` or `--mh-panel`

### Inputs

- Use inset look for fields
- Clear focus state with ring + border color shift
- Avoid low-contrast placeholder text

---

## 5) Motion and Interaction

From UX guardrail enrichment:

1. Respect `prefers-reduced-motion`.
2. Animate only **1-2 key elements per view**.
3. Use `ease-out` for entry interactions (avoid excessive linear motion for UI transitions).

Allowed playful motion:

- one marquee/announcement strip (optional)
- one badge pulse for urgent states
- subtle hover lift on interactive cards/buttons

Avoid animating everything simultaneously.

---

## 6) Accessibility Requirements (Mandatory)

### Focus states

- Never remove outlines without replacement.
- Use visible focus rings on all interactive controls.

Recommended baseline:

```css
focus-visible {
  outline: 2px solid #000;
  outline-offset: 2px;
  box-shadow: 0 0 0 2px #FFD93D;
}
```

### Keyboard navigation

- Tab order must follow visual order.
- No keyboard traps.

### Contrast

- Meet minimum $4.5:1$ for normal text.
- Prefer black text on light surfaces for core content blocks.

---

## 7) React/UI Architecture Guardrails

From stack guidance:

1. Keep components small and single-purpose.
2. Destructure props in component signatures.
3. Use error boundaries around major page sections.

---

## 8) Implementation Checklist

- [ ] Add global tokens and base typography in one shared style entry point
- [ ] Build base primitives: `Button`, `Card`, `Panel`, `Input`, `Badge`, `Link`
- [ ] Implement focus-visible and keyboard states first
- [ ] Apply style to first-impression page (landing/feed shell)
- [ ] Apply style to core flow surfaces (aid post, resource card, volunteer card)
- [ ] Add reduced-motion fallback

---

## 9) Anti-Patterns

- Do not use soft, blurry SaaS shadows everywhere.
- Do not mix more than one unrelated visual style system.
- Do not rely on color alone for status/affordance.
- Do not apply motion to all components at once.

This system should feel **bold and nostalgic**, but still operationally clear for urgent community use.
