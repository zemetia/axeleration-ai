import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { fn } from 'storybook/test';

import { Stepper } from './Stepper';

const STEPS = [
  { id: 'basics', label: 'Basics', description: 'Name, type, tags' },
  { id: 'story', label: 'Story', description: 'Premise and tone' },
  { id: 'video', label: 'Video', description: 'Format and length' },
  { id: 'review', label: 'Review', description: 'Confirm and create' },
];

const meta = {
  title: 'UI/Stepper',
  component: Stepper,
  tags: ['autodocs'],
  args: { steps: STEPS, current: 1, onStepChange: fn() },
} satisfies Meta<typeof Stepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FirstStep: Story = { args: { current: 0 } };

export const LastStep: Story = { args: { current: 3 } };

export const DisplayOnly: Story = { args: { onStepChange: undefined } };

export const Interactive: Story = {
  render: function Interactive(args) {
    const [current, setCurrent] = useState(1);
    return <Stepper {...args} current={current} maxReachable={3} onStepChange={setCurrent} />;
  },
};
