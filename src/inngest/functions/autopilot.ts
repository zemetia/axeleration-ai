import { notifyN8n } from '@/lib/n8n';
import { episodeService } from '@/services';

import { finalizeIfLastStage, markStageApproved, resumeAfterStage } from '../advance';
import { AUTOPILOT_MAX_STEPS, decideNextStep } from '../autopilot-decision';
import { inngest } from '../client';
import { isTerminalStatus, syncEpisodeStatus } from '../episode-status';
import { autoPilotStart, runCancel } from '../events';

/**
 * Runs an episode to the end without asking, up to a budget the user approved up front.
 *
 * This is "press Approve for me", nothing more: each step goes through the same
 * `markStageApproved` / `resumeAfterStage` pair the Approve button uses (`../advance.ts`), so the
 * LangGraph checkpoint sees exactly the sequence it would have seen from a person clicking. It
 * deliberately does *not* fan out or parallelise — the pipeline is linear and each stage's output
 * is the next one's input.
 *
 * The loop is sequential because `resumeAfterStage` awaits the node to completion, so by the time a
 * step returns the next stage is READY and `decideNextStep` can price it against what has now been
 * spent. Every exit writes `autoPilotStopReason`; there is no silent halt.
 */
export const autopilot = inngest.createFunction(
  {
    id: 'autopilot',
    triggers: [{ event: autoPilotStart }],
    // One "stop" from the user has to reach every function that could still spend on this
    // episode; see `runCancel` in `../events.ts`.
    cancelOn: [{ event: runCancel, if: 'async.data.episodeId == event.data.episodeId' }],
    // One auto-pilot per episode, and it takes the same slot the manual Approve path uses.
    concurrency: { key: 'event.data.episodeId', limit: 1 },
  },
  async ({ event, step }) => {
    const { episodeId, projectId } = event.data;

    for (let iteration = 0; iteration < AUTOPILOT_MAX_STEPS; iteration += 1) {
      const decision = await step.run(`decide-${iteration}`, () => decideNextStep(episodeId));

      if (decision.action === 'stop') {
        await step.run(`stop-${iteration}`, async () => {
          await episodeService.stopAutoPilot(episodeId, decision.reason);
          return null;
        });
        return { episodeId, stopped: decision.reason, steps: iteration };
      }

      const context = await step.run(`approve-${iteration}`, () =>
        markStageApproved(episodeId, decision.stage),
      );

      // Something else approved it between the decision and here. Re-deciding is correct: the
      // pipeline has moved on, and this iteration has nothing left to do.
      if (context.alreadyHandled) continue;

      await step.run(`resume-${iteration}`, async () => {
        await resumeAfterStage(episodeId, context.projectId, decision.stage);
        return null;
      });

      await step.run(`finalize-${iteration}`, async () => {
        await finalizeIfLastStage(episodeId, decision.stage);
        return null;
      });

      const status = await step.run(`sync-${iteration}`, () => syncEpisodeStatus(episodeId));

      if (isTerminalStatus(status)) {
        await step.run(`notify-${iteration}`, () => notifyN8n({ episodeId, projectId, status }));
      }
    }

    // Hitting the ceiling means the pipeline is longer than it should be, or is cycling. Stopping
    // is the safe read — the alternative is an unbounded spend loop.
    await step.run('stop-exhausted', async () => {
      await episodeService.stopAutoPilot(
        episodeId,
        `Stopped after ${AUTOPILOT_MAX_STEPS} steps without finishing. Continue by hand.`,
      );
      return null;
    });

    return { episodeId, stopped: 'step limit', steps: AUTOPILOT_MAX_STEPS };
  },
);
