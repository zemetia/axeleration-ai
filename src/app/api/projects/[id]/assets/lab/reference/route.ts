import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { guardOwner } from '@/lib/api-guard';
import { putObject } from '@/lib/storage';
import { projectService } from '@/services';

/**
 * Stores the lab's uploaded identity anchor.
 *
 * The upload has to land in storage *before* the sheet is generated, not at save time: its URL is
 * what every view is rendered against (image-to-image), so holding it in the browser until the user
 * presses Save would mean the whole sheet was generated without it.
 */

const MAX_BYTES = 12 * 1024 * 1024;

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;

  const guard = await guardOwner(() => projectService.ownerOf(id));
  if (guard instanceof NextResponse) return guard;

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ message: 'No file uploaded' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ message: 'File is larger than 12MB' }, { status: 413 });
  }

  const ext = file.name.includes('.') ? file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') : undefined;
  const key = `projects/${id}/assets/lab/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext || 'bin'}`;
  const stored = await putObject(key, Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ url: stored.url });
}
