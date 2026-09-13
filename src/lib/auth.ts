import { cache } from 'react';

import { auth } from '@/auth';
import type { Session } from 'next-auth';

/**
 * `auth()` verifies the session cookie — an HMAC verify plus a JWE decrypt on every call.
 * The protected layout called it once, then every query and route handler on the same
 * request called it again independently; a settings page ran that four or five times per
 * navigation. `cache()` memoises it for the request, so the crypto happens once.
 */
export const getSession = cache(async (): Promise<Session | null> => auth());

export async function requireAuth(): Promise<Session> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error('Unauthorized');
  return session;
}

export async function requireRole(role: string): Promise<Session> {
  const session = await requireAuth();
  if (session.user.role !== role) throw new Error('Forbidden');
  return session;
}
