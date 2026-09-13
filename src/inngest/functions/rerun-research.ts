import { NonRetriableError } from 'inngest';

import { regenerateEpisodeStage } from '@/ai/graph/graph';
import { failStageUnlessCompletedSince } from '@/ai/graph/stage-io';
import { aiConfig } from '@/config/ai';
import { prisma } from '@/lib/prisma';
import { notifyN8n } from '@/lib/n8n';
import { registerProviders } from '@/providers/register';

import { inngest } from '../client';
import { isTerminalStatus, markEpisodeFailed, syncEpisodeStatus } from '../episode-status';
import { ideaRerunResearch, runCancel } from '../events';

/**
 * Re-research → run RESEARCH again, then write a new idea from what it found.
 *
 * One function rather than two events, because the halves are only correct together. Fresh research
 * sitting above the idea it was meant to replace is the worst of the three outcomes: nothing on the
 * page says the two no longer describe each other, and the next Approve carries the stale idea into
 * SCRIPT. Both stages are separate `step.run`s, so an Inngest retry resumes at the failed half
 * instead of paying for the research twice.
 */
export const rerunResearch = inngest.createFunction(
  {
    id: 'rerun-research',
    triggers: [{ event: ideaRerunResearch }],
    // One "stop" from the user has to reach every function that could still spend on this
    // episode; see `runCancel` in `../events.ts`.
    cancelOn: [{ event: runCancel, if: 'async.data.episodeId == event.data.episodeId' }],
    concurrency: { key: 'event.data.episodeId', limit: 1 },
  },
  async ({ event, step }) => {
    const { episodeId, note } = event.data;

    // Both caps are checked up front. Checking IDEA's only after the research has run would spend
    // on a dossier the idea stage is then not allowed to consume.
    const context = await step.run('guard', async () => {
      const rows = await prisma.episodeStage.findMany({
        where: { episodeId, kind: { in: ['RESEARCH', 'IDEA'] } },
        include: { episode: { select: { projectId: true } } },
      });
      const capped = rows.find((row) => row.attempt >= aiConfig.limits.maxRegenPerStage);
      if (rows.length < 2) {
        throw new NonRetriableError(`Episode ${episodeId} is missing its RESEARCH or IDEA stage`);
      }
      if (capped) {
        throw new NonRetriableError(
          `Stage ${capped.kind} hit the regenerate cap (${aiConfig.limits.maxRegenPerStage})`,
        );
      }
      const projectId = rows[0]?.episode.projectId;
      if (!projectId) throw new NonRetriableError(`Episode ${episodeId} not found`);
      return { projectId };
    });

    async function runStage(kind: 'RESEARCH' | 'IDEA', stageNote?: string) {
      registerProviders();
      const runStartedAt = new Date();
      try {
        await regenerateEpisodeStage(episodeId, context.projectId, kind, stageNote);
        return null;
      } catch (err) {
        // Same reasoning as `regenerate-stage`: a failure thrown before the node's own `withStage`
        // runs never touches that stage's row, so without this neither half looks like it failed —
        // while a half that did finish keeps its own output and status.
        await failStageUnlessCompletedSince(episodeId, kind, err, runStartedAt);
        await markEpisodeFailed(episodeId);
        await notifyN8n({ episodeId, projectId: context.projectId, status: 'FAILED' });
        throw new NonRetriableError(
          `Re-research failed at ${kind}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // The note is deliberately not passed to RESEARCH. `researchNode` picks its behaviour from
    // `Episode.researchMode` and none of its three prompts take a revision note — worse, it clears
    // `regenerateNote` on the way out, so a note sent here would be swallowed before IDEA could read
    // it. It goes to the stage that can actually act on it.
    await step.run('rerun-research', () => runStage('RESEARCH'));
    await step.run('rewrite-idea', () => runStage('IDEA', note));

    const status = await step.run('sync-status', () => syncEpisodeStatus(episodeId));

    if (isTerminalStatus(status)) {
      await step.run('notify', () => notifyN8n({ episodeId, projectId: context.projectId, status }));
    }

    return { episodeId, stage: 'IDEA', status };
  },
);
