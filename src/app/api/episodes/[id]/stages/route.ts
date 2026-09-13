import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { episodeService } from '@/services';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let userId: string;
  try {
    const session = await requireAuth();
    userId = session.user.id;
  } catch {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  // One query instead of `ownerOf()` then `stages()` — this endpoint is polled every 2s while a
  // stage is generating, so the second sequential round trip was paid thirty times a minute.
  const episode = await episodeService.getForOwner(id, userId);
  if (!episode) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(episode.stages);
}
