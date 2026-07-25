import type { Meta, StoryObj } from '@storybook/nextjs';

import { Input } from './Input';

const meta = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
  },
};

export const WithLabel: Story = {
  args: {
    label: 'Email address',
    placeholder: 'you@example.com',
    type: 'email',
  },
};

export const WithHint: Story = {
  args: {
    label: 'Password',
    type: 'password',
    placeholder: '••••••••',
    hint: 'Must be at least 8 characters.',
  },
};

export const WithError: Story = {
  args: {
    label: 'Email address',
    placeholder: 'you@example.com',
    type: 'email',
    defaultValue: 'not-an-email',
    error: 'Please enter a valid email address.',
  },
};

export const Required: Story = {
  args: {
    label: 'Full name',
    placeholder: 'John Doe',
    required: true,
  },
};

export const Disabled: Story = {
  args: {
    label: 'Username',
    defaultValue: 'johndoe',
    disabled: true,
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-4">
      <Input size="sm" placeholder="Small input" />
      <Input size="md" placeholder="Medium input (default)" />
      <Input size="lg" placeholder="Large input" />
    </div>
  ),
};
