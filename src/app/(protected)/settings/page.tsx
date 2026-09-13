import type { Metadata } from 'next';

import { buildMetadata } from '@/lib/seo';
import { requireAuth } from '@/lib/auth';
import { PageHeader } from '@/components/ui/PageHeader';

import { SettingsContent } from './SettingsContent';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Settings', path: '/settings', noIndex: true });
}

export default async function SettingsPage() {
  await requireAuth();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="API keys are saved to your account, encrypted, and shared across every project you own. Pick a provider and model per project on that project's AI providers tab."
      />
      <SettingsContent />
    </div>
  );
}
