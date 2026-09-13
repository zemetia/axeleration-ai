import type { Meta, StoryObj } from '@storybook/nextjs';
import { fn } from 'storybook/test';

import { NumberInputField } from './NumberInputField';

const meta = {
  title: 'UI/NumberInputField',
  component: NumberInputField,
  tags: ['autodocs'],
  args: { onChange: fn(), label: 'Target episode length (seconds)' },
} satisfies Meta<typeof NumberInputField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { value: 60, minValue: 1, maxValue: 3600 } };

export const WithHint: Story = {
  args: {
    value: 4,
    minValue: 1,
    maxValue: 120,
    hint: 'Shorter scenes mean more cuts per episode.',
  },
};

export const WithError: Story = {
  args: {
    label: 'Max scene duration (seconds)',
    value: 2,
    error: 'Minimum scene duration must be less than or equal to the maximum',
  },
};

export const Disabled: Story = { args: { value: 60, isDisabled: true } };
