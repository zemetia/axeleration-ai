import { alignCheckpointAfterManualWrite } from '@/ai/graph/manual-authoring';
import { updateStageActivity, withStage } from '@/ai/graph/stage-io';
import type { ProjectModelConfig } from '@/providers/types';
import { episodeService, projectService } from '@/services';
import type { Prisma } from '@prisma/client';

import { formatResearchDossier, runResearchAgent } from './research-agent';

export interface RunAdditionalResearchInput {
  episodeId: string;
  projectId: string;
  /** What the user typed — the thing to go find, not a steer on how to write it up. */
  query: string;
}

/**
 * Extends the RESEARCH dossier instead of replacing it. `stageRegenerate` re-runs the stage from
 * `Episode.researchMode` and discards whatever was there; this baselines the agent against what is
 * already known (same `baseline` param `researchNode` uses) and appends whatever new findings come
 * back, so a targeted follow-up search never costs the user their existing dossier.
 */
export async function runAdditionalResearch(input: RunAdditionalResearchInput): Promise<void> {
  const { episodeId, projectId, query } = input;

  const [project, existing] = await Promise.all([
    projectService.get(projectId),
    episodeService.research(episodeId),
  ]);
  if (!project) throw new Error(`Project ${projectId} not found`);
  const modelConfig = project.modelConfig as ProjectModelConfig | undefined;
  const baseline = existing.dossier
    ? formatResearchDossier(existing.dossier)
    : existing.summary || '(nothing yet)';

  await withStage(episodeId, 'RESEARCH', async () => {
    const dossier = await runResearchAgent({
      projectId,
      goal: "Find the additional information the user asked for, to extend this episode's research dossier — not to replace it.",
      target: query,
      baseline,
      modelConfig,
      onActivity: (activity) => updateStageActivity(episodeId, 'RESEARCH', activity),
    });

    const findings = [...(existing.dossier?.findings ?? []), ...dossier.findings];
    const summary = existing.summary ? `${existing.summary}\n\n${dossier.summary}` : dossier.summary;
    const visualReferences = [...(existing.dossier?.visualReferences ?? []), ...dossier.visualReferences];

    const output = {
      mode: 'AI_CDP',
      summary,
      research: { summary, findings, visualReferences, openQuestions: dossier.openQuestions },
    } as Prisma.InputJsonValue;

    return { result: dossier, output };
  });

  // Keeps the parked LangGraph thread in sync with the merged dossier — a no-op once IDEA or later
  // has work, same as any other manual write (see `alignThread` in `episodes/actions.ts`).
  await alignCheckpointAfterManualWrite(episodeId, projectId, 'RESEARCH');
}
