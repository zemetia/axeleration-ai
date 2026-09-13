import { prisma } from '@/lib/prisma';
import type { EpisodeStageVO } from '@/types/value-objects';
import type { StageKind } from '@prisma/client';

const STAGE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  GENERATING: 'Generating',
  READY: 'Ready',
  APPROVED: 'Approved',
  FAILED: 'Failed',
};

export const generationService = {
  async stageOutput(episodeId: string, kind: StageKind): Promise<EpisodeStageVO | null> {
    const stage = await prisma.episodeStage.findUnique({ where: { episodeId_kind: { episodeId, kind } } });
    if (!stage) return null;
    return {
      id: stage.id,
      kind: stage.kind,
      status: stage.status,
      statusLabel: STAGE_STATUS_LABELS[stage.status] ?? stage.status,
      attempt: stage.attempt,
      output: (stage.output as Record<string, unknown> | null) ?? null,
      error: stage.error,
      costEstimate: stage.costEstimate ? Number(stage.costEstimate) : null,
      providerMeta: (stage.providerMeta as Record<string, unknown> | null) ?? null,
      startedAt: stage.startedAt ? stage.startedAt.toISOString() : null,
      finishedAt: stage.finishedAt ? stage.finishedAt.toISOString() : null,
    };
  },

  /** Sums each stage's cost estimate for the episode — the "why is my bill this size" read helper. */
  async cost(episodeId: string): Promise<number> {
    const stages = await prisma.episodeStage.findMany({
      where: { episodeId },
      select: { costEstimate: true },
    });
    return stages.reduce((sum, stage) => sum + (stage.costEstimate ? Number(stage.costEstimate) : 0), 0);
  },
};
