import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { guardOwner } from '@/lib/api-guard';
import { assetAttributesSchema } from '@/lib/validations';
import { projectService } from '@/services';
import { AssetType } from '@prisma/client';

/** Renders one view of one asset. One shot per request — see `src/assets/lab/generate-shot.ts`. */

const bodySchema = z.object({
  type: z.nativeEnum(AssetType),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  attributes: assetAttributesSchema.default({}),
  viewId: z.string().min(1).max(60),
  panelId: z.string().min(1).max(60).optional(),
  basePrompt: z.string().max(4000).optional(),
  styleHandle: z.string().max(60).optional(),
  referenceUrl: z.string().max(2000).optional(),
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

  const { generateAssetShot } = await import('@/assets/lab/generate-shot');

  try {
    const shot = await generateAssetShot({ projectId: id, ...parsed.data });
    return NextResponse.json(shot);
  } catch (error) {
    // A provider failure is per-view and recoverable — the client retries this one angle, so the
    // message has to say what actually went wrong rather than a generic 500.
    const message = error instanceof Error ? error.message : 'Generation failed';
    return NextResponse.json({ message }, { status: 502 });
  }
}
