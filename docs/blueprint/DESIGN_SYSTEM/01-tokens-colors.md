# Design System — 01: Core Rules & Color Tokens

← [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) | [Blueprint INDEX](../INDEX.md) | [02 — Typography & utilities →](./02-typography-utilities.md)

Token source: [src/app/globals.css](../../../src/app/globals.css) `@theme {}` block.

---

## Core Rules

| Rule | Detail |
|---|---|
| Theme | Light-only (flipped from dark 2026-07-29). `color-scheme: light` global. No light/dark toggle. |
| Color space | `oklch()` — wide-gamut, perceptually uniform. Never convert to hex. |
| Token location | `src/app/globals.css` `@theme {}` |
| Tailwind version | v4 — `@theme {}` auto-generates utility classes, no `tailwind.config.*` |
| Component library | Hand-rolled shadcn-style primitives only (Radix + CVA in `src/components/ui/`). `@heroui/react` was uninstalled 2026-08-01 — see [COMPONENTS.md](../COMPONENTS.md) |
| Important modifier | `!` suffix — e.g. `font-sans!` (NOT `!font-sans`) |
| Class merger | `cn()` from `src/lib/cn.ts` — handles `!` suffix correctly via tailwind-merge v3 |

**Never add raw color values in JSX.** Always use token class or `var(--color-*)`.

> **2026-08-01 — The HeroUI migration is finished and the package is gone.** Every screen now uses the hand-rolled shadcn-style primitives (Radix + CVA, see [COMPONENTS/01](../COMPONENTS/01-structure-cva.md)); `globals.css` imports `tailwindcss` directly again and the HeroUI variable bridge (`--accent`, `--field-background`, …) has been deleted. **If you find `var(--field-*)` or `var(--accent)` in a component, it is broken** — those names no longer resolve to anything. Use the `--color-*` tokens below.
>
> Two token changes landed with it. `--color-surface-raised` is now one step *down* from white (a faint recessed tint for table headers, code blocks, hover fills and inset slots) instead of a second white; raised things are `bg-surface` + `elevation-*`. And `--color-warning-text` was added, because `--color-warning` measures ~2.1:1 as text on white — use the fill for dots and bars, the `-text` variant for words.

---

## Tailwind v4 @theme Mechanics

```css
/* src/app/globals.css */
@theme {
  --color-primary: oklch(0.623 0.214 259.8);
  /* ↑ auto-generates: bg-primary, text-primary, border-primary, fill-primary, ... */

  --radius-md: 0.5rem;
  /* ↑ auto-generates: rounded-md */

  --font-sans: var(--font-outfit), ui-sans-serif;
  /* ↑ auto-generates: font-sans */
}
```

---

## Surface Tokens

| Utility class | CSS variable | oklch value | Renders as | Elevation |
|---|---|---|---|---|
| `bg-background` | `--color-background` | `oklch(0.985 0.003 264)` | `rgb(250,250,251)` | Page wash (lowest) |
| `bg-surface` | `--color-surface` | `oklch(1 0 0)` | `rgb(255,255,255)` | Cards, inputs |
| `bg-surface-raised` | `--color-surface-raised` | `oklch(1 0 0)` | `rgb(255,255,255)` | Dropdowns, tooltips |
| `bg-surface-overlay` | `--color-surface-overlay` | `oklch(1 0 0)` | `rgb(255,255,255)` | Modals, sheets (highest) |

### Elevation in the light theme (2026-07-29)

Flipped from dark to light on 2026-07-29 — see [LEARN.md](../../knowledge/LEARN.md). White is the top of the luminance scale, so there's no room for a lightness ladder above it the way the old dark ranking used `background < surface < surface-raised < surface-overlay`. Every raised surface token now resolves to the same white; elevation instead comes from the `.elevation-sm` / `.elevation-md` / `.elevation-lg` utilities (`@layer utilities` in `globals.css`) — shadow + a `border-border` hairline, escalating with the surface step in play:

| Surface token | Pair with |
|---|---|
| `bg-surface` | `.elevation-sm` |
| `bg-surface-raised` | `.elevation-md` |
| `bg-surface-overlay` | `.elevation-lg` |

Don't try to differentiate surfaces by adding a background-luminance step in a light theme — verify with the same oklch→sRGB snippet below if a card looks "flat"; the fix is almost always a missing shadow utility, not a darker `--color-surface-*`.

```js
// in the browser console — canvas resolves oklch()/lab() to sRGB
const c = getComputedStyle(document.documentElement).getPropertyValue('--color-surface');
const x = document.createElement('canvas').getContext('2d'); x.fillStyle = c;
x.fillRect(0,0,1,1); x.getImageData(0,0,1,1).data; // → [r,g,b,a]
```

---

## Text Tokens

Contrast is quoted against `--color-background` (white — the worst case for dark-on-light text). All pass WCAG AA (4.5:1) for normal-size text.

| Utility class | CSS variable | Contrast | Use |
|---|---|---|---|
| `text-foreground` | `--color-foreground` | 15.8:1 | Primary text |
| `text-foreground-muted` | `--color-foreground-muted` | 6.6:1 | Secondary, descriptions |
| `text-foreground-subtle` | `--color-foreground-subtle` | 4.5:1 | Placeholder, small metadata |

---

