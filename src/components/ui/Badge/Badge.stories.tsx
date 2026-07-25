import type { Meta, StoryObj } from '@storybook/nextjs';

import { Badge } from './Badge';

const meta = {
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'outline', 'destructive', 'success', 'warning'],
    },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    dot: { control: 'boolean' },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: 'Badge' },
};

export const WithDot: Story = {
  args: { children: 'Live', variant: 'success', dot: true },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(['default', 'secondary', 'outline', 'destructive', 'success', 'warning'] as const).map(
        (variant) => (
          <Badge key={variant} variant={variant}>
            {variant.charAt(0).toUpperCase() + variant.slice(1)}
          </Badge>
        ),
      )}
    </div>
  ),
};

export const WithDots: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="success" dot>Online</Badge>
      <Badge variant="destructive" dot>Offline</Badge>
      <Badge variant="warning" dot>Degraded</Badge>
      <Badge variant="secondary" dot>Unknown</Badge>
    </div>
  ),
};
