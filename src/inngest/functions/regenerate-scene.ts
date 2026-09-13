import { NonRetriableError } from 'inngest';

import { regenerateEpisodeScene } from '@/ai/graph/graph';
import { aiConfig } from '@/config/ai';
import { prisma } from '@/lib/prisma';
import { notifyN8n } from '@/lib/n8n';
import { registerProviders } from '@/providers/register';

import { inngest } from '../client';
import { syncEpisodeStatus } from '../episode-status';
import { runCancel, sceneRegenerate } from '../events';

/**
 * Regenerate exactly one scene — the SCENES stage itself stays `APPROVED`/`READY`; only the
 * targeted `Scene` row (and, transitively, the graph's checkpointed `scenes` channel) changes.
 * Unlike `regenerateStage`, this never touches `Episode.status` beyond a cost/total resync — a
 * single scene redo is not a pipeline state transition.
 */
export const regenerateScene = inngest.createFunction(
  {
    id: 'regenerate-scene',
    triggers: [{ event: sceneRegenerate }],
    // One "stop" from the user has to reach every function that could still spend on this
    // episode; see `runCancel` in `../events.ts`.
    cancelOn: [{ event: runCancel, if: 'async.data.episodeId == event.data.episodeId' }],
    concurrency: { key: 'event.data.episodeId', limit: 1 },
  },
  async ({ event, step }) => {
    const { episodeId, projectId, sceneIndex, note } = event.data;

    await step.run('guard', async () => {
      const scene = await prisma.scene.findUnique({
        where: { episodeId_index: { episodeId, index: sceneIndex } },
      });
      if (scene && scene.attempt >= aiConfig.limits.maxRegenPerStage) {
        throw new NonRetriableError(
          `Scene ${sceneIndex} hit the regenerate cap (${aiConfig.limits.maxRegenPerStage})`,
        );
      }
      return null;
    });

    await step.run('run-scene', async () => {
      registerProviders();
      try {
        await regenerateEpisodeScene(episodeId, projectId, sceneIndex, note);
        return null;
      } catch (err) {
        await notifyN8n({ episodeId, projectId, status: 'SCENE_FAILED' });
        throw new NonRetriableError(
          `Regenerating scene ${sceneIndex} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });

    const status = await step.run('sync-status', () => syncEpisodeStatus(episodeId));
    return { episodeId, sceneIndex, status };
  },
);
