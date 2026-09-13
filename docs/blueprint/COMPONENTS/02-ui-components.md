# Components — 02: Existing UI Components

← [01 — Layers, CVA](./01-structure-cva.md) | [COMPONENTS.md](../COMPONENTS.md) | [03 — Storybook, tests, accessibility →](./03-storybook-tests-shadcn.md)

---

## One component library: `src/components/ui/` (2026-08-01)

`@heroui/react` is **uninstalled**. Every screen — public pages, auth, and the whole studio — renders hand-rolled shadcn-style primitives: CVA variants or plain styled elements over Radix, reading the `--color-*` tokens directly. If you see `@heroui/react` in an example anywhere, that example is stale.

| Primitive | Built on | Notes |
|---|---|---|
| `Button` / `buttonVariants` | CVA + `@radix-ui/react-slot` | `variant`: `primary` \| `secondary` \| `outline` \| `ghost` \| `destructive` \| `destructive-outline` \| `link`. `size`: `xs` \| `sm` \| `md` \| `lg` \| `icon` \| `icon-sm`. `isLoading` prepends a spinner (skipped under `asChild`, which takes one child) |
| `Badge` / `badgeVariants` | CVA | `default` \| `secondary` \| `soft` \| `outline` \| `success` \| `warning` \| `destructive` |
| `Card` (+ `CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`) | — | `isInteractive` lifts + outlines on hover, for a card that is one big link |
| `Input` / `Textarea` / `Label` | `@radix-ui/react-label` | Event-based DOM semantics |
| `Select` (+ `SelectTrigger`/`SelectContent`/`SelectItem`/…) | `@radix-ui/react-select` | For custom option rendering; `SelectField` covers enum pickers |
| `Dialog` (+ `DialogContent`/`DialogTitle`/`DialogDescription`/`DialogFooter`/…) | `@radix-ui/react-alert-dialog` | Confirmation dialogs. Modal, no dismiss-on-outside-click |
| `Collapsible` | `@radix-ui/react-collapsible` | Disclosure sections |
| `Progress` | `@radix-ui/react-progress` | `value` 0–100, `indicatorClassName` to recolor the fill |
| `Separator` | `@radix-ui/react-separator` | |
| `Spinner` | `lucide-react` | |
| `Skeleton` | — | |
| `PageHeader` | — | Eyebrow / title / description / meta / actions. First block on every studio page |
| `EmptyState` | — | Icon + title + description + one action. `isInset` for an empty slot inside a card |
| `FieldShell` | — | The label/hint/error scaffold every field composes |
| `Stepper` / `OptionCardGroup` / `TagsInput` | — | Wizard-specific |
| `Typography` | — | Heading/paragraph scale, see below |
| `Sonner` | `sonner` | `Toaster`, mounted once in `src/app/layout.tsx` |

```tsx
import { Button, buttonVariants } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

<Button variant="primary" size="md" isLoading={isSaving}>Save</Button>
<Badge variant="soft">Active</Badge>
<Card isInteractive>
  <CardHeader><CardTitle>Episode 3</CardTitle></CardHeader>
  <CardContent>…</CardContent>
</Card>
```

`Button`-as-link applies `buttonVariants` to a `Link` — the component has no polymorphic `as`:

```tsx
<Link href="/projects/new" className={buttonVariants({ variant: 'primary', size: 'md' })}>
  New project
</Link>
```

**Everything is event-based DOM semantics** — `onClick`, `disabled`, `required` — with one deliberate exception below. Porting old code: `onPress` → `onClick`, `isDisabled` → `disabled`, `variant="danger"` → `variant="destructive"`, `<Chip>` → `<Badge>` or `<StatusChip>`.

---

## The one value-based exception: the field wrappers

`TextInputField`, `TextAreaField`, `NumberInputField` and `SelectField` compose `FieldShell` + a control, and **keep a value-based `onChange(value)`** inherited from the HeroUI originals they replaced:

```tsx
// ✅ the wrappers hand you the value
<TextInputField label="Title" value={title} onChange={setTitle} />
<NumberInputField label="Seconds" value={seconds} onChange={setSeconds} minValue={1} />

// ✅ the raw primitives are ordinary DOM
<Input value={title} onChange={(e) => setTitle(e.target.value)} />
```

Every call site in the app passes a state setter straight in, so the signature was kept rather than rewritten at ~40 call sites. They also still accept `isRequired` / `isDisabled` / `isInvalid` alongside `label` / `hint` / `error` / `fullWidth`.

`FieldShell` owns the label row (with an optional right-aligned `labelAction`), the required marker, `aria-describedby` wiring, and the rule that **an error replaces the hint** rather than stacking under it. Compose it for a new field type; do not re-implement the trio.

**They are controlled only when `value` is passed.** Spreading `value={value ?? ''}` unconditionally pins an uncontrolled field to the empty string and drops every keystroke but the last — see LEARN.md 2026-08-01.

`SelectField` is a native `<select>` in the same shell. Reach for the Radix `Select` only when you need search, multi-select, or rich item rendering.

---

## Typography — [src/components/ui/Typography/](../../../src/components/ui/Typography/)

| Variant | HTML element | Class |
|---|---|---|
| `h1` | `<h1>` | `text-4xl font-extrabold tracking-tight lg:text-5xl` |
| `h2` | `<h2>` | `text-3xl font-semibold tracking-tight` |
| `h3`–`h6` | `<h3>`–`<h6>` | proportionally smaller |
| `p` | `<p>` | `leading-7` |
| `lead` | `<p>` | `text-xl leading-relaxed` |
| `large` | `<p>` | `text-lg` |
| `small` | `<p>` | `text-sm` |
| `muted` | `<p>` | `text-sm text-foreground-muted` |
| `code` | `<code>` | `bg-surface-raised px-1.5 font-mono text-sm` |

Prop `as?: ElementType` overrides the rendered element.

Studio pages generally use `PageHeader` rather than a bare `Typography variant="h2"` — it puts the eyebrow, title, description, status meta and actions in the same place on every screen.

---

← [01 — Layers, CVA](./01-structure-cva.md) | [COMPONENTS.md](../COMPONENTS.md) | → [03 — Storybook, tests, accessibility](./03-storybook-tests-shadcn.md)
