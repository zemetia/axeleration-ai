import { NonRetriableError } from 'inngest';

import { refineEpisodeIdea } from '@/ai/graph/graph';
import { failStageUnlessCompletedSince } from '@/ai/graph/stage-io';
import { aiConfig } from '@/config/ai';
import { prisma } from '@/lib/prisma';
import { notifyN8n } from '@/lib/n8n';
import { registerProviders } from '@/providers/register';

import { inngest } from '../client';
import { isTerminalStatus, markEpisodeFailed, syncEpisodeStatus } from '../episode-status';
import { ideaRefine, runCancel } from '../events';

/**
 * Refine → re-run IDEA with `ideaMode: 'refine'`, so the node revises the stored idea instead of
 * replacing it. Mechanically the same shape as `regenerate-stage`, and deliberately subject to the
 * same `attempt` cap: a refine still bumps `attempt` through `withStage` and still bills a model
 * call, so exempting it would turn "improve this a bit" into the uncapped spend loop the cap exists
 * to prevent.
 */
export const refineIdea = inngest.createFunction(
  {
    id: 'refine-idea',
    triggers: [{ event: ideaRefine }],
    // One "stop" from the user has to reach every function that could still spend on this
    // episode; see `runCancel` in `../events.ts`.
    cancelOn: [{ event: runCancel, if: 'async.data.episodeId == event.data.episodeId' }],
    concurrency: { key: 'event.data.episodeId', limit: 1 },
  },
  async ({ event, step }) => {
    const { episodeId, note } = event.data;

    const context = await step.run('guard', async () => {
      const row = await prisma.episodeStage.findUnique({
        where: { episodeId_kind: { episodeId, kind: 'IDEA' } },
        include: { episode: { select: { projectId: true } } },
      });
      if (!row) throw new NonRetriableError(`Stage IDEA not found on episode ${episodeId}`);
      if (row.attempt >= aiConfig.limits.maxRegenPerStage) {
        throw new NonRetriableError(
          `Stage IDEA hit the regenerate cap (${aiConfig.limits.maxRegenPerStage})`,
        );
      }
      return { projectId: row.episode.projectId };
    });

    await step.run('run-graph', async () => {
      registerProviders();
      const runStartedAt = new Date();
      try {
        await refineEpisodeIdea(episodeId, context.projectId, note);
        return null;
      } catch (err) {
        // Same reasoning as `regenerate-stage`: a failure thrown before `ideaNode`'s `withStage`
        // runs never touches the IDEA row, so without this the idea just looks unchanged forever —
        // and, past that point, a refine that succeeded must not be relabelled with someone else's
        // error.
        await failStageUnlessCompletedSince(episodeId, 'IDEA', err, runStartedAt);
        await markEpisodeFailed(episodeId);
        await notifyN8n({ episodeId, projectId: context.projectId, status: 'FAILED' });
        throw new NonRetriableError(
          `Refining the idea failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });

    const status = await step.run('sync-status', () => syncEpisodeStatus(episodeId));

    if (isTerminalStatus(status)) {
      await step.run('notify', () => notifyN8n({ episodeId, projectId: context.projectId, status }));
    }

    return { episodeId, stage: 'IDEA', status };
  },
);
