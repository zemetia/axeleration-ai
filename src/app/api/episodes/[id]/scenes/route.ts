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

  const ownerId = await episodeService.ownerOf(id);
  if (!ownerId) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }
  if (ownerId !== userId) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const scenes = await episodeService.scenes(id);
  return NextResponse.json(scenes);
}
