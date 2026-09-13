import 'server-only';

import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';

/**
 * Auth + ownership check shared by the read route handlers.
 *
 * Returns either the authenticated user id, or the `NextResponse` to send back. Callers
 * do `if (guard instanceof NextResponse) return guard;`.
 */
export async function guardOwner(
  ownerOf: () => Promise<string | null>,
): Promise<string | NextResponse> {
  let userId: string;
  try {
    const session = await requireAuth();
    userId = session.user.id;
  } catch {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const ownerId = await ownerOf();
  if (!ownerId) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  if (ownerId !== userId) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  return userId;
}

/** Private-to-the-user data: cacheable in the browser for a beat, never in a shared cache. */
export const PRIVATE_CACHE_HEADERS = {
  'Cache-Control': 'private, no-cache',
} as const;
