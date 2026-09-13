import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { fn } from 'storybook/test';

import { ComboboxField, type ComboboxFieldOption } from './ComboboxField';

const MODELS: ComboboxFieldOption[] = [
  { value: 'wavespeed-ai/z-image/turbo', label: 'Z-Image Turbo' },
  { value: 'bytedance/seedream-v5.0-pro', label: 'Seedream v5.0 Pro' },
  { value: 'google/nano-banana-pro/text-to-image', label: 'Nano Banana Pro' },
  { value: 'google/nano-banana-2/text-to-image', label: 'Nano Banana 2' },
  { value: 'openai/gpt-image-2/text-to-image', label: 'GPT Image 2' },
  { value: 'alibaba/qwen-image-3.0/text-to-image', label: 'Qwen Image 3.0' },
  { value: 'alibaba/qwen-image-3.0-pro/text-to-image', label: 'Qwen Image 3.0 Pro' },
];

const meta = {
  title: 'UI/ComboboxField',
  component: ComboboxField,
  tags: ['autodocs'],
  args: { onChange: fn(), label: 'Model', options: MODELS, value: '' },
} satisfies Meta<typeof ComboboxField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Preselected: Story = { args: { value: 'bytedance/seedream-v5.0-pro' } };

export const WithHint: Story = { args: { hint: 'Search by name — the model id is submitted.' } };

export const WithError: Story = { args: { error: 'Pick a model' } };

export const Disabled: Story = { args: { disabled: true, value: 'wavespeed-ai/z-image/turbo' } };

/** A secondary line — e.g. a live price — renders under the label, shadcn combobox-style. */
export const WithDescriptions: Story = {
  args: {
    options: [
      { value: 'wavespeed-ai/z-image/turbo', label: 'Z-Image Turbo', description: '$0.01' },
      { value: 'bytedance/seedream-v5.0-pro', label: 'Seedream v5.0 Pro', description: '$0.04' },
      { value: 'google/nano-banana-pro/text-to-image', label: 'Nano Banana Pro', description: '$0.03' },
    ],
  },
};

/** ComboboxField owns nothing internally — this harness is what every real call site looks like. */
export const Interactive: Story = {
  render: (args) => {
    function Harness() {
      const [value, setValue] = useState('');
      return <ComboboxField {...args} value={value} onChange={setValue} />;
    }
    return <Harness />;
  },
};
