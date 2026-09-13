import { ideaResearchPrompt } from '@/ai/prompts/idea-research.prompt';
import { formatResearchDossier, runResearchAgent } from '@/ai/research/research-agent';
import { getChatModel } from '@/ai/router/model-router';
import { contextService, episodeService, projectService } from '@/services';
import type { ProjectModelConfig } from '@/providers/types';
import type { Prisma } from '@prisma/client';

import { updateStageActivity, withStage } from '../stage-io';
import type { EpisodeGraphState, EpisodeGraphUpdate } from '../state';

/**
 * Optional stage before IDEA — sources context for the idea-writer from one of four modes
 * (`Episode.researchMode`, defaulted from `Project.defaultResearchMode`):
 *  - HUMAN: the user's own pasted notes, no LLM call.
 *  - AI_REASONING: a plain brainstorm from premise + continuity, no web access.
 *  - AI_CDP: the agentic web-research loop (src/ai/research/research-agent.ts), same engine the
 *    SCENES stage uses to ground scene visuals, but aimed at seeding the idea itself here.
 *  - SKIP: completes immediately with empty output — IDEA proceeds exactly as it did before this stage existed.
 */
export async function researchNode(state: EpisodeGraphState): Promise<EpisodeGraphUpdate> {
  const { episodeId, projectId } = state;

  const researchContext = await withStage(episodeId, 'RESEARCH', async () => {
    const [project, episode, continuity] = await Promise.all([
      projectService.get(projectId),
      episodeService.get(episodeId),
      contextService.getContinuityState(projectId),
    ]);
    if (!project) throw new Error(`Project ${projectId} not found`);
    if (!episode) throw new Error(`Episode ${episodeId} not found`);
    const modelConfig = project.modelConfig as ProjectModelConfig | undefined;
    const continuitySummary = continuity.summary || '(none — this is the first episode)';

    if (episode.researchMode === 'SKIP') {
      return { result: '', output: { mode: 'SKIP' } as Prisma.InputJsonValue };
    }

    if (episode.researchMode === 'HUMAN') {
      const notes = episode.researchNotes?.trim() ?? '';
      return { result: notes, output: { mode: 'HUMAN', summary: notes } as Prisma.InputJsonValue };
    }

    if (episode.researchMode === 'AI_REASONING') {
      const model = await getChatModel('idea-research', { projectId, project: modelConfig });
      const response = await ideaResearchPrompt.pipe(model).invoke({
        premise: project.premise,
        projectType: project.typeLabel,
        continuitySummary,
        episodeNumber: episode.number,
      });
      const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
      return { result: text.trim(), output: { mode: 'AI_REASONING', summary: text.trim() } as Prisma.InputJsonValue };
    }

    // AI_CDP
    try {
      const dossier = await runResearchAgent({
        projectId,
        goal: "Find current, real information to seed and ground this episode's idea before it's written.",
        target: `Series premise: ${project.premise}\n\nThis is episode ${episode.number}.`,
        baseline: `Continuity so far: ${continuitySummary}`,
        modelConfig,
        onActivity: (activity) => updateStageActivity(episodeId, 'RESEARCH', activity),
      });
      const formatted = formatResearchDossier(dossier);
      return {
        result: formatted,
        output: { mode: 'AI_CDP', summary: dossier.summary, research: dossier } as unknown as Prisma.InputJsonValue,
      };
    } catch (err) {
      console.error('[research] AI_CDP mode skipped — agent could not complete (is local Chrome running with a debug port?):', err);
      return { result: '', output: { mode: 'AI_CDP', summary: '', error: 'unreachable' } as Prisma.InputJsonValue };
    }
  });

  return { researchContext, regenerateNote: '' };
}
