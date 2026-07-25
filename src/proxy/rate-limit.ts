import { RateLimitStrategy, withRateLimit } from 'next-limitr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const LIMIT = 60;
const WINDOW_MS = 60_000; // 1 minute

// next-limitr is a Route Handler HOF. We adapt it for middleware.ts by wrapping a
// noop handler — the 429 path fires our custom `handler` before the noop runs.
const limitedNoop = withRateLimit({
  limit: LIMIT,
  windowMs: WINDOW_MS,
  strategy: RateLimitStrategy.SLIDING_WINDOW,
  keyGenerator: (req) =>
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'anonymous',
  handler: (_, usage) =>
    new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': String(Math.max(0, usage.reset - Math.floor(Date.now() / 1000))),
        'X-RateLimit-Limit': String(usage.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(usage.reset),
      },
    }),
})(() => NextResponse.next());

export async function applyRateLimit(request: NextRequest): Promise<NextResponse | null> {
  if (!request.nextUrl.pathname.startsWith('/api')) return null;
  const response = await limitedNoop(request);
  return response.status === 429 ? response : null;
}
