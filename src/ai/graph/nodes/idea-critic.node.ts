import type { CritiqueAxis, IdeaCritique } from '@/ai/prompts/idea-critic.schema';

import type { EpisodeGraphState, EpisodeGraphUpdate } from '../state';

/**
 * IDEA_CRITIC — scores the idea and reports what is missing, so the loop knows whether to research
 * again, refine, or hand the episode to the user.
 *
 * **Stub, deliberately.** It returns a passing critique without calling a model, which keeps T15
 * behaviour-neutral: paired with `routeAfterIdeaCritic`'s constant `'SCRIPT'`, the graph runs
 * IDEA → IDEA_CRITIC → park, exactly where it parked before this node existed. T19 fills in the
 * prompt and the real call.
 *
 * ⚠️ This is a graph node but **not** a `StageKind` — no stage row, no approve gate, no rail entry.
 * Same call T11 made for the research agent: it is machinery inside a stage, not a deliverable the
 * user reviews. Its verdict is persisted inside the IDEA stage's own output.
 */
const PASSING: Record<CritiqueAxis, number> = {
  premiseFit: 25,
  conflictClarity: 25,
  freshness: 25,
  visualFeasibility: 25,
};

export async function ideaCriticNode(_state: EpisodeGraphState): Promise<EpisodeGraphUpdate> {
  const critique: IdeaCritique = {
    scores: PASSING,
    score: 100,
    weaknesses: [],
    openQuestions: [],
    verdict: 'critic-unavailable',
  };

  return { ideaCritique: critique, ideaIteration: 1 };
}
