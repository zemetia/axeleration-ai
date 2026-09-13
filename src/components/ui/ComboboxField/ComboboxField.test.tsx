import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { ComboboxField, type ComboboxFieldOption } from './ComboboxField';

const OPTIONS: ComboboxFieldOption[] = [
  { value: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
  { value: 'claude-opus-5', label: 'Claude Opus 5' },
  { value: 'gpt-5.1', label: 'GPT-5.1' },
];

beforeAll(() => {
  // Radix's Popper positioning (ResizeObserver) and DismissableLayer (pointer capture) reach for
  // browser APIs jsdom doesn't implement — stub them so opening the popover doesn't throw.
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

/** ComboboxField owns nothing — a fixed `value` prop would pin every render back to it. */
function Controlled({ initial = '', onChange }: { initial?: string; onChange?: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <ComboboxField
      label="Model"
      options={OPTIONS}
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

describe('ComboboxField', () => {
  it('associates the label with the search input', () => {
    render(<ComboboxField label="Model" options={OPTIONS} value="" onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'Model' })).toBeInTheDocument();
  });

  it('shows the selected option label when closed', () => {
    render(<ComboboxField label="Model" options={OPTIONS} value="gpt-5.1" onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toHaveValue('GPT-5.1');
  });

  it('opens on click and lists every option', async () => {
    const user = userEvent.setup();
    render(<ComboboxField label="Model" options={OPTIONS} value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Claude Sonnet 5' })).toBeInTheDocument();
    });
    expect(screen.getByRole('option', { name: 'Claude Opus 5' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'GPT-5.1' })).toBeInTheDocument();
  });

  it('filters options as the user types', async () => {
    const user = userEvent.setup();
    render(<ComboboxField label="Model" options={OPTIONS} value="" onChange={vi.fn()} />);

    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.type(input, 'claude');

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Claude Sonnet 5' })).toBeInTheDocument();
    });
    expect(screen.getByRole('option', { name: 'Claude Opus 5' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'GPT-5.1' })).not.toBeInTheDocument();
  });

  it('selects an option on click and reports its value', async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    render(<Controlled onChange={(v) => seen.push(v)} />);

    const input = screen.getByRole('combobox');
    await user.click(input);
    const option = await screen.findByRole('option', { name: 'Claude Opus 5' });
    await user.click(option);

    expect(seen).toEqual(['claude-opus-5']);
    expect(input).toHaveValue('Claude Opus 5');
  });

  it('marks the field invalid and shows the error instead of the hint', () => {
    render(
      <ComboboxField
        label="Model"
        options={OPTIONS}
        value=""
        onChange={vi.fn()}
        hint="Pick a model"
        error="Required"
      />,
    );

    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.queryByText('Pick a model')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders a description under the label as a separate line', async () => {
    const user = userEvent.setup();
    render(
      <ComboboxField
        label="Model"
        options={[{ value: 'seedream', label: 'Seedream v5.0 Pro', description: '$0.04' }]}
        value=""
        onChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('combobox'));

    const label = await screen.findByText('Seedream v5.0 Pro');
    const description = screen.getByText('$0.04');
    expect(label.tagName).toBe('SPAN');
    expect(description.tagName).toBe('SPAN');
    expect(label).not.toBe(description);
    expect(label.closest('[role="option"]')).toBe(description.closest('[role="option"]'));
  });

  it('does not open when disabled', async () => {
    const user = userEvent.setup();
    render(<ComboboxField label="Model" options={OPTIONS} value="" onChange={vi.fn()} disabled />);

    const input = screen.getByRole('combobox');
    expect(input).toBeDisabled();
    await user.click(input);
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });
});
