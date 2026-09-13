import type { Metadata } from 'next';

import { buildMetadata } from '@/lib/seo';

import { ResearchRoom } from '../_components/ResearchRoom';

type Props = { params: Promise<{ id: string; epId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, epId } = await params;
  return buildMetadata({
    title: 'Research',
    path: `/projects/${id}/episodes/${epId}/research`,
    noIndex: true,
  });
}

export default async function ResearchRoomPage({ params }: Props) {
  const { id, epId } = await params;
  return <ResearchRoom projectId={id} episodeId={epId} />;
}
