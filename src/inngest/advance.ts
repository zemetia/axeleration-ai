import { NonRetriableError } from 'inngest';

import { prisma } from '@/lib/prisma';
import { notifyN8n } from '@/lib/n8n';
import { registerProviders } from '@/providers/register';
import type { StageKind } from '@prisma/client';

import { markEpisodeFailed } from './episode-status';
import { advanceContinuity } from './finalize';

/**
 * Accepting one stage and letting the graph run the next one — the single operation behind both
 * the Approve button (`resume-stage.ts`) and auto-pilot (`autopilot.ts`).
 *
 * It lives here rather than in either caller because the two must not drift: auto-pilot is
 * literally "press Approve for me", and a second implementation of what Approve means is a second
 * place for the checkpoint semantics to go wrong.
 */

export interface ApprovalContext {
  projectId: string;
  /** True when the stage was not READY — a double click, a replayed event, or auto-pilot racing the UI. */
  alreadyHandled: boolean;
}

/**
 * Flips a READY stage to APPROVED, and reports whether this call is the one that did it.
 * Approving twice must not advance the graph twice, so the status check and the write are one step.
 */
export async function markStageApproved(
  episodeId: string,
  stage: StageKind,
): Promise<ApprovalContext> {
  const row = await prisma.episodeStage.findUnique({
    where: { episodeId_kind: { episodeId, kind: stage } },
    include: { episode: { select: { projectId: true } } },
  });
  if (!row) throw new NonRetriableError(`Stage ${stage} not found on episode ${episodeId}`);

  if (row.status !== 'READY') return { projectId: row.episode.projectId, alreadyHandled: true };

  await prisma.episodeStage.update({
    where: { episodeId_kind: { episodeId, kind: stage } },
    data: { status: 'APPROVED' },
  });
  return { projectId: row.episode.projectId, alreadyHandled: false };
}

/**
 * Resumes the parked LangGraph thread so the next node runs and parks again. Throws
 * `NonRetriableError` on failure: the provider work up to this point is already billed, so a retry
 * would pay for it twice.
 */
export async function resumeAfterStage(
  episodeId: string,
  projectId: string,
  stage: StageKind,
): Promise<void> {
  const { resumeEpisodeGraph } = await import('@/ai/graph/graph');
  registerProviders();
  try {
    // The stage is passed so a forked thread (several nodes queued by an older run) resumes at this
    // stage's successor instead of running every queued node at once — see `resumeEpisodeGraph`.
    await resumeEpisodeGraph(episodeId, stage);
  } catch (err) {
    await markEpisodeFailed(episodeId);
    await notifyN8n({ episodeId, projectId, status: 'FAILED' });
    throw new NonRetriableError(
      `Resuming after ${stage} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * RENDER is the last stage, and approving it runs the thread to END. The video already exists at
 * that point, so a failing continuity summary must not fail the episode.
 */
export async function finalizeIfLastStage(episodeId: string, stage: StageKind): Promise<void> {
  if (stage !== 'RENDER') return;
  try {
    await advanceContinuity(episodeId);
  } catch (err) {
    console.error(`[pipeline] continuity update failed for episode ${episodeId}:`, err);
  }
}
