import type { Meta, StoryObj } from '@storybook/nextjs';

import { Typography } from './Typography';

const meta = {
  title: 'UI/Typography',
  component: Typography,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'lead', 'large', 'small', 'muted', 'code'],
    },
  },
} satisfies Meta<typeof Typography>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variant: 'p',
    children: 'The quick brown fox jumps over the lazy dog.',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-4">
      <Typography variant="h1">Heading 1</Typography>
      <Typography variant="h2">Heading 2</Typography>
      <Typography variant="h3">Heading 3</Typography>
      <Typography variant="h4">Heading 4</Typography>
      <Typography variant="lead">Lead paragraph — intro text that sets context.</Typography>
      <Typography variant="p">
        Body text. The quick brown fox jumps over the lazy dog. Used for regular paragraph content
        throughout the application.
      </Typography>
      <Typography variant="large">Large emphasis text</Typography>
      <Typography variant="small">Small label text</Typography>
      <Typography variant="muted">Muted helper or secondary text</Typography>
      <Typography variant="code">const value = 42;</Typography>
    </div>
  ),
};
