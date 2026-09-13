import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OptionCardGroup } from './OptionCardGroup';

const OPTIONS = [
  { value: 'EPISODIC', label: 'Episodic', description: 'A continuing series.' },
  { value: 'NON_CONTINUOUS', label: 'Non-continuous', description: 'Standalone videos.' },
];

describe('OptionCardGroup', () => {
  it('renders one radio per option, labelled by its card', () => {
    render(
      <OptionCardGroup
        label="Project type"
        options={OPTIONS}
        value="EPISODIC"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: /Episodic/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Non-continuous/ })).not.toBeChecked();
  });

  it('shows each option description', () => {
    render(<OptionCardGroup options={OPTIONS} value="EPISODIC" onChange={vi.fn()} />);
    expect(screen.getByText('Standalone videos.')).toBeInTheDocument();
  });

  it('calls onChange with the picked value', async () => {
    const onChange = vi.fn();
    render(<OptionCardGroup options={OPTIONS} value="EPISODIC" onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: /Non-continuous/ }));

    expect(onChange).toHaveBeenCalledWith('NON_CONTINUOUS');
  });

  it('shows the error instead of the hint', () => {
    render(
      <OptionCardGroup
        options={OPTIONS}
        value="EPISODIC"
        onChange={vi.fn()}
        hint="pick one"
        error="Required"
      />,
    );

    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.queryByText('pick one')).not.toBeInTheDocument();
  });
});
