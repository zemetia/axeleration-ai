# Components — 03: Storybook, Tests, shadcn, Accessibility

← [02 — UI components](./02-ui-components.md) | [COMPONENTS.md](../COMPONENTS.md) | [Blueprint INDEX](../INDEX.md)

---

## Storybook Convention

Framework: `@storybook/nextjs`. Import `Meta`/`StoryObj` from `@storybook/nextjs`, `fn()` from `storybook/test`.

```ts
// ComponentName.stories.tsx
import type { Meta, StoryObj } from '@storybook/nextjs';
import { fn } from 'storybook/test';
import { Button } from './Button';

const meta = {
  title: 'UI/Button',          // category: UI/ | Shared/ | Layout/
  component: Button,
  tags: ['autodocs'],          // always include
  args: { onClick: fn() },     // fn() for all event handler props
  argTypes: {
    variant: { control: 'select', options: ['primary', 'outline', 'ghost'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { children: 'Get Started' } };
export const Loading: Story = { args: { isLoading: true, children: 'Saving…' } };
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      {(['primary', 'outline', 'ghost'] as const).map((v) => (
        <Button key={v} variant={v}>{v}</Button>
      ))}
    </div>
  ),
};
```

When component has required props: provide `args` at meta level for type safety in render-only stories.

---

## Test Convention

Framework: Vitest 4 + `@testing-library/react` + `@testing-library/user-event`

```ts
// ComponentName.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('calls onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled when isLoading', () => {
    render(<Button isLoading>Submit</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });
});
```

**Test rules:**
- `getByRole` first — tests accessibility semantics
- `userEvent` over `fireEvent` — real interaction simulation
- Test behavior, not className
- `vi.fn()` for mocks, `vi.useFakeTimers()` for time-dependent

---

## shadcn/ui

Config: [components.json](../../../components.json)

```json
{
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": { "css": "src/app/globals.css", "cssVariables": true },
  "aliases": {
    "utils": "@/lib/cn",
    "ui": "@/components/ui",
    "components": "@/components",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

Add component: `npx shadcn@latest add <name>`

Generated file location: `src/components/ui/<name>.tsx` (flat — NOT a subdirectory).

shadcn color tokens resolve to the design system via aliases in `src/app/globals.css`. See [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md).

Do not rename or move generated shadcn files — CLI regenerates in-place on update.

---

## Accessibility Checklist

| Requirement | Implementation |
|---|---|
| Keyboard reachable | Semantic HTML or `tabIndex` |
| Visible focus ring | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` |
| Correct ARIA role | Semantic element or explicit `role` |
| Disabled propagation | `aria-disabled` + `disabled` attribute |
| Loading state | `aria-busy="true"` on button |
| Icon-only label | `aria-label` when no visible text |

---

← [02 — UI components](./02-ui-components.md) | [COMPONENTS.md](../COMPONENTS.md)
