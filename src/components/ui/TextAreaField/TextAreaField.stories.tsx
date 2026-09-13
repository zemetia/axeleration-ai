import type { Meta, StoryObj } from '@storybook/nextjs';
import { Sparkles } from 'lucide-react';
import { fn } from 'storybook/test';

import { TextAreaField } from './TextAreaField';

const meta = {
  title: 'UI/TextAreaField',
  component: TextAreaField,
  tags: ['autodocs'],
  args: { onChange: fn(), label: 'Premise' },
} satisfies Meta<typeof TextAreaField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { hint: 'The one-paragraph story concept the AI writer builds episodes from.' },
};

export const WithError: Story = { args: { error: 'Premise is required' } };

export const Tall: Story = { args: { rows: 8 } };

export const Disabled: Story = {
  args: { isDisabled: true, value: 'A curious fox named Luna…' },
};

export const WithLabelAction: Story = {
  args: {
    hint: 'The one-paragraph story concept the AI writer builds episodes from.',
    labelAction: (
      <button
        type="button"
        className="text-primary-text inline-flex items-center gap-1 text-xs font-medium"
      >
        <Sparkles aria-hidden className="size-3.5" />
        Refine with AI
      </button>
    ),
  },
};
