import { NonRetriableError } from 'inngest';

import { refineEpisodeScript } from '@/ai/graph/graph';
import { failStageUnlessCompletedSince } from '@/ai/graph/stage-io';
import { aiConfig } from '@/config/ai';
import { prisma } from '@/lib/prisma';
import { notifyN8n } from '@/lib/n8n';
import { registerProviders } from '@/providers/register';

import { inngest } from '../client';
import { isTerminalStatus, markEpisodeFailed, syncEpisodeStatus } from '../episode-status';
import { runCancel, scriptRefine } from '../events';

/**
 * Refine → re-run SCRIPT with `scriptMode: 'refine'`, so the node revises the stored breakdown
 * instead of cutting a new one. Mechanically the same shape as `refine-idea`, and subject to the
 * same `attempt` cap: a refine still bumps `attempt` through `withStage` and still bills a model
 * call.
 */
export const refineScript = inngest.createFunction(
  {
    id: 'refine-script',
    triggers: [{ event: scriptRefine }],
    // One "stop" from the user has to reach every function that could still spend on this
    // episode; see `runCancel` in `../events.ts`.
    cancelOn: [{ event: runCancel, if: 'async.data.episodeId == event.data.episodeId' }],
    concurrency: { key: 'event.data.episodeId', limit: 1 },
  },
  async ({ event, step }) => {
    const { episodeId, note } = event.data;

    const context = await step.run('guard', async () => {
      const row = await prisma.episodeStage.findUnique({
        where: { episodeId_kind: { episodeId, kind: 'SCRIPT' } },
        include: { episode: { select: { projectId: true } } },
      });
      if (!row) throw new NonRetriableError(`Stage SCRIPT not found on episode ${episodeId}`);
      if (row.attempt >= aiConfig.limits.maxRegenPerStage) {
        throw new NonRetriableError(
          `Stage SCRIPT hit the regenerate cap (${aiConfig.limits.maxRegenPerStage})`,
        );
      }
      return { projectId: row.episode.projectId };
    });

    await step.run('run-graph', async () => {
      registerProviders();
      const runStartedAt = new Date();
      try {
        await refineEpisodeScript(episodeId, context.projectId, note);
        return null;
      } catch (err) {
        // Same reasoning as `regenerate-stage`: a failure thrown before `scriptNode`'s `withStage`
        // runs never touches the SCRIPT row, so without this the breakdown just looks unchanged.
        // The `Since` half is what this exact path taught us: a completed refine was being stamped
        // with a stale MUSIC task's provider 401, over a valid script output.
        await failStageUnlessCompletedSince(episodeId, 'SCRIPT', err, runStartedAt);
        await markEpisodeFailed(episodeId);
        await notifyN8n({ episodeId, projectId: context.projectId, status: 'FAILED' });
        throw new NonRetriableError(
          `Refining the script failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });

    const status = await step.run('sync-status', () => syncEpisodeStatus(episodeId));

    if (isTerminalStatus(status)) {
      await step.run('notify', () => notifyN8n({ episodeId, projectId: context.projectId, status }));
    }

    return { episodeId, stage: 'SCRIPT', status };
  },
);
