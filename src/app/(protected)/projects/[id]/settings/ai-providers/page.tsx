import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { buildMetadata } from '@/lib/seo';

import { getProjectQuery } from '../../../queries';
import { ProjectSettingsForm } from '../ProjectSettingsForm';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return buildMetadata({
    title: 'AI providers — project settings',
    path: `/projects/${id}/settings/ai-providers`,
    noIndex: true,
  });
}

export default async function ProjectAiProvidersSettingsPage({ params }: Props) {
  const { id } = await params;
  const project = await getProjectQuery(id);

  if (!project) {
    notFound();
  }

  return <ProjectSettingsForm projectId={id} project={project} section="ai-providers" />;
}
