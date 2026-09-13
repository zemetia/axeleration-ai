import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { buildMetadata } from '@/lib/seo';

import { getProjectQuery } from '../../../queries';
import { DangerZone } from './DangerZone';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return buildMetadata({
    title: 'Danger zone — project settings',
    path: `/projects/${id}/settings/danger`,
    noIndex: true,
  });
}

export default async function ProjectDangerSettingsPage({ params }: Props) {
  const { id } = await params;
  const project = await getProjectQuery(id);

  if (!project) {
    notFound();
  }

  return (
    <DangerZone
      projectId={id}
      projectName={project.name}
      episodeCount={project.episodeCount}
      assetCount={project.assetCount}
    />
  );
}
