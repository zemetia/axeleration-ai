import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { fn } from 'storybook/test';

import { TagsInput } from './TagsInput';

const meta = {
  title: 'UI/TagsInput',
  component: TagsInput,
  tags: ['autodocs'],
  args: {
    label: 'Tags',
    value: [],
    onChange: fn(),
    suggestions: ['cartoon', 'anime', 'realistic'],
  },
} satisfies Meta<typeof TagsInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithTags: Story = { args: { value: ['cartoon', 'anime'] } };

export const WithHint: Story = {
  args: { hint: 'Comma separated — type your own or pick a suggestion.' },
};

export const WithError: Story = { args: { error: 'At most 12 tags' } };

export const Full: Story = { args: { value: ['cartoon', 'anime'], maxTags: 2 } };

export const Interactive: Story = {
  render: function Interactive(args) {
    const [tags, setTags] = useState<string[]>(['cartoon']);
    return <TagsInput {...args} value={tags} onChange={setTags} />;
  },
};
