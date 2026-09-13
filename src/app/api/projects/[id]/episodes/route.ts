import { NextResponse } from 'next/server';

import { guardOwner, PRIVATE_CACHE_HEADERS } from '@/lib/api-guard';
import { episodeService, projectService } from '@/services';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;

  const guard = await guardOwner(() => projectService.ownerOf(id));
  if (guard instanceof NextResponse) return guard;

  const episodes = await episodeService.listByProject(id);
  return NextResponse.json(episodes, { headers: PRIVATE_CACHE_HEADERS });
}
