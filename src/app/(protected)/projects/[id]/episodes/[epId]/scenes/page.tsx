import { HydrationBoundary } from '@tanstack/react-query';
import type { Metadata } from 'next';

import { dehydrateQueries } from '@/lib/query-client';
import { buildMetadata } from '@/lib/seo';
import { episodeService } from '@/services';

import { ScenesRoom } from '../_components/ScenesRoom';

type Props = { params: Promise<{ id: string; epId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, epId } = await params;
  return buildMetadata({
    title: 'Scenes',
    path: `/projects/${id}/episodes/${epId}/scenes`,
    noIndex: true,
  });
}

export default async function ScenesRoomPage({ params }: Props) {
  const { id, epId } = await params;

  // Ownership is already enforced by the episode layout above this page, which 404s before the
  // room renders. Seeding the scene list here means the room paints filled instead of showing a
  // skeleton until a client fetch returns.
  const scenes = await episodeService.scenes(epId);

  return (
    <HydrationBoundary state={dehydrateQueries([[['episode-scenes', epId], scenes]])}>
      <ScenesRoom projectId={id} episodeId={epId} />
    </HydrationBoundary>
  );
}
