import { notifyN8n } from '@/lib/n8n';

import { finalizeIfLastStage, markStageApproved, resumeAfterStage } from '../advance';
import { inngest } from '../client';
import { isTerminalStatus, syncEpisodeStatus } from '../episode-status';
import { runCancel, stageApprove } from '../events';

/**
 * Approve → advance exactly one stage. The graph is parked on an interrupt; resuming it runs the
 * next node and parks again. Approving RENDER runs the thread to END and finalizes the episode.
 *
 * The three operations below are shared with `autopilot.ts` (see `../advance.ts`) so that
 * "approve a stage" means exactly one thing no matter who pressed the button.
 */
export const resumeStage = inngest.createFunction(
  {
    id: 'resume-stage',
    triggers: [{ event: stageApprove }],
    // One "stop" from the user has to reach every function that could still spend on this
    // episode; see `runCancel` in `../events.ts`.
    cancelOn: [{ event: runCancel, if: 'async.data.episodeId == event.data.episodeId' }],
    concurrency: { key: 'event.data.episodeId', limit: 1 },
  },
  async ({ event, step }) => {
    const { episodeId, stage } = event.data;

    const context = await step.run('mark-approved', () => markStageApproved(episodeId, stage));
    if (context.alreadyHandled) return { episodeId, stage, skipped: true };

    await step.run('resume-graph', async () => {
      await resumeAfterStage(episodeId, context.projectId, stage);
      return null;
    });

    await step.run('finalize', async () => {
      await finalizeIfLastStage(episodeId, stage);
      return null;
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
