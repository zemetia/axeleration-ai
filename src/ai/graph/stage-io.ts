import { publishActivity } from '@/lib/activity-bus';
import { prisma } from '@/lib/prisma';
import type { Prisma, StageKind } from '@prisma/client';

/**
 * Pipeline-internal read/write for `EpisodeStage` rows — not the T08 service layer, which only
 * exposes read helpers for the review UI. Nodes call this directly, same way adapters call
 * `putObject` directly, per the graph's own lifecycle contract (T04 §5).
 */

/**
 * Marks a stage GENERATING before a node runs. A stage that isn't PENDING (READY/APPROVED/FAILED)
 * is being re-run — bump `attempt` so cost/debug history distinguishes the regenerate.
 */
export async function startStage(episodeId: string, kind: StageKind): Promise<{ attempt: number }> {
  const current = await prisma.episodeStage.findUniqueOrThrow({ where: { episodeId_kind: { episodeId, kind } } });
  const isRegenerate = current.status !== 'PENDING';
  const row = await prisma.episodeStage.update({
    where: { episodeId_kind: { episodeId, kind } },
    data: {
      status: 'GENERATING',
      startedAt: new Date(),
      finishedAt: null,
      error: null,
      attempt: isRegenerate ? { increment: 1 } : undefined,
    },
  });
  publishActivity(episodeId, kind, null);
  return { attempt: row.attempt };
}

/**
 * Pushes the "what's happening right now" line clients stream over SSE while a stage is GENERATING
 * — e.g. the research agent reporting each search/fetch as it happens. In-memory only (see
 * `src/lib/activity-bus.ts`) — this line is never persisted, so there is nothing here to fail.
 */
export function updateStageActivity(episodeId: string, kind: StageKind, activity: string): void {
  publishActivity(episodeId, kind, activity);
}

export interface CompleteStageInput {
  output: Prisma.InputJsonValue;
  costEstimate?: number;
  providerMeta?: Prisma.InputJsonValue;
}

export async function completeStage(episodeId: string, kind: StageKind, input: CompleteStageInput): Promise<void> {
  await prisma.episodeStage.update({
    where: { episodeId_kind: { episodeId, kind } },
    data: {
      status: 'READY',
      finishedAt: new Date(),
      output: input.output,
      costEstimate: input.costEstimate,
      providerMeta: input.providerMeta,
    },
  });
  publishActivity(episodeId, kind, null);
}

/**
 * Adds `amount` to a stage's `costEstimate` without touching status/output — used when a targeted
 * scene regenerate (which lives outside the SCENES stage's own `withStage` run) needs the batch
 * total on `EpisodeStage(SCENES)` to stay in sync with the sum of its `Scene.costEstimate` rows.
 */
export async function addStageCost(episodeId: string, kind: StageKind, amount: number): Promise<void> {
  if (!amount) return;
  await prisma.episodeStage.update({
    where: { episodeId_kind: { episodeId, kind } },
    data: { costEstimate: { increment: amount } },
  });
}

export async function failStage(episodeId: string, kind: StageKind, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await prisma.episodeStage.update({
    where: { episodeId_kind: { episodeId, kind } },
    data: { status: 'FAILED', finishedAt: new Date(), error: message },
  });
  publishActivity(episodeId, kind, null);
}

/**
 * Stamps a run's failure on `kind` unless `kind` itself already finished successfully during that
 * run — in which case the error belongs to some other node and overwriting would blame the wrong
 * stage.
 *
 * The callers are the Inngest wrappers, which exist to cover failures thrown *around* a node's own
 * `withStage` (the graph-version guard, a stray downstream node): those never touch the stage row,
 * so without a stamp the UI shows the stage unchanged and polls for an `attempt` that never moves.
 * Unconditionally stamping is wrong in the opposite direction, and cost a real debugging session:
 * a SCRIPT refine completed, a stale MUSIC task in the same superstep 401'd on its music provider,
 * and the catch wrote `All providers exhausted for capability "music"` onto the SCRIPT row — over a
 * `script` output that was perfectly good. `since` is what separates the two: a READY row whose
 * `finishedAt` predates this run is stale and must still be failed.
 *
 * Returns whether it stamped, so a caller can log which stage actually owns the failure.
 */
export async function failStageUnlessCompletedSince(
  episodeId: string,
  kind: StageKind,
  error: unknown,
  since: Date,
): Promise<boolean> {
  const row = await prisma.episodeStage.findUnique({
    where: { episodeId_kind: { episodeId, kind } },
    select: { status: true, finishedAt: true },
  });
  const completedInThisRun =
    (row?.status === 'READY' || row?.status === 'APPROVED') && !!row.finishedAt && row.finishedAt >= since;
  if (completedInThisRun) return false;
  await failStage(episodeId, kind, error);
  return true;
}

/** Wraps a node's body with the standard GENERATING → READY/FAILED lifecycle + attempt bump. */
export async function withStage<T>(
  episodeId: string,
  kind: StageKind,
  run: (ctx: { attempt: number }) => Promise<{ result: T; output: Prisma.InputJsonValue; costEstimate?: number; providerMeta?: Prisma.InputJsonValue }>,
): Promise<T> {
  const { attempt } = await startStage(episodeId, kind);
  try {
    const { result, output, costEstimate, providerMeta } = await run({ attempt });
    await completeStage(episodeId, kind, { output, costEstimate, providerMeta });
    return result;
  } catch (err) {
    await failStage(episodeId, kind, err);
    throw err;
  }
}
