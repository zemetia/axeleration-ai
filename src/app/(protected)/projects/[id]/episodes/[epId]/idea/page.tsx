import type { Metadata } from 'next';

import { buildMetadata } from '@/lib/seo';

import { IdeaRoom } from '../_components/IdeaRoom';

type Props = { params: Promise<{ id: string; epId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, epId } = await params;
  return buildMetadata({
    title: 'Idea & script',
    path: `/projects/${id}/episodes/${epId}/idea`,
    noIndex: true,
  });
}

export default async function IdeaRoomPage({ params }: Props) {
  const { id, epId } = await params;
  return <IdeaRoom projectId={id} episodeId={epId} />;
}
