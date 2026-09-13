import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { NumberInputField } from './NumberInputField';

describe('NumberInputField', () => {
  it('associates the label with the spinbutton', () => {
    render(<NumberInputField label="Target length" value={60} />);
    expect(screen.getByRole('textbox', { name: 'Target length' })).toBeInTheDocument();
  });

  it('renders increment and decrement controls', () => {
    render(<NumberInputField label="Target length" value={60} />);

    expect(screen.getByRole('button', { name: /increase/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /decrease/i })).toBeInTheDocument();
  });

  it('calls onChange with a number when incremented', async () => {
    const onChange = vi.fn();
    render(<NumberInputField label="Target length" value={60} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /increase/i }));

    expect(onChange).toHaveBeenCalledWith(61);
  });

  it('does not decrement below minValue', async () => {
    const onChange = vi.fn();
    render(<NumberInputField label="Min scene" value={1} minValue={1} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /decrease/i }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the error instead of the hint', () => {
    render(<NumberInputField label="Max scene" value={2} hint="seconds" error="Too small" />);

    expect(screen.getByText('Too small')).toBeInTheDocument();
    expect(screen.queryByText('seconds')).not.toBeInTheDocument();
  });
});
