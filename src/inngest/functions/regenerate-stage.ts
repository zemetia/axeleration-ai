import { NonRetriableError } from 'inngest';

import { regenerateEpisodeStage } from '@/ai/graph/graph';
import { failStageUnlessCompletedSince } from '@/ai/graph/stage-io';
import { aiConfig } from '@/config/ai';
import { prisma } from '@/lib/prisma';
import { notifyN8n } from '@/lib/n8n';
import { registerProviders } from '@/providers/register';

import { inngest } from '../client';
import { isTerminalStatus, markEpisodeFailed, syncEpisodeStatus } from '../episode-status';
import { runCancel, stageRegenerate } from '../events';

/**
 * Regenerate → re-run one node in place. The graph jumps straight to that stage's node, which
 * bumps `attempt` via `withStage`, then re-parks at the same interrupt. Downstream stages keep
 * their old rows until the user approves forward again.
 */
export const regenerateStage = inngest.createFunction(
  {
    id: 'regenerate-stage',
    triggers: [{ event: stageRegenerate }],
    // One "stop" from the user has to reach every function that could still spend on this
    // episode; see `runCancel` in `../events.ts`.
    cancelOn: [{ event: runCancel, if: 'async.data.episodeId == event.data.episodeId' }],
    concurrency: { key: 'event.data.episodeId', limit: 1 },
  },
  async ({ event, step }) => {
    const { episodeId, stage, note, scope } = event.data;

    const context = await step.run('guard', async () => {
      const row = await prisma.episodeStage.findUnique({
        where: { episodeId_kind: { episodeId, kind: stage } },
        include: { episode: { select: { projectId: true } } },
      });
      if (!row) throw new NonRetriableError(`Stage ${stage} not found on episode ${episodeId}`);
      if (row.attempt >= aiConfig.limits.maxRegenPerStage) {
        throw new NonRetriableError(
          `Stage ${stage} hit the regenerate cap (${aiConfig.limits.maxRegenPerStage})`,
        );
      }
      return { projectId: row.episode.projectId };
    });

    await step.run('run-graph', async () => {
      registerProviders();
      const runStartedAt = new Date();
      try {
        await regenerateEpisodeStage(episodeId, context.projectId, stage, note, scope ?? 'all');
        return null;
      } catch (err) {
        // A failure thrown before the node's own `withStage` runs (e.g. the graph-version guard)
        // never touches the stage row, so without this the UI has nothing to show: the stage stays
        // READY with its old output and the client polls forever for an `attempt` that never moves.
        // `UnlessCompletedSince` is what keeps it from blaming this stage for another node's error
        // once it has produced a good output of its own.
        await failStageUnlessCompletedSince(episodeId, stage, err, runStartedAt);
        await markEpisodeFailed(episodeId);
        await notifyN8n({ episodeId, projectId: context.projectId, status: 'FAILED' });
        throw new NonRetriableError(
          `Regenerating ${stage} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });

    const status = await step.run('sync-status', () => syncEpisodeStatus(episodeId));

    if (isTerminalStatus(status)) {
      await step.run('notify', () =>
        notifyN8n({ episodeId, projectId: context.projectId, status }),
      );
    }

    return { episodeId, stage, status };
  },
);
