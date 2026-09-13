import type { Metadata } from 'next';

import { buildMetadata } from '@/lib/seo';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';

import { ProjectWizard } from '../ProjectWizard';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'New project', path: '/projects/new', noIndex: true });
}

export default async function NewProjectPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <Breadcrumbs items={[{ label: 'Projects', href: '/dashboard' }, { label: 'New project' }]} />

      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
          New project
        </h1>
        <p className="text-foreground-muted mx-auto max-w-md text-sm leading-relaxed text-pretty">
          Four short steps. The character bible starts generating the moment you create it.
        </p>
      </div>

      <ProjectWizard />
    </div>
  );
}
