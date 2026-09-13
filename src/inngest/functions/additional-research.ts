import { NonRetriableError } from 'inngest';

import { runAdditionalResearch } from '@/ai/research/additional-research';
import { aiConfig } from '@/config/ai';
import { prisma } from '@/lib/prisma';
import { notifyN8n } from '@/lib/n8n';
import { registerProviders } from '@/providers/register';

import { inngest } from '../client';
import { isTerminalStatus, markEpisodeFailed, syncEpisodeStatus } from '../episode-status';
import { researchAdditional, runCancel } from '../events';

/**
 * Additive research → search for whatever the user typed and append the result to the RESEARCH
 * dossier. Same guard/cap and GENERATING/READY lifecycle as `regenerateStage`, but the merge
 * itself (baseline + append, not overwrite) lives in `runAdditionalResearch`.
 */
export const additionalResearch = inngest.createFunction(
  {
    id: 'additional-research',
    triggers: [{ event: researchAdditional }],
    // One "stop" from the user has to reach every function that could still spend on this
    // episode; see `runCancel` in `../events.ts`.
    cancelOn: [{ event: runCancel, if: 'async.data.episodeId == event.data.episodeId' }],
    concurrency: { key: 'event.data.episodeId', limit: 1 },
  },
  async ({ event, step }) => {
    const { episodeId, query } = event.data;

    const context = await step.run('guard', async () => {
      const row = await prisma.episodeStage.findUnique({
        where: { episodeId_kind: { episodeId, kind: 'RESEARCH' } },
        include: { episode: { select: { projectId: true } } },
      });
      if (!row) throw new NonRetriableError(`RESEARCH stage not found on episode ${episodeId}`);
      if (row.attempt >= aiConfig.limits.maxRegenPerStage) {
        throw new NonRetriableError(
          `Stage RESEARCH hit the regenerate cap (${aiConfig.limits.maxRegenPerStage})`,
        );
      }
      return { projectId: row.episode.projectId };
    });

    await step.run('run-research', async () => {
      registerProviders();
      try {
        await runAdditionalResearch({ episodeId, projectId: context.projectId, query });
        return null;
      } catch (err) {
        await markEpisodeFailed(episodeId);
        await notifyN8n({ episodeId, projectId: context.projectId, status: 'FAILED' });
        throw new NonRetriableError(
          `Additional research failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });

    const status = await step.run('sync-status', () => syncEpisodeStatus(episodeId));

    if (isTerminalStatus(status)) {
      await step.run('notify', () => notifyN8n({ episodeId, projectId: context.projectId, status }));
    }

    return { episodeId, stage: 'RESEARCH', status };
  },
);
