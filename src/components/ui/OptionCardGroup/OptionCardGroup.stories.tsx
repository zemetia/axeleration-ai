import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { fn } from 'storybook/test';

import { OptionCardGroup } from './OptionCardGroup';

const PROJECT_TYPES = [
  {
    value: 'EPISODIC',
    label: 'Episodic',
    description:
      'A continuing series — every episode carries the previous one’s continuity forward.',
  },
  {
    value: 'NON_CONTINUOUS',
    label: 'Non-continuous',
    description: 'Standalone videos that share a look and cast but no running storyline.',
  },
];

const meta = {
  title: 'UI/OptionCardGroup',
  component: OptionCardGroup,
  tags: ['autodocs'],
  args: { label: 'Project type', options: PROJECT_TYPES, value: 'EPISODIC', onChange: fn() },
} satisfies Meta<typeof OptionCardGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = { args: { hint: 'You can change this later.' } };

export const WithError: Story = { args: { error: 'Pick a project type' } };

export const SingleColumn: Story = { args: { columns: 1 } };

export const ResearchModes: Story = {
  args: {
    label: 'Default research mode',
    columns: 2,
    value: 'AI_CDP',
    options: [
      {
        value: 'AI_CDP',
        label: 'AI web research',
        description: 'Browses the web for grounded detail.',
      },
      {
        value: 'AI_REASONING',
        label: 'AI reasoning',
        description: 'Brainstorms from the premise only.',
      },
      { value: 'HUMAN', label: 'Human notes', description: 'You paste the context yourself.' },
      { value: 'SKIP', label: 'Skip', description: 'No research stage at all.' },
    ],
  },
};

export const Interactive: Story = {
  render: function Interactive(args) {
    const [value, setValue] = useState('EPISODIC');
    return <OptionCardGroup {...args} value={value} onChange={setValue} />;
  },
};
