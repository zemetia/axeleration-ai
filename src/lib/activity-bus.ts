import 'server-only';

import { EventEmitter } from 'node:events';
import type { StageKind } from '@prisma/client';

/**
 * In-memory pub/sub for a stage's transient "what's happening right now" line — e.g. the research
 * agent reporting each search/fetch as it works. Deliberately not persisted: the line is overwritten
 * within seconds and never read after the stage finishes, so a DB write per tool call was pure
 * overhead (and the column it used to live in, `EpisodeStage.currentActivity`, is gone — see the
 * `remove_stage_current_activity` migration). `/api/episodes/[id]/activity` streams straight off this
 * bus over SSE; nothing else touches it.
 *
 * Scoped to this process's memory — correct for the single long-running Node process this app runs
 * as (`next dev` / `next start`, with Inngest functions executing in-process via the webhook route).
 * A multi-instance/serverless deployment would need a real pub/sub (Redis, etc.) instead.
 */

export interface StageActivityEvent {
  kind: StageKind;
  activity: string | null;
}

const bus = new EventEmitter();
// One episode can have several rooms/tabs subscribed at once (StagePanel + RunningBanner) — the
// default limit of 10 listeners is a diagnostic warning threshold, not a real cap, but silence it.
bus.setMaxListeners(0);

function channel(episodeId: string): string {
  return `activity:${episodeId}`;
}

export function publishActivity(episodeId: string, kind: StageKind, activity: string | null): void {
  bus.emit(channel(episodeId), { kind, activity } satisfies StageActivityEvent);
}

/** Returns an unsubscribe function — callers must call it when the connection closes. */
export function subscribeActivity(
  episodeId: string,
  listener: (event: StageActivityEvent) => void,
): () => void {
  bus.on(channel(episodeId), listener);
  return () => bus.off(channel(episodeId), listener);
}
