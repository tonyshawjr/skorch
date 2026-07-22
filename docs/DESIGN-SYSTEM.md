# Skorch Design System

**Generated:** April 1, 2026
**Platform:** Strategic card game (web-based, mobile-responsive)
**Aesthetic:** Dark mode gaming, competitive, bold
**Pages:** Homepage, Play (game), Profile, Leaderboard, Rules

---

## Color Tokens (Unified)

Use these across ALL pages. No more split palettes.

```css
:root {
    /* ── Brand Core ── */
    --skorch-red: #b11f24;
    --skorch-red-dark: #8a181c;
    --skorch-red-light: #d4393e;
    --skorch-red-glow: rgba(177, 31, 36, 0.25);

    --skorch-gold: #F5A623;
    --skorch-gold-dark: #d4901e;
    --skorch-gold-glow: rgba(245, 166, 35, 0.2);

    /* ── Backgrounds (Layered System) ── */
    --bg-base: #1a1517;           /* Deepest layer - page background */
    --bg-surface: #1c1d1f;        /* Cards, panels */
    --bg-elevated: #222326;       /* Modals, dropdowns, hover states */
    --bg-gameplay: #1a3a2a;       /* Game table ONLY (play page) */
    --bg-gameplay-deep: #143022;  /* Game table darker variant */

    /* ── Text ── */
    --text-primary: #FFFFFF;
    --text-secondary: rgba(255, 255, 255, 0.87);
    --text-muted: rgba(255, 255, 255, 0.6);
    --text-disabled: rgba(255, 255, 255, 0.38);

    /* ── Borders & Dividers ── */
    --border-subtle: rgba(255, 255, 255, 0.06);
    --border-default: rgba(255, 255, 255, 0.12);
    --border-strong: rgba(255, 255, 255, 0.2);

    /* ── Status Colors ── */
    --green: #34D399;
    --green-dark: #10b981;
    --blue: #3b82f6;
    --yellow: #eab308;
    --danger: var(--skorch-red);

    /* ── Gameplay-Specific ── */
    --card-attack: var(--skorch-red);
    --card-shield: var(--blue);
    --card-special: var(--skorch-gold);
    --card-heal: var(--green);
    --hp-full: var(--green);
    --hp-mid: var(--yellow);
    --hp-low: var(--skorch-red);
}
```

### When to Use What

| Token | Use For |
|-------|---------|
| `--bg-base` | Page backgrounds (ALL pages) |
| `--bg-surface` | Cards, panels, content blocks |
| `--bg-elevated` | Modals, dropdowns, tooltips, hover states |
| `--bg-gameplay` | Game table background ONLY (play page) |
| `--skorch-red` | Primary actions, CTAs, attack cards, brand moments |
| `--skorch-gold` | Rewards, ranks, achievements, premium features |
| `--green` | Success states, health, wins |
| `--blue` | Information, shields, secondary actions |

---

## Typography

### Current (Keep)
```css
/* Primary - UI, body text, navigation */
font-family: 'Inter', system-ui, -apple-system, sans-serif;

/* Display - Headlines, hero text, game titles */
font-family: 'Inter Tight', 'Inter', system-ui, sans-serif;
```

### Recommended Upgrade (Optional)
If you want more gaming personality, consider swapping Inter Tight for display headings:

| Option | Font | Vibe | Google Fonts |
|--------|------|------|-------------|
| **A (Recommended)** | Chakra Petch | Techy, competitive, gaming | `Chakra+Petch:wght@400;500;600;700` |
| **B** | Russo One | Bold, esports, impact | `Russo+One` |
| **C** | Barlow Condensed | Athletic, condensed, sports | `Barlow+Condensed:wght@400;500;600;700` |

**Keep Inter for body text regardless.** It's clean and readable.

### Type Scale

```css
/* Headings */
--text-hero: clamp(2.5rem, 5vw, 4rem);    /* Homepage hero */
--text-h1: clamp(1.75rem, 3vw, 2.5rem);   /* Page titles */
--text-h2: clamp(1.25rem, 2vw, 1.75rem);  /* Section headers */
--text-h3: 1.125rem;                        /* Card titles, subheads */

/* Body */
--text-body: 1rem;         /* 16px - default */
--text-sm: 0.875rem;       /* 14px - secondary info */
--text-xs: 0.75rem;        /* 12px - labels, captions */

/* Weight Scale */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
--font-black: 900;         /* Display headings only */
```

---

## Spacing & Layout

```css
/* Spacing Scale (8px base) */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */

/* Layout */
--max-width: 1200px;       /* Content max width */
--max-width-game: 1400px;  /* Game table max width */
--nav-height: 56px;
--nav-height-desktop: 64px;
--border-radius-sm: 6px;
--border-radius-md: 10px;
--border-radius-lg: 16px;
--border-radius-full: 9999px;
```

---

## Component Tokens

### Navigation (ALL pages)
```css
--nav-bg: rgba(26, 21, 23, 0.95);
--nav-bg-solid: var(--bg-base);
--nav-blur: 12px;
--nav-border: var(--border-subtle);
--nav-z: 1000;
--logo-h: 36px;
--logo-h-desktop: 44px;
```