## Fill vs Text: two tokens per accent color

A color dark enough to carry a white label is too dark to *be* readable text on a dark surface, and vice versa — one token cannot satisfy both. So each accent that appears in both roles has a `-text` sibling:

| Role | Token | Use for | Contrast |
|---|---|---|---|
| Solid fill | `bg-primary` + `text-primary-foreground` | Buttons, filled chips | 4.6:1 (label on fill) |
| Text | `text-primary-text` | Links, accent-colored copy | 6.1:1 on background |
| Solid fill | `bg-destructive` + `text-destructive-foreground` | Destructive buttons | 4.5:1 (label on fill) |
| Text | `text-destructive-text` | Error messages, field errors | 6.0:1 on background |

**Never use `text-primary` or `text-destructive` for copy** — those are the fill colors; on a white page they measure well under 4.5:1 as text. Reach for the `-text` variant.

> On the dark theme this predates, the `-text` variant was *lighter* than the fill (a light accent reads on a dark surface). On the light theme it flipped: `-text` is now *darker* than the fill, because a fill dark enough to carry a white label is too light to read as text on white. Same two-tokens-per-accent rule, opposite direction — don't assume `-text` always means "lighter."

`success` and `warning` need no split: they are only used as text/soft chips here.

---

## Border Tokens

| Utility class | CSS variable | Use |
|---|---|---|
| `border-border` | `--color-border` | Default borders (auto-applied globally) |
| `border-border-strong` | `--color-border-strong` | Hover/focus border state |
| `border-input` | `--color-input` | Form field borders |

---

## Primary Color Tokens (Electric Blue)

| Utility class | CSS variable | Use |
|---|---|---|
| `bg-primary` | `--color-primary` | Primary actions (solid fill) |
| `bg-primary-hover` | `--color-primary-hover` | Hover state |
| `bg-primary-active` | `--color-primary-active` | Active/pressed state |
| `text-primary-foreground` | `--color-primary-foreground` | Label on a primary fill |
| `text-primary-text` | `--color-primary-text` | **Links / accent copy** — see fill-vs-text above |
| `bg-primary-subtle` | `--color-primary-subtle` | 12% opacity tint |
| `shadow-primary-glow` | `--color-primary-glow` | Glow effect (35% opacity) |
| `ring-ring` | `--color-ring` | Focus ring (= primary) |

---

## Semantic Color Tokens

| Group | Fill | Hover | Foreground | Subtle (12% bg) |
|---|---|---|---|---|
| Destructive | `bg-destructive` | `bg-destructive-hover` | `text-destructive-foreground` | `bg-destructive-subtle` |
| Success | `bg-success` | `bg-success-hover` | `text-success-foreground` | `bg-success-subtle` |
| Warning | `bg-warning` | `bg-warning-hover` | `text-warning-foreground` | `bg-warning-subtle` |

Destructive also has `text-destructive-text` for error copy — see [Fill vs Text](#fill-vs-text-two-tokens-per-accent-color).

---

## Card Tokens

| Utility class | Use |
|---|---|
| `bg-card` | Card background (= `bg-surface`) |
| `text-card-foreground` | Card text (= `text-foreground`) |

---

## One namespace only

`src/app/globals.css` starts with `@import "tailwindcss";` and defines exactly one set of names: the `--color-*` / `--radius-*` tokens in `@theme {}`. There is no second variable namespace to keep in sync — the HeroUI bridge that used to alias `--accent`, `--surface`, `--danger`, `--field-*` was removed with the package on 2026-08-01.

Consequence for anything you copy from an older file or an older revision of these docs: **`var(--field-background)`, `var(--field-border)`, `var(--field-placeholder)`, `var(--accent)`, `var(--danger)`, `var(--radius)` resolve to nothing.** They fail silently — a field styled with them renders transparent and borderless rather than throwing. Three components were still on them at migration time (`SelectField`, `TagsInput`, `AssetToolbar`'s search box); if you meet a fourth, the replacements are:

| Dead HeroUI variable | Use |
|---|---|
| `--field-background` | `bg-surface` |
| `--field-foreground` | `text-foreground` |
| `--field-placeholder` | `placeholder:text-foreground-subtle` |
| `--field-border` | `border-input` |
| `--accent` / `--danger` | `bg-primary` / `bg-destructive` |
| `--radius` | `rounded-lg` |

`<html data-theme="light">` is still set in `src/app/layout.tsx`; nothing reads it now, but it keeps `color-scheme` honest if a dark theme is ever added.

### The field shell

Every labelled field (`TextInputField`, `TextAreaField`, `NumberInputField`, `SelectField`) renders through `FieldShell` in `src/components/ui/Field/`, which owns the label row, the required marker, the `aria-describedby` wiring, and the rule that **the error replaces the hint rather than stacking under it** — so a field never changes height when it goes invalid. Add a new field type by composing `FieldShell` + a control, not by re-implementing the label/hint/error trio.

All four keep HeroUI's **value-based `onChange(value)`** signature — every call site in the app passes a state setter directly (`onChange={setTitle}`), and switching to `onChange(event)` would break them silently. They are controlled only when the caller actually passes `value`; see LEARN.md 2026-08-01 for why that distinction matters.

---

← [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) | → [02 — Typography & utilities](./02-typography-utilities.md)
