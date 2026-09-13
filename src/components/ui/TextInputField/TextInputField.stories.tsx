import type { Meta, StoryObj } from '@storybook/nextjs';
import { fn } from 'storybook/test';

import { TextInputField } from './TextInputField';

const meta = {
  title: 'UI/TextInputField',
  component: TextInputField,
  tags: ['autodocs'],
  args: { onChange: fn(), label: 'Project name' },
  argTypes: {
    type: { control: 'select', options: ['text', 'email', 'password'] },
  },
} satisfies Meta<typeof TextInputField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { placeholder: "Luna's Adventures" } };

export const WithHint: Story = {
  args: { label: 'Handle', hint: '@mention token — lowercase letters, numbers, hyphens' },
};

export const WithError: Story = {
  args: { label: 'Handle', error: 'Use lowercase letters, numbers, and hyphens only' },
};

export const Required: Story = { args: { isRequired: true } };

export const Disabled: Story = { args: { isDisabled: true, value: 'luna' } };

export const Password: Story = {
  args: { label: 'API key', type: 'password', hint: 'Stored encrypted (AES-256-GCM).' },
};
