# Design System — 02: shadcn Aliases, Typography, Radius, Utilities

← [01 — Color tokens](./01-tokens-colors.md) | [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) | [Blueprint INDEX](../INDEX.md)

---

## shadcn/ui Alias Tokens

Defined in `src/app/globals.css` `@theme {}`. Allow shadcn-generated components to work without extra config.

| shadcn class | Maps to | CSS variable value |
|---|---|---|
| `bg-popover` | `bg-surface` | `oklch(0.1 0.018 264)` |
| `text-popover-foreground` | `text-foreground` | `oklch(0.962 0.006 264)` |
| `bg-secondary` | `bg-surface-raised` | `oklch(0.13 0.016 264)` |
| `text-secondary-foreground` | `text-foreground` | `oklch(0.962 0.006 264)` |
| `bg-muted` | `bg-surface-raised` | `oklch(0.13 0.016 264)` |
| `text-muted-foreground` | `text-foreground-muted` | `oklch(0.62 0.018 264)` |
| `bg-accent` | `bg-primary-subtle` | `oklch(0.623 0.214 259.8 / 0.12)` |
| `text-accent-foreground` | `text-foreground` | `oklch(0.962 0.006 264)` |
| `bg-sidebar` | `bg-surface` | `oklch(0.1 0.018 264)` |
| `bg-sidebar-primary` | `bg-primary` | `oklch(0.623 0.214 259.8)` |
| `bg-sidebar-accent` | `bg-surface-raised` | `oklch(0.13 0.016 264)` |
| `border-sidebar-border` | `border-border` | `oklch(0.22 0.016 264)` |
| `ring-sidebar-ring` | `ring-ring` | `oklch(0.623 0.214 259.8)` |

---

## Typography

Fonts loaded via `next/font/google` in `src/app/[locale]/layout.tsx`, injected as CSS vars:

| CSS variable | Font family | Weights | Utility |
|---|---|---|---|
| `--font-outfit` | Outfit | 300–800 | `font-sans` — all body + UI text |
| `--font-jetbrains-mono` | JetBrains Mono | 400–600 | `font-mono` — code, monospace data |

`@theme` mapping:
```css
--font-sans: var(--font-outfit), ui-sans-serif, system-ui, sans-serif;
--font-mono: var(--font-jetbrains-mono), ui-monospace, "Cascadia Code", monospace;
```

### Typography component ([src/components/ui/Typography/](../../../src/components/ui/Typography/))

| Variant | Element | Classes |
|---|---|---|
| `h1` | `<h1>` | `text-4xl font-extrabold tracking-tight lg:text-5xl` |
| `h2` | `<h2>` | `text-3xl font-semibold tracking-tight` |
| `h3` | `<h3>` | `text-2xl font-semibold tracking-tight` |
| `h4` | `<h4>` | `text-xl font-semibold` |
| `h5` | `<h5>` | `text-lg font-semibold` |
| `h6` | `<h6>` | `text-base font-semibold` |
| `p` | `<p>` | `leading-7` |
| `lead` | `<p>` | `text-xl leading-relaxed` |
| `large` | `<p>` | `text-lg` |
| `small` | `<p>` | `text-sm` |
| `muted` | `<p>` | `text-sm text-foreground-muted` |
| `code` | `<code>` | `bg-surface-raised px-1.5 font-mono text-sm` |

---

## Radius Tokens

| Utility class | CSS variable | Value |
|---|---|---|
| `rounded-xs` | `--radius-xs` | `0.25rem` |
| `rounded-sm` | `--radius-sm` | `0.375rem` |
| `rounded-md` | `--radius-md` | `0.5rem` |
| `rounded-lg` | `--radius-lg` | `0.75rem` |
| `rounded-xl` | `--radius-xl` | `1rem` |
| `rounded-2xl` | `--radius-2xl` | `1.5rem` |
| `rounded-full` | `--radius-full` | `9999px` |

---

## Custom Utilities

Defined in `@layer utilities {}` in `src/app/globals.css`:

| Class | Effect |
|---|---|
| `.container-page` | `max-width: 1280px`, centered, `1.5rem` horizontal padding |
| `.text-balance` | `text-wrap: balance` — even line breaks for headings |
| `.glow-primary` | Triple box-shadow glow in primary color |
| `.border-gradient` | Transparent border filled with primary→teal 135° gradient |

---

## Focus Ring

Global in `@layer base` — `src/app/globals.css`:
```css
:focus-visible {
  outline: 2px solid var(--color-ring);
  outline-offset: 2px;
}
```

Components needing inline focus ring (to prevent outline overlap):
```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
```

---

## Adding a New Color Token

1. Add to `@theme {}` in `src/app/globals.css`:
   ```css
   --color-info:            oklch(0.6 0.18 230);
   --color-info-foreground: oklch(0.98 0.004 230);
   --color-info-subtle:     oklch(0.6 0.18 230 / 0.12);
   ```
2. Tailwind auto-generates `bg-info`, `text-info`, `border-info`, etc.
3. Add shadcn alias in same block if any shadcn component references a semantic name.

Do NOT add to `tailwind.config.*` — there is no such file in Tailwind v4.

---

← [01 — Color tokens](./01-tokens-colors.md) | [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md)
