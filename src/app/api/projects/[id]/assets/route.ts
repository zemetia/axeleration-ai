import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { guardOwner, PRIVATE_CACHE_HEADERS } from '@/lib/api-guard';
import { assetService, projectService } from '@/services';
import type { AssetStatus, AssetType } from '@prisma/client';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;

  const guard = await guardOwner(() => projectService.ownerOf(id));
  if (guard instanceof NextResponse) return guard;

  const type = request.nextUrl.searchParams.get('type') as AssetType | null;
  const status = request.nextUrl.searchParams.get('status') as AssetStatus | null;

  const assets = await assetService.list(id, {
    ...(type && { type }),
    ...(status && { status }),
  });
  return NextResponse.json(assets, { headers: PRIVATE_CACHE_HEADERS });
}
