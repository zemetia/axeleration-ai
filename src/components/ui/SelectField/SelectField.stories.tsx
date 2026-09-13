import type { Meta, StoryObj } from '@storybook/nextjs';
import { fn } from 'storybook/test';

import { SelectField } from './SelectField';

const PROJECT_TYPES = [
  { value: 'EPISODIC', label: 'Episodic' },
  { value: 'NON_CONTINUOUS', label: 'Non-continuous' },
];

const meta = {
  title: 'UI/SelectField',
  component: SelectField,
  tags: ['autodocs'],
  args: { onChange: fn(), label: 'Project type', options: PROJECT_TYPES },
} satisfies Meta<typeof SelectField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = { args: { hint: 'Drives the default style preset.' } };

export const WithError: Story = { args: { error: 'Pick a project type' } };

export const Disabled: Story = { args: { disabled: true } };

export const AspectRatios: Story = {
  args: {
    label: 'Aspect ratio',
    options: [
      { value: 'R9_16', label: '9:16 — Vertical (Reels / Shorts)' },
      { value: 'R16_9', label: '16:9 — Widescreen' },
      { value: 'R1_1', label: '1:1 — Square' },
    ],
  },
};
