import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Stepper } from './Stepper';

const STEPS = [
  { id: 'basics', label: 'Basics' },
  { id: 'story', label: 'Story' },
  { id: 'video', label: 'Video' },
];

describe('Stepper', () => {
  it('marks the current step with aria-current', () => {
    render(<Stepper steps={STEPS} current={1} />);
    expect(screen.getByRole('button', { name: /Story/ })).toHaveAttribute('aria-current', 'step');
  });

  it('numbers upcoming steps and checks off completed ones', () => {
    render(<Stepper steps={STEPS} current={1} />);

    expect(screen.getByRole('button', { name: /Video/ })).toHaveTextContent('3');
    expect(screen.getByRole('button', { name: /Basics/ })).not.toHaveTextContent('1');
  });

  it('jumps back to a visited step', async () => {
    const onStepChange = vi.fn();
    render(<Stepper steps={STEPS} current={2} onStepChange={onStepChange} />);

    await userEvent.click(screen.getByRole('button', { name: /Basics/ }));

    expect(onStepChange).toHaveBeenCalledWith(0);
  });

  it('does not allow skipping ahead past maxReachable', () => {
    render(<Stepper steps={STEPS} current={0} onStepChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Video/ })).toBeDisabled();
  });

  it('is display-only without onStepChange', () => {
    render(<Stepper steps={STEPS} current={2} />);
    expect(screen.getByRole('button', { name: /Basics/ })).toBeDisabled();
  });
});
