import type { Meta, StoryObj } from '@storybook/nextjs';

import { LanguageSwitcher } from './LanguageSwitcher';

const meta = {
  title: 'Shared/LanguageSwitcher',
  component: LanguageSwitcher,
  tags: ['autodocs'],
} satisfies Meta<typeof LanguageSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
