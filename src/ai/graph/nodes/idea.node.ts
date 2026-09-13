import type { IdeaCritique } from '@/ai/prompts/idea-critic.schema';
import { ideaPrompt } from '@/ai/prompts/idea.prompt';
import { buildProjectBrief } from '@/ai/prompts/project-brief';
import { refineIdeaPrompt } from '@/ai/prompts/refine-idea.prompt';
import { formatResearchDossier } from '@/ai/research/research-agent';
import { getChatModel } from '@/ai/router/model-router';
import { buildAssetRoster } from '@/assets/roster';
import { deriveEpisodeTitle } from '@/services/episode.service';
import { assetService, contextService, episodeService, projectService } from '@/services';
import type { ProjectModelConfig } from '@/providers/types';

import { withStage } from '../stage-io';
import type { EpisodeGraphState, EpisodeGraphUpdate, IdeaMode } from '../state';

/**
 * The critic's objections, as prose the refine prompt can act on. Lives here rather than beside the
 * type because `idea-critic.schema.ts` belongs to T19 — this reads the shape, it does not define it.
 *
 * Returns "(none)" for the stub critic's empty verdict, which is also what a first refine sees.
 */
function formatCritique(critique: IdeaCritique | undefined): string {
  if (!critique) return '(none)';
  const weaknesses = critique.weaknesses.map((entry) => `- ${entry.axis}: ${entry.detail}`);
  const questions = critique.openQuestions.map((question) => `- unanswered: ${question}`);
  const lines = [...weaknesses, ...questions];
  return lines.length > 0 ? lines.join('\n') : '(none)';
}

export async function ideaNode(state: EpisodeGraphState): Promise<EpisodeGraphUpdate> {
  const { episodeId, projectId } = state;

  // Refine needs something to refine. The stored row wins over the channel — same DB-before-channel
  // precedence as every other node — so a hand-edited idea is what gets revised, not the last
  // generated one. Nothing stored means the button was pressed in a state where it has no meaning,
  // which is a UI condition to recover from, not a pipeline failure: fall through to a fresh write.
  const currentIdea =
    state.ideaMode === 'refine' ? ((await episodeService.idea(episodeId)) ?? state.idea ?? '').trim() : '';
  const mode: IdeaMode = state.ideaMode === 'refine' && currentIdea ? 'refine' : 'fresh';

  const idea = await withStage(episodeId, 'IDEA', async () => {
    const [project, episode, continuity, research, assets] = await Promise.all([
      projectService.get(projectId),
      episodeService.get(episodeId),
      contextService.getContinuityState(projectId),
      episodeService.research(episodeId),
      assetService.list(projectId),
    ]);
    if (!project) throw new Error(`Project ${projectId} not found`);
    if (!episode) throw new Error(`Episode ${episodeId} not found`);

    // The stored RESEARCH output is preferred over the checkpointed channel so notes the user
    // typed or corrected in the Idea room actually reach the prompt.
    const researchContext = research.dossier
      ? formatResearchDossier(research.dossier)
      : research.summary || state.researchContext || '(none)';

    const shared = {
      premise: project.premise,
      projectType: project.typeLabel,
      brief: buildProjectBrief(project),
      continuitySummary: continuity.summary || '(none — this is the first episode)',
      assetRoster: buildAssetRoster(assets, { compact: true }),
      researchContext,
      episodeNumber: episode.number,
    };

    const model = await getChatModel('idea', { projectId, project: project.modelConfig as ProjectModelConfig | undefined });
    const response =
      mode === 'refine'
        ? await refineIdeaPrompt.pipe(model).invoke({
            ...shared,
            currentIdea,
            userNote: state.regenerateNote || '(none)',
            critique: formatCritique(state.ideaCritique),
          })
        : await ideaPrompt.pipe(model).invoke({
            ...shared,
            revisionNote: state.regenerateNote || '(none)',
          });
    const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

    // `mode` rides along in the output so the room can tell a revision from a rewrite after the
    // fact — `attempt` alone counts runs without saying what kind they were.
    return { result: text.trim(), output: { idea: text.trim(), mode } };
  });

  // Best-effort — a title backfill failure must never fail the IDEA stage itself.
  // `setTitleIfEmpty` is what stops a refine from renaming an episode the user already named.
  try {
    await episodeService.setTitleIfEmpty(episodeId, deriveEpisodeTitle(idea));
  } catch (err) {
    console.error(`[pipeline] title backfill failed for episode ${episodeId}:`, err);
  }

  // Reset to `'fresh'`, same consume-and-clear contract as `regenerateNote` and `sceneScope`: a
  // refine requested once must not turn the next Regenerate into another refine.
  return { idea, ideaMode: 'fresh', regenerateNote: '' };
}
