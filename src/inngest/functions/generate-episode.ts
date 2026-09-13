import { NonRetriableError } from 'inngest';

import { runEpisodeGraph } from '@/ai/graph/graph';
import { prisma } from '@/lib/prisma';
import { notifyN8n } from '@/lib/n8n';
import { registerProviders } from '@/providers/register';

import { inngest } from '../client';
import { isTerminalStatus, markEpisodeFailed, syncEpisodeStatus } from '../episode-status';
import { episodeGenerate, runCancel } from '../events';

/**
 * Entry point of the pipeline: runs the episode graph until its first interrupt (after IDEA),
 * then returns. The run is durably parked — approval events resume the same LangGraph thread.
 *
 * Concurrency is capped at one episode per project so two runs can't fight over the same
 * continuity state or burn the project's rate limit in parallel.
 */
export const generateEpisode = inngest.createFunction(
  {
    id: 'generate-episode',
    triggers: [{ event: episodeGenerate }],
    // One "stop" from the user has to reach every function that could still spend on this
    // episode; see `runCancel` in `../events.ts`.
    cancelOn: [{ event: runCancel, if: 'async.data.episodeId == event.data.episodeId' }],
    concurrency: { key: 'event.data.projectId', limit: 1 },
  },
  async ({ event, step }) => {
    const { episodeId, projectId } = event.data;

    await step.run('mark-generating', async () => {
      await prisma.episode.update({
        where: { id: episodeId },
        data: { status: 'GENERATING', graphThreadId: episodeId },
      });
      return null;
    });

    await step.run('run-graph', async () => {
      registerProviders();
      try {
        await runEpisodeGraph(episodeId, projectId);
        return null;
      } catch (err) {
        // The failing node already marked its own stage FAILED (see `withStage`).
        await markEpisodeFailed(episodeId);
        await notifyN8n({ episodeId, projectId, status: 'FAILED' });
        // Never auto-retry: the provider work up to this point is already billed.
        // Regenerate is the recovery path (T07 §5).
        throw new NonRetriableError(
          `Episode graph failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });

    const status = await step.run('sync-status', () => syncEpisodeStatus(episodeId));

    if (isTerminalStatus(status)) {
      await step.run('notify', () => notifyN8n({ episodeId, projectId, status }));
    }

    return { episodeId, status };
  },
);
