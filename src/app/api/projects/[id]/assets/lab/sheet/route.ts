import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { guardOwner } from '@/lib/api-guard';
import { projectService } from '@/services';

/**
 * Tiles already-rendered panels into one sheet.
 *
 * No provider call and no money: the panels were paid for one request at a time by the shot route,
 * and this is the local montage that turns them into the anchor image. Kept as its own endpoint so
 * the client keeps the progressive per-panel feedback it has for every other view.
 */

const bodySchema = z.object({
  panels: z
    .array(
      z.object({
        url: z.string().min(1).max(2000),
        kind: z.enum(['body', 'face']),
      }),
    )
    .min(1)
    .max(12),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;

  const guard = await guardOwner(() => projectService.ownerOf(id));
  if (guard instanceof NextResponse) return guard;

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  }

  // Imported lazily like the shot route: sharp is a native module, and nothing else on this page's
  // request path should pay to load it.
  const { composeAnchorSheet } = await import('@/assets/lab/anchor-sheet');

  try {
    return NextResponse.json(await composeAnchorSheet(parsed.data.panels));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sheet composition failed';
    return NextResponse.json({ message }, { status: 502 });
  }
}
