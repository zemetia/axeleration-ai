import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { applyRateLimit } from './proxy/rate-limit';
import { applySecurityHeaders } from './proxy/security-headers';

export async function middleware(request: NextRequest) {
  // Rate limit — returns 429 early for /api/* if threshold exceeded
  const rateLimited = await applyRateLimit(request);
  if (rateLimited) return rateLimited;

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    // Everything except the `_next` namespace and static files. The old pattern only
    // excluded `_next/static` and `_next/image`, so every HMR poll, RSC flight fetch and
    // build-manifest request in dev still woke the Edge runtime and walked the rate-limit
    // map — hundreds of pointless middleware invocations per page. Those responses are
    // assets; they need neither rate limiting nor document security headers.
    // /api stays matched so rate limiting still applies.
    '/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|txt|xml|map)$).*)',
  ],
};
