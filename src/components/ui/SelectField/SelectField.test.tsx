import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SelectField } from './SelectField';

const OPTIONS = [
  { value: 'EPISODIC', label: 'Episodic' },
  { value: 'NON_CONTINUOUS', label: 'Non-continuous' },
];

describe('SelectField', () => {
  it('associates the label with the select', () => {
    render(<SelectField id="type" label="Project type" options={OPTIONS} />);
    expect(screen.getByRole('combobox', { name: 'Project type' })).toBeInTheDocument();
  });

  it('renders every option', () => {
    render(<SelectField label="Project type" options={OPTIONS} />);

    expect(screen.getByRole('option', { name: 'Episodic' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Non-continuous' })).toBeInTheDocument();
  });

  it('calls onChange with a DOM event (native select, unlike the HeroUI fields)', async () => {
    // Read target.value inside the handler: this is a controlled select, so React
    // resets the DOM value before any assertion outside the callback would run.
    const seen: string[] = [];
    const onChange = vi.fn((e: React.ChangeEvent<HTMLSelectElement>) => {
      seen.push(e.target.value);
    });
    render(
      <SelectField label="Project type" options={OPTIONS} value="EPISODIC" onChange={onChange} />,
    );

    await userEvent.selectOptions(screen.getByRole('combobox'), 'NON_CONTINUOUS');

    expect(onChange).toHaveBeenCalledOnce();
    expect(seen).toEqual(['NON_CONTINUOUS']);
  });

  it('marks the field invalid and shows the error instead of the hint', () => {
    render(<SelectField label="Project type" options={OPTIONS} hint="pick one" error="Required" />);

    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.queryByText('pick one')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('is disabled when disabled', () => {
    render(<SelectField label="Project type" options={OPTIONS} disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
