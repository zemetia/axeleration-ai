# Components — 01: Layers, Four-File Rule, CVA Pattern

← [COMPONENTS.md](../COMPONENTS.md) | [Blueprint INDEX](../INDEX.md) | [02 — UI components →](./02-ui-components.md)

---

## Component Layers

| Layer | Path | Constraints |
|---|---|---|
| `ui/` | [src/components/ui/](../../../src/components/ui/) | No domain logic, no stores |
| `shared/` | [src/components/shared/](../../../src/components/shared/) | Cross-feature reusable, no domain data-fetch |
| `layout/` | [src/components/layout/](../../../src/components/layout/) | Page scaffolding — Header, Footer, PageWrapper |
| feature | `src/app/<feature>/` | Co-located with page, domain-specific |

---

## Four-File Rule

Every component in `ui/` and `shared/` must have exactly these four files:

```
ComponentName/
├── ComponentName.tsx          # Implementation — only file with logic/JSX
├── ComponentName.stories.tsx  # Storybook stories
├── ComponentName.test.tsx     # Vitest + RTL tests
└── index.ts                   # Barrel — re-exports only, no logic ever
```

### index.ts template

```ts
export { ComponentName } from './ComponentName';
export type { ComponentNameProps } from './ComponentName';
```

### Import rule

```ts
// ✅ from barrel
import { TextInputField } from '@/components/ui/TextInputField';

// ❌ direct file import
import { TextInputField } from '@/components/ui/TextInputField/TextInputField';
```

There is no external component package: every primitive lives in `src/components/ui/<Name>/` and is imported from its barrel (see [02 — UI components](./02-ui-components.md) for the inventory). Radix packages supply behaviour only — a `Dialog`/`Select`/`Collapsible` wraps `@radix-ui/react-*` but is still our file, with our tokens and our four-file layout.

---

## CVA Pattern (multi-variant components)

> CVA is for a component with a real variant matrix (`Button`, `Badge`). A primitive with one look — `Input`, `Textarea`, `Separator`, `Progress` — is a plain styled element; wrapping it in `cva()` with a single empty variant set buys nothing.

All CVA-based components use `class-variance-authority`.

```ts
// src/components/ui/Button/Button.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center',
    'transition-all duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'disabled:pointer-events-none disabled:opacity-40',
  ],
  {
    variants: {
      variant: {
        primary:     ['bg-primary text-primary-foreground', 'hover:bg-primary-hover'],
        secondary:   ['bg-surface-raised text-foreground', 'hover:bg-surface-overlay'],
        outline:     ['border border-border bg-transparent', 'hover:bg-surface'],
        ghost:       ['bg-transparent text-foreground', 'hover:bg-surface'],
        destructive: ['bg-destructive text-destructive-foreground', 'hover:bg-destructive-hover'],
        link:        ['text-primary underline-offset-4 hover:underline'],
      },
      size: {
        xs: 'h-7 px-2.5 text-xs',
        sm: 'h-8 px-3 text-sm',
        md: 'h-9 px-4 text-sm',
        lg: 'h-10 px-6 text-base',
        xl: 'h-12 px-8 text-base',
        icon:      'h-9 w-9',
        'icon-sm': 'h-8 w-8',
        'icon-lg': 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariants {
  isLoading?: boolean;
  leftIcon?:  React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
```

**CVA rules:**
- `cn()` always last — lets callers override with `className`
- `forwardRef` on all interactive elements (button, input, anchor)
- `displayName` always set — required for Sentry `reactComponentAnnotation` + React DevTools
- Never hard-code colors — use design token classes only

---

← [COMPONENTS.md](../COMPONENTS.md) | → [02 — UI components](./02-ui-components.md)
