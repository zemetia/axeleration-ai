import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { PRIVATE_CACHE_HEADERS } from '@/lib/api-guard';
import { projectService } from '@/services';

export async function GET() {
  let userId: string;
  try {
    const session = await requireAuth();
    userId = session.user.id;
  } catch {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const projects = await projectService.list(userId);
  return NextResponse.json(projects, { headers: PRIVATE_CACHE_HEADERS });
}
