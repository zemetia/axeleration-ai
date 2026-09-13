import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { guardOwner } from '@/lib/api-guard';
import { assetAttributesSchema } from '@/lib/validations';
import { projectService } from '@/services';
import { AssetType } from '@prisma/client';

/**
 * Base prompt → a filled-in asset. A route handler rather than a Server Action for the same reason
 * the lab's shot endpoint is one: actions are serialized one-in-flight per client, and the lab
 * fires this alongside uploads and renders.
 */

const bodySchema = z.object({
  type: z.nativeEnum(AssetType),
  basePrompt: z.string().min(3, 'Describe the asset first').max(4000),
  existing: z
    .object({
      name: z.string().max(120).optional(),
      description: z.string().max(2000).optional(),
      attributes: assetAttributesSchema.optional(),
    })
    .optional(),
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

  // Dynamic import: this route pulls in LangChain and the provider registry, and a static import
  // would put that graph on the module boundary of anything that shares a chunk with it.
  const { runAssetDraftChain } = await import('@/ai/assets/asset-draft-chain');

  try {
    const draft = await runAssetDraftChain({ projectId: id, ...parsed.data });
    return NextResponse.json(draft);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Drafting failed';
    return NextResponse.json({ message }, { status: 502 });
  }
}
