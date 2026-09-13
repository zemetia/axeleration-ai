import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TextAreaField } from './TextAreaField';

describe('TextAreaField', () => {
  it('associates the label with the textarea', () => {
    render(<TextAreaField label="Premise" />);
    expect(screen.getByRole('textbox', { name: 'Premise' })).toBeInTheDocument();
  });

  it('calls onChange with the value, not the event', async () => {
    const onChange = vi.fn();
    render(<TextAreaField label="Premise" onChange={onChange} />);

    await userEvent.type(screen.getByRole('textbox'), 'fox');

    expect(onChange).toHaveBeenLastCalledWith('fox');
  });

  it('applies the requested row count', () => {
    render(<TextAreaField label="Premise" rows={8} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '8');
  });

  it('shows the error instead of the hint', () => {
    render(<TextAreaField label="Premise" hint="one paragraph" error="Premise is required" />);

    expect(screen.getByText('Premise is required')).toBeInTheDocument();
    expect(screen.queryByText('one paragraph')).not.toBeInTheDocument();
  });

  it('renders a labelAction alongside the label', () => {
    render(<TextAreaField label="Premise" labelAction={<button type="button">Refine</button>} />);

    expect(screen.getByRole('button', { name: 'Refine' })).toBeInTheDocument();
  });
});
