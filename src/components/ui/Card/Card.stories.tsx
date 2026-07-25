import type { Meta, StoryObj } from '@storybook/nextjs';

import { Badge } from '../Badge';
import { Button } from '../Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './Card';

const meta = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>A description of what this card contains.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-foreground-muted">Card body content goes here.</p>
      </CardContent>
    </Card>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Confirm Action</CardTitle>
        <CardDescription>This action cannot be undone.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-foreground-muted">
          Are you sure you want to delete this resource?
        </p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm" variant="destructive">Delete</Button>
        <Button size="sm" variant="ghost">Cancel</Button>
      </CardFooter>
    </Card>
  ),
};

export const WithBadge: Story = {
  render: () => (
    <Card className="w-72">
      <CardHeader>
        <Badge variant="outline" className="mb-1 w-fit">next-intl v3</Badge>
        <CardTitle>Internationalization</CardTitle>
        <CardDescription>Type-safe i18n with server and client support.</CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  ),
};
