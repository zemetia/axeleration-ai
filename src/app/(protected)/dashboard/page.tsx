import type { Metadata } from 'next';

import { buildMetadata } from '@/lib/seo';
import { PageHeader } from '@/components/ui/PageHeader';

import { getProjectsQuery } from '../projects/queries';

import { DashboardContent } from './DashboardContent';
import { NewProjectButton } from './NewProjectButton';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Dashboard', path: '/dashboard', noIndex: true });
}

export default async function DashboardPage() {
  // Fetched on the server and handed to the client component as `initialData`. Previously
  // the page shipped a skeleton, waited for hydration, then issued a Server Action to load
  // projects — so the user stared at three grey boxes for a full round-trip after the HTML
  // had already arrived. The list is now in the first paint.
  const projects = await getProjectsQuery();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Studio"
        title="Projects"
        description="Every AI video series you're producing. Open one to write its episodes, build its cast and locations, or send it to production."
        actions={<NewProjectButton />}
      />

      <DashboardContent initialProjects={projects} />
    </div>
  );
}
