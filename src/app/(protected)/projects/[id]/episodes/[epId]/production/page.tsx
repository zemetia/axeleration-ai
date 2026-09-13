import type { Metadata } from 'next';

import { buildMetadata } from '@/lib/seo';

import { ProductionRoom } from '../_components/ProductionRoom';

type Props = { params: Promise<{ id: string; epId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, epId } = await params;
  return buildMetadata({
    title: 'Production',
    path: `/projects/${id}/episodes/${epId}/production`,
    noIndex: true,
  });
}

export default async function ProductionRoomPage({ params }: Props) {
  const { id, epId } = await params;
  return <ProductionRoom projectId={id} episodeId={epId} />;
}
