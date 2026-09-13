import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 300/min, not 60: the Episode Review page polls `/api/episodes/[id]/stages` every 3s
// (20 req/min per open tab) on top of NextAuth session calls, so a 60/min ceiling made
// the app rate-limit its own users once a few tabs were open. Still low enough to blunt
// scripted abuse.
const LIMIT = 300;
const WINDOW_MS = 60_000; // 1 minute
/** Hard cap so a flood of unique IPs can't grow the bucket map without bound. */
const MAX_BUCKETS = 10_000;

interface Bucket {
  count: number;
  resetAt: number;
}

// Fixed-window in-memory limiter. Edge Runtime middleware cannot use `next-limitr`:
// its `withRateLimit` requires `ioredis` at module scope even when configured for
// in-memory storage, which crashes on evaluation under the Edge Runtime (no Node
// `net`/`tls`) and 500s every request. See docs/knowledge/LEARN.md 2026-07-28.
//
// Caveat: module state only persists per isolate. On a single dev/Node server this
// limits correctly; on horizontally-scaled Edge deploys each isolate counts
// separately, so the effective limit is per-isolate. Swap in a shared store
// (Upstash Redis REST — HTTP, so Edge-safe) before relying on this in production.
const buckets = new Map<string, Bucket>();

/** Drops expired buckets; falls back to clearing everything if the map is over cap. */
function evictExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size > MAX_BUCKETS) buckets.clear();
}

function keyFor(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'anonymous'
  );
}

export async function applyRateLimit(request: NextRequest): Promise<NextResponse | null> {
  if (!request.nextUrl.pathname.startsWith('/api')) return null;

  const now = Date.now();
  const key = keyFor(request);
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    // Sweep on window rollover — bounded work, no timers (none survive in Edge).
    evictExpired(now);
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }

  bucket.count += 1;
  if (bucket.count <= LIMIT) return null;

  const resetSeconds = Math.max(0, Math.ceil((bucket.resetAt - now) / 1000));
  return new NextResponse('Too Many Requests', {
    status: 429,
    headers: {
      'Retry-After': String(resetSeconds),
      'X-RateLimit-Limit': String(LIMIT),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(Math.floor(bucket.resetAt / 1000)),
    },
  });
}