### Buttons
```css
/* Primary (Red) */
--btn-primary-bg: var(--skorch-red);
--btn-primary-bg-hover: var(--skorch-red-dark);
--btn-primary-text: #FFFFFF;

/* Secondary (Ghost) */
--btn-ghost-bg: rgba(255, 255, 255, 0.08);
--btn-ghost-bg-hover: rgba(255, 255, 255, 0.14);
--btn-ghost-text: rgba(255, 255, 255, 0.85);

/* Gold (Premium/Reward actions) */
--btn-gold-bg: var(--skorch-gold);
--btn-gold-bg-hover: var(--skorch-gold-dark);
--btn-gold-text: #1a1517;

/* Shared */
--btn-radius: 6px;
--btn-padding: 0.5rem 1rem;
--btn-padding-sm: 0.4rem 0.65rem;
--btn-font-size: 0.8125rem;
--btn-font-weight: 600;
--btn-transition: background 0.15s, transform 0.1s;
```

### Cards (Game Cards)
```css
--card-width: 100px;
--card-height: 140px;
--card-radius: 10px;
--card-overlap: -30px;
--card-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
--card-shadow-hover: 0 8px 24px rgba(0, 0, 0, 0.5);
--card-glow-attack: 0 0 12px var(--skorch-red-glow);
--card-glow-shield: 0 0 12px rgba(59, 130, 246, 0.25);
--card-glow-special: 0 0 12px var(--skorch-gold-glow);
```

### UI Cards (Profile, Leaderboard, etc.)
```css
--ui-card-bg: var(--bg-surface);
--ui-card-border: var(--border-subtle);
--ui-card-radius: var(--border-radius-md);
--ui-card-padding: var(--space-6);
--ui-card-hover-bg: var(--bg-elevated);
```

---

## Effects & Animation

```css
/* Transitions */
--transition-fast: 0.1s ease;
--transition-base: 0.15s ease;
--transition-slow: 0.3s ease;

/* Glow Effects (use sparingly) */
--glow-red: 0 0 20px var(--skorch-red-glow);
--glow-gold: 0 0 20px var(--skorch-gold-glow);
--glow-green: 0 0 20px rgba(52, 211, 153, 0.2);

/* Backdrop Blur (nav, modals) */
--blur-sm: blur(8px);
--blur-md: blur(12px);
--blur-lg: blur(20px);
```

### Animation Guidelines
- Micro-interactions: 150-300ms
- Page transitions: 300-500ms
- Card plays/attacks: 200-400ms
- Always respect `prefers-reduced-motion`
- Use `transform` and `opacity` only (GPU accelerated)
- No layout-shifting animations (no width/height changes)

---

## Page-Specific Rules

### Homepage (`index.html`)
- Background: `--bg-base` (#1a1517)
- Hero: Large display text, red CTA, subtle glow effects
- Style: Marketing-focused, bold typography, social proof

### Play Page (`play/index.html`)
- Background: `--bg-gameplay` (#1a3a2a) for the game table
- Header: Same nav as all pages (`--nav-bg`)
- Cards use glow effects on hover/play
- HP bars use gradient from `--hp-full` to `--hp-low`

### Profile (`profile/index.html`)
- Background: `--bg-base`
- Stats cards: `--bg-surface` with `--border-subtle`
- Avatar: Circular, `--border-radius-full`, gold border for ranked players
- Win/loss uses `--green` / `--skorch-red`

### Leaderboard (`leaderboard/index.html`)
- Background: `--bg-base`
- Table rows: Alternating `--bg-surface` / `--bg-base`
- Top 3: Gold/silver/bronze accents
- Rank badges: `--skorch-gold` for #1

### Rules (`rules/index.html`)
- Background: `--bg-base`
- Content cards: `--bg-surface`
- Card type examples with appropriate glow colors
- Clean, readable typography (wider line-height)

---

## Responsive Breakpoints

```css
/* Mobile first */
@media (min-width: 480px)  { /* Large phone */ }
@media (min-width: 768px)  { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
@media (min-width: 1440px) { /* Wide desktop */ }
```

### Key Responsive Rules
- Nav hamburger below 768px, links visible above
- Game cards scale down on mobile (80px wide)
- Leaderboard table scrolls horizontally on mobile
- Profile stats stack vertically on mobile

---

## Accessibility

- Text contrast: minimum 4.5:1 against backgrounds
- Focus rings: 2px solid with offset, visible on all interactive elements
- Touch targets: minimum 44x44px
- `prefers-reduced-motion`: disable glow animations, card transitions
- `prefers-color-scheme`: dark only (no light mode needed)
- All game actions must be keyboard accessible

---

## Anti-Patterns (Don't Do This)

- Don't use different background colors per page (except gameplay green)
- Don't mix font families beyond Inter + Inter Tight (or chosen display font)
- Don't use emojis as icons — use SVGs
- Don't animate width/height — only transform/opacity
- Don't put scanlines or CRT effects on text (readability killer)
- Don't use glow on everything — reserve for emphasis moments
- Don't use more than 2 glow colors on one screen
