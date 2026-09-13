import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { episodeService } from '@/services';

/**
 * One episode, including its stages and its auto-pilot state.
 *
 * The stages endpoint next door deliberately returns only the stage rows; auto-pilot lives on the
 * episode itself, and the control room needs to poll it — a run that stops because it hit the
 * budget has to say so without a page reload.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let userId: string;
  try {
    const session = await requireAuth();
    userId = session.user.id;
  } catch {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const episode = await episodeService.getForOwner(id, userId);
  if (!episode) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(episode);
}
