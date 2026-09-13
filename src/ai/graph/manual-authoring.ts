import type { StageKind } from '@prisma/client';

import { episodeService } from '@/services/episode.service';

import { getEpisodeGraph } from './graph';
import type { EpisodeGraphState } from './state';

/** The stages a user can author by hand in the Idea room. */
export type ManualStageKind = Extract<StageKind, 'RESEARCH' | 'IDEA' | 'SCRIPT'>;

/**
 * Which node the manual write is attributed to — normally the stage itself, since `asNode` rewinds
 * `next` to that node's *successor* and the successor is the stage after it.
 *
 * IDEA is the exception. Its successor is `IDEA_CRITIC`, not SCRIPT, so attributing a hand-written
 * idea to `'IDEA'` would leave the thread pointing at the critic and cost the user a second Approve
 * click to get anywhere. Attributing it to `'IDEA_CRITIC'` lands `next` on SCRIPT, which is exactly
 * where writing an idea by hand used to leave it.
 */
const ALIGN_AS_NODE: Record<ManualStageKind, string> = {
  RESEARCH: 'RESEARCH',
  IDEA: 'IDEA_CRITIC',
  SCRIPT: 'SCRIPT',
};

/**
 * Tells the parked thread that a stage's work is already done, so the next Approve *advances past*
 * the node instead of running it and overwriting what the user typed.
 *
 * Without this, writing IDEA by hand and pressing Approve resumes a thread whose `next` is still
 * `['IDEA']`: `ideaNode` runs, `completeStage` writes the model's text over the user's, and the
 * manual version is gone with no trace.
 *
 * Attributing the update with `asNode` (the T12 pattern from `regenerateEpisodeScene`) rewinds
 * `next` to that node's successor — correct while the stage is the frontier, destructive once a
 * later stage has produced output. Hence the downstream guard: past the frontier the DB-preference
 * reads in `scriptNode` / `voiceNode` / `scenesNode` are what carry a manual edit forward instead.
 */
export async function alignCheckpointAfterManualWrite(
  episodeId: string,
  projectId: string,
  kind: ManualStageKind,
): Promise<'aligned' | 'skipped'> {
  // Callers that can reach `episodeService` cheaply should ask this *before* importing this module —
  // see `alignThread` in the episodes actions. Repeated here because the MCP server calls in directly.
  if (await episodeService.hasDownstreamWork(episodeId, kind)) return 'skipped';

  const graph = await getEpisodeGraph();
  const config = { configurable: { thread_id: episodeId } };

  // Deliberately no "does the thread exist yet" check. An episode written entirely by hand was
  // never generated, so it has no checkpoint at all — and that is the case that most needs
  // aligning: resuming a thread with no checkpoint restarts the graph from START and regenerates
  // the very stages the user just typed. `updateState` creates the thread when it is missing.
  const values: Partial<EpisodeGraphState> = { episodeId, projectId };
  if (kind === 'RESEARCH') {
    const research = await episodeService.research(episodeId);
    // Lazy: the research agent module carries the browser/CDP stack, and only this branch needs it.
    const { formatResearchDossier } = await import('@/ai/research/research-agent');
    values.researchContext = research.dossier ? formatResearchDossier(research.dossier) : research.summary;
  }
  if (kind === 'IDEA') {
    values.idea = (await episodeService.idea(episodeId)) ?? '';
  }
  if (kind === 'SCRIPT') {
    const script = await episodeService.script(episodeId);
    // `script()` is null until at least one beat exists; the `script` channel must hold a valid
    // breakdown, so an empty draft is left for a later write to align.
    if (!script) return 'skipped';
    values.script = script;
  }

  await graph.updateState(config, values, ALIGN_AS_NODE[kind]);
  return 'aligned';
}
