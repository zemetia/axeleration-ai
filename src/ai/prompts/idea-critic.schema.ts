/**
 * What the idea critic reports back — the shape the RESEARCH ↔ IDEA loop routes on.
 *
 * Type-only for now. T19 adds the matching Zod schema and the prompt that produces it; this file
 * exists ahead of that so `state.ts`, `routing.ts` and the critic node stub can be wired and
 * type-checked without T19 having to reopen the graph.
 */

export type CritiqueAxis = 'premiseFit' | 'conflictClarity' | 'freshness' | 'visualFeasibility';

export interface CritiqueWeakness {
  axis: CritiqueAxis;
  detail: string;
  /**
   * How the loop repairs it — the field the routing decision actually turns on. `'refine'` is
   * something a rewrite can fix; `'research'` needs facts the model does not have, so the loop goes
   * back for them instead of asking for the same idea again in different words.
   */
  fixable: 'refine' | 'research';
}

export interface IdeaCritique {
  /** Each axis is scored out of 25. `score` is their sum, recomputed server-side. */
  scores: Record<CritiqueAxis, number>;
  score: number;
  weaknesses: CritiqueWeakness[];
  /** Facts the idea needs but does not have — these become the next research goal. */
  openQuestions: string[];
  /**
   * Set when the critic could not run. The loop's job is to improve an idea, not to become a new
   * way for the pipeline to die, so an unavailable critic reports a passing critique and routing
   * lets the episode through.
   */
  verdict?: 'critic-unavailable';
}
