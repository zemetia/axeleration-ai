import { prisma } from '@/lib/prisma';
import type { EpisodeStatus, EpisodeStage } from '@prisma/client';

/**
 * The episode row is a *rollup* of its stage rows — stages are the source of truth (T07 §4).
 * Recomputing it from scratch after every graph invocation keeps the two from drifting, and makes
 * the write idempotent when Inngest replays a step.
 */

export function rollupStatus(stages: Pick<EpisodeStage, 'kind' | 'status'>[]): EpisodeStatus {
  if (stages.some((stage) => stage.status === 'FAILED')) return 'FAILED';

  const render = stages.find((stage) => stage.kind === 'RENDER');
  if (render?.status === 'APPROVED') return 'DONE';
  if (render?.status === 'READY') return 'READY_FOR_REVIEW';

  return 'GENERATING';
}

export function sumCost(stages: Pick<EpisodeStage, 'costEstimate'>[]): number {
  return stages.reduce((total, stage) => total + (stage.costEstimate ? Number(stage.costEstimate) : 0), 0);
}

/** RENDER's output carries the assembled video; surfacing it on the episode is what the UI reads. */
export function finalVideoUrlOf(stages: Pick<EpisodeStage, 'kind' | 'output'>[]): string | null {
  const render = stages.find((stage) => stage.kind === 'RENDER');
  const output = render?.output as { url?: unknown } | null;
  return typeof output?.url === 'string' ? output.url : null;
}

/** Recomputes status/cost/final video from the stage rows. Returns the status it settled on. */
export async function syncEpisodeStatus(episodeId: string): Promise<EpisodeStatus> {
  const stages = await prisma.episodeStage.findMany({ where: { episodeId } });
  const status = rollupStatus(stages);

  await prisma.episode.update({
    where: { id: episodeId },
    data: {
      status,
      totalCost: sumCost(stages),
      finalVideoUrl: finalVideoUrlOf(stages),
    },
  });

  return status;
}

export async function markEpisodeFailed(episodeId: string): Promise<void> {
  await prisma.episode.update({ where: { id: episodeId }, data: { status: 'FAILED' } });
}

/** Terminal states are the ones worth telling an external automation about. */
export function isTerminalStatus(status: EpisodeStatus): boolean {
  return status === 'READY_FOR_REVIEW' || status === 'DONE' || status === 'FAILED';
}
