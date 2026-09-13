import { NextResponse } from 'next/server';

import { PRIVATE_CACHE_HEADERS } from '@/lib/api-guard';
import { requireAuth } from '@/lib/auth';
import { apiKeyService } from '@/services';

export async function GET() {
  let userId: string;
  try {
    const session = await requireAuth();
    userId = session.user.id;
  } catch {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const keys = await apiKeyService.listForUser(userId);
  return NextResponse.json(keys, { headers: PRIVATE_CACHE_HEADERS });
}
