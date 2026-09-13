import { STAGE_ORDER } from '@/config/pipeline';
import type { EpisodeForecastResponse } from '@/hooks/queries';
import { blockedReason } from '@/lib/provider-readiness';
import type { EpisodeStageVO } from '@/types/value-objects';
import type { StageKind } from '@prisma/client';

/**
 * What auto-pilot would still have to do, priced — the preview behind the Start button.
 *
 * Kept out of the panel component so the arithmetic is plain and testable. It answers the same
 * question `decideNextStep` answers on the server, but for the *whole* remaining run rather than
 * one step: the server is the authority on whether a given approval may proceed, and this is the
 * honest estimate the user agrees to before handing over control.
 */

export interface RemainingWork {
  /** Stages that are not APPROVED yet, in pipeline order. */
  stages: StageKind[];
  totalUsd: number;
  etaSeconds: number;
  /** Human-facing reasons auto-pilot cannot start, one per blocked stage. */
  blocked: string[];
}

export function remainingWork(
  stages: EpisodeStageVO[],
  forecast: EpisodeForecastResponse | undefined,
): RemainingWork {
  const byKind = new Map(stages.map((stage) => [stage.kind, stage]));
  const pending = STAGE_ORDER.filter((kind) => byKind.get(kind)?.status !== 'APPROVED');

  let totalUsd = 0;
  let etaSeconds = 0;
  const blocked: string[] = [];

  for (const kind of pending) {
    const stageForecast = forecast?.stages[kind];
    if (stageForecast) {
      totalUsd += stageForecast.totalUsd;
      etaSeconds += stageForecast.etaSeconds;
    }

    const reason = blockedReason(forecast?.readiness.stages[kind]);
    if (reason) blocked.push(`${kind} cannot run — ${reason}`);
  }

  return { stages: [...pending], totalUsd: Number(totalUsd.toFixed(4)), etaSeconds, blocked };
}
