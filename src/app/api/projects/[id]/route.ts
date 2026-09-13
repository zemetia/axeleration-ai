import { NextResponse } from 'next/server';

import { guardOwner, PRIVATE_CACHE_HEADERS } from '@/lib/api-guard';
import { projectService } from '@/services';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;

  const guard = await guardOwner(() => projectService.ownerOf(id));
  if (guard instanceof NextResponse) return guard;

  const project = await projectService.get(id);
  if (!project) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  return NextResponse.json(project, { headers: PRIVATE_CACHE_HEADERS });
}
