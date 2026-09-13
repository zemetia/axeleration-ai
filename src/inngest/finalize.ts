import { runContinuityChain } from '@/ai/continuity/continuity-chain';
import { prisma } from '@/lib/prisma';
import type { ProjectModelConfig } from '@/providers/types';
import { contextService } from '@/services';

/**
 * What happens once an episode's RENDER is approved: the series memory advances so the *next*
 * episode's IDEA stage knows what already happened. This is the loop that makes the show serialized
 * rather than a pile of unrelated clips.
 */

function textOf(output: unknown, key: string): string {
  const value = (output as Record<string, unknown> | null)?.[key];
  return typeof value === 'string' ? value : '';
}

export async function advanceContinuity(episodeId: string): Promise<{ updated: boolean; summary?: string }> {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: { stages: true, project: { select: { id: true, modelConfig: true } } },
  });
  if (!episode) return { updated: false };

  const idea = textOf(episode.stages.find((stage) => stage.kind === 'IDEA')?.output, 'idea');
  const logline = textOf(episode.stages.find((stage) => stage.kind === 'SCRIPT')?.output, 'logline');
  const episodeEvents = [idea, logline].filter(Boolean).join('\n\n');
  if (!episodeEvents) return { updated: false };

  const previous = await contextService.getContinuityState(episode.project.id);
  const summary = await runContinuityChain({
    projectId: episode.project.id,
    project: (episode.project.modelConfig as ProjectModelConfig | null) ?? undefined,
    previousSummary: previous.summary,
    episodeNumber: episode.number,
    episodeEvents,
  });

  await contextService.updateContinuitySummary(episode.project.id, summary, episode.number);
  return { updated: true, summary };
}
