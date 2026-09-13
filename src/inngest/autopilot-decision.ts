import { STAGE_ORDER, nextStageAfter } from '@/config/pipeline';
import { forecastStage } from '@/lib/cost-forecast';
import { buildForecastContext } from '@/lib/forecast-input';
import { prisma } from '@/lib/prisma';
import { blockedReason, readinessForStage } from '@/lib/provider-readiness';
import type { StageKind } from '@prisma/client';

/**
 * The one question auto-pilot asks before each step: approve something, or stop and say why?
 *
 * Split out from the Inngest function so it is a plain, testable async function. Every stop is a
 * *reason*, never a silent halt — an auto-pilot that quietly stops is worse than no auto-pilot,
 * because the user is waiting on a video that is never coming.
 */

export type AutoPilotDecision =
  | { action: 'approve'; stage: StageKind; approveCostUsd: number }
  | { action: 'stop'; reason: string; isFailure: boolean };

/** Bounds the loop regardless of what the pipeline does. Eight stages plus slack for re-entry. */
export const AUTOPILOT_MAX_STEPS = 14;

export async function decideNextStep(episodeId: string): Promise<AutoPilotDecision> {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    select: {
      autoPilotBudget: true,
      autoPilotStartedAt: true,
      autoPilotStoppedAt: true,
      totalCost: true,
      // The owner is resolved here rather than carried on the event: the credential lookup behind
      // the readiness check is user-scoped, and an id that arrived in a payload is a worse source
      // of truth for "whose keys" than the row itself.
      project: { select: { ownerId: true } },
      stages: { select: { kind: true, status: true, error: true, costEstimate: true } },
    },
  });
  if (!episode) return { action: 'stop', reason: 'The episode no longer exists.', isFailure: true };

  // Cancel is a write to `autoPilotStoppedAt`, checked here rather than through an Inngest
  // cancellation event: this loop spends money, so the check belongs immediately before each spend.
  if (episode.autoPilotStoppedAt) {
    return { action: 'stop', reason: 'Stopped by you.', isFailure: false };
  }
  if (!episode.autoPilotStartedAt) {
    return { action: 'stop', reason: 'Auto-pilot is not running.', isFailure: false };
  }

  const failed = episode.stages.find((stage) => stage.status === 'FAILED');
  if (failed) {
    return {
      action: 'stop',
      reason: `${failed.kind} failed — ${failed.error ?? 'no error recorded'}. Fix it and restart auto-pilot.`,
      isFailure: true,
    };
  }

  // A stage still GENERATING means something else is driving this episode; stepping in would
  // approve on top of a run in flight.
  const running = episode.stages.find((stage) => stage.status === 'GENERATING');
  if (running) {
    return {
      action: 'stop',
      reason: `${running.kind} is already running outside auto-pilot.`,
      isFailure: false,
    };
  }

  const byKind = new Map(episode.stages.map((stage) => [stage.kind, stage]));
  const ready = STAGE_ORDER.find((kind) => byKind.get(kind)?.status === 'READY');

  if (!ready) {
    const render = byKind.get('RENDER');
    if (render?.status === 'APPROVED') {
      return { action: 'stop', reason: 'Finished — the episode is rendered.', isFailure: false };
    }
    return {
      action: 'stop',
      reason: 'Nothing is waiting for approval. Generate or write the next stage first.',
      isFailure: false,
    };
  }

  // Approving is what starts — and pays for — the *downstream* stage, so that is what both the
  // budget and the credential check have to be about. Same asymmetry `StagePanel` models.
  const downstream = nextStageAfter(ready);
  if (!downstream) {
    // Approving RENDER runs the thread to END and costs nothing.
    return { action: 'approve', stage: ready, approveCostUsd: 0 };
  }

  const context = await buildForecastContext(episodeId, episode.project.ownerId);
  if (!context) {
    return {
      action: 'stop',
      reason: 'Could not read the episode to price the next stage.',
      isFailure: true,
    };
  }

  const blocked = blockedReason(readinessForStage(downstream, context.readiness));
  if (blocked) {
    return { action: 'stop', reason: `${downstream} cannot run — ${blocked}`, isFailure: true };
  }

  const cost = forecastStage(downstream, context.forecast);
  const spent = episode.totalCost ? Number(episode.totalCost) : 0;
  const budget = episode.autoPilotBudget ? Number(episode.autoPilotBudget) : 0;

  if (spent + cost.totalUsd > budget) {
    return {
      action: 'stop',
      reason:
        `Budget reached. ${formatUsd(spent)} spent, and ${downstream.toLowerCase()} is forecast at ` +
        `${formatUsd(cost.totalUsd)}, over the ${formatUsd(budget)} cap. Raise the budget to continue.`,
      isFailure: false,
    };
  }

  /*
   * An unpriced model makes `totalUsd` a floor, not an estimate — the check above could pass on a
   * number that is missing a line entirely. Refusing to spend is the right side to err on when the
   * whole point of the budget is that nobody is watching.
   */
  if (cost.hasUnpricedModel) {
    return {
      action: 'stop',
      reason: `${downstream} uses a model with no price in the cost table, so it cannot be kept under a budget. Approve it yourself.`,
      isFailure: false,
    };
  }

  return { action: 'approve', stage: ready, approveCostUsd: cost.totalUsd };
}

/**
 * Two decimals hides exactly the numbers this message is about — a cap of $0.0001 rendered as
 * "over the $0.00 cap" reads as nonsense. Small values get the precision they need.
 */
function formatUsd(value: number): string {
  return `$${value.toFixed(value > 0 && value < 0.1 ? 4 : 2)}`;
}
