import { episodeService } from '@/services';
import type { Prisma } from '@prisma/client';

import { withStage } from '../stage-io';
import type { EpisodeGraphState, EpisodeGraphUpdate } from '../state';

/**
 * BREAKDOWN — cuts the screenplay into per-scene beats.
 *
 * **Stub, deliberately.** SCRIPT still produces a complete `SceneBreakdown`, so this node's only job
 * today is to pass it through and declare the stage finished: no LLM call, no cost. That is what
 * makes T15 behaviour-neutral — the pipeline gains a stage and a park point without changing a
 * single thing it produces, and every downstream reader (`scenesNode`, `regenerateEpisodeScene`,
 * `updateSceneSpec`) keeps working against the same shape it always has.
 *
 * T17 replaces the body: SCRIPT starts emitting prose on the `screenplay` channel, and this node
 * becomes the LLM step that cuts it up — reading the screenplay, validating that every `@handle` it
 * copies actually appears there, and writing the `SceneBreakdown` itself.
 */
export async function breakdownNode(state: EpisodeGraphState): Promise<EpisodeGraphUpdate> {
  const { episodeId } = state;

  const script = await withStage(episodeId, 'BREAKDOWN', async () => {
    // DB before channel, the same precedence every other node uses: the stored SCRIPT output is
    // where a user's hand-edited beats live, and the channel is only a mirror of the last run.
    const stored = (await episodeService.script(episodeId)) ?? state.script;
    if (!stored) throw new Error('breakdownNode requires a script (SCRIPT stage must run first)');
    return { result: stored, output: stored as unknown as Prisma.InputJsonValue };
  });

  return { script, regenerateNote: '' };
}
