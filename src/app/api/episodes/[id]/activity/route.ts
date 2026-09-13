import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { guardOwner } from '@/lib/api-guard';
import { subscribeActivity, type StageActivityEvent } from '@/lib/activity-bus';
import { episodeService } from '@/services';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * Streams a stage's live "what's happening right now" line as Server-Sent Events — the push
 * counterpart to `/api/episodes/[id]/stages`, which the client still polls for status transitions.
 * SSE over a real WebSocket because this is one-directional (server → client) and Next.js Route
 * Handlers stream a `Response` body natively; a WebSocket would need a custom server process this
 * app doesn't otherwise have.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const guard = await guardOwner(() => episodeService.ownerOf(id));
  if (guard instanceof NextResponse) return guard;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const unsubscribe = subscribeActivity(id, (event: StageActivityEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      });

      // A comment frame every 20s keeps the connection alive through proxies that time out an
      // otherwise-idle stream — this app has none in dev, but it's free insurance in production.
      const ping = setInterval(() => controller.enqueue(encoder.encode(': ping\n\n')), 20_000);

      request.signal.addEventListener('abort', () => {
        clearInterval(ping);
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
