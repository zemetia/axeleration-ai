import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TextInputField } from './TextInputField';

describe('TextInputField', () => {
  it('associates the label with the input', () => {
    render(<TextInputField label="Project name" />);
    expect(screen.getByRole('textbox', { name: 'Project name' })).toBeInTheDocument();
  });

  it('calls onChange with the value, not the event', async () => {
    const onChange = vi.fn();
    render(<TextInputField label="Handle" onChange={onChange} />);

    await userEvent.type(screen.getByRole('textbox'), 'luna');

    // React Aria passes the raw value — regressing to e.target.value would break callers.
    expect(onChange).toHaveBeenLastCalledWith('luna');
  });

  it('renders the hint when there is no error', () => {
    render(<TextInputField label="Handle" hint="lowercase only" />);
    expect(screen.getByText('lowercase only')).toBeInTheDocument();
  });

  it('replaces the hint with the error and marks the field invalid', () => {
    render(<TextInputField label="Handle" hint="lowercase only" error="Handle is required" />);

    expect(screen.getByText('Handle is required')).toBeInTheDocument();
    expect(screen.queryByText('lowercase only')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('is disabled when isDisabled', () => {
    render(<TextInputField label="Handle" isDisabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
