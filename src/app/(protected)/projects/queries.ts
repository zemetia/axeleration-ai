import 'server-only';

import { cache } from 'react';

import { requireAuth } from '@/lib/auth';
import { projectService } from '@/services';
import type { ProjectVO } from '@/types/value-objects';

/**
 * These were `'use server'` Server Actions. That made them public POST endpoints *and*
 * pushed every client read through Next's serial action queue. Client reads now go through
 * the `/api/projects/*` route handlers; this module is the server-component path only.
 *
 * Both are wrapped in React `cache()`, which memoises for the duration of one request.
 * That matters here: the settings section calls `getProjectQuery` in `settings/layout.tsx`
 * **and** again in each `settings/*\/page.tsx`, so one navigation ran the whole
 * auth + ownership + fetch sequence twice. The second call is now free.
 */
export const getProjectsQuery = cache(async (): Promise<ProjectVO[]> => {
  const session = await requireAuth();
  return projectService.list(session.user.id);
});

export const getProjectQuery = cache(async (projectId: string): Promise<ProjectVO | null> => {
  const session = await requireAuth();
  return projectService.getForOwner(projectId, session.user.id);
});
