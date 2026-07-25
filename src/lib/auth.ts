import { auth } from '@/auth';
import type { Session } from 'next-auth';

export async function getSession(): Promise<Session | null> {
  return auth();
}

export async function requireAuth(): Promise<Session> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  return session;
}

export async function requireRole(role: string): Promise<Session> {
  const session = await requireAuth();
  if (session.user.role !== role) throw new Error('Forbidden');
  return session;
}
