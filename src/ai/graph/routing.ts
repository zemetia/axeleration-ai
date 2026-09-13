import type { EpisodeGraphState } from './state';

/**
 * Where the graph goes after the idea has been critiqued.
 *
 * **Constant for now, deliberately.** T19 turns this into the RESEARCH ↔ IDEA loop's decision —
 * score against a threshold, iteration and budget guardrails, and a route back to RESEARCH for
 * missing facts or to IDEA for a refine. Landing the seam here, with `graph.ts` already wired to
 * call it, is what lets T19 build the loop without reopening the graph that T17 also has claims on.
 *
 * Keeping it a pure function of state is the other half: the loop's termination rules are the part
 * that can quietly spend money, and a pure function is the only version of them that can be tested
 * exhaustively without a model.
 */
export type AfterIdeaRoute = 'RESEARCH' | 'IDEA' | 'SCRIPT';

export function routeAfterIdeaCritic(_state: EpisodeGraphState): AfterIdeaRoute {
  return 'SCRIPT';
}
