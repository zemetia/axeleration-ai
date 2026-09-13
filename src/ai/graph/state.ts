import { Annotation } from '@langchain/langgraph';

import type { IdeaCritique } from '@/ai/prompts/idea-critic.schema';
import type { SceneBreakdown } from '@/ai/prompts/script.schema';

export interface SceneResult {
  index: number;
  videoUrl: string;
}

/** Which beats a SCENES run covers — see the `sceneScope` channel below. */
export type SceneScope = 'missing' | 'all';

/**
 * Whether an IDEA run writes a new idea or improves the one that exists — see the `ideaMode`
 * channel below. `'fresh'` is what Regenerate has always done; `'refine'` is T18.
 */
export type IdeaMode = 'fresh' | 'refine';

/** Whether a SCRIPT run writes a new breakdown or revises the one that exists — see `scriptMode` below. */
export type ScriptMode = 'fresh' | 'refine';

/** Reducer channels for the episode state graph — one node's partial return merges into this. */
export const EpisodeGraphAnnotation = Annotation.Root({
  episodeId: Annotation<string>(),
  projectId: Annotation<string>(),
  researchContext: Annotation<string | undefined>({ reducer: (_prev, next) => next, default: () => undefined }),
  idea: Annotation<string | undefined>({ reducer: (_prev, next) => next, default: () => undefined }),
  /**
   * SCRIPT's prose output. Written by T17, which moves SCRIPT off producing a `SceneBreakdown`
   * directly — the `script` channel below keeps that shape, it just changes owner to BREAKDOWN.
   * Declared here so T17 never has to reopen this file.
   */
  screenplay: Annotation<string | undefined>({ reducer: (_prev, next) => next, default: () => undefined }),
  script: Annotation<SceneBreakdown | undefined>({ reducer: (_prev, next) => next, default: () => undefined }),
  scenes: Annotation<SceneResult[] | undefined>({ reducer: (_prev, next) => next, default: () => undefined }),
  voiceUrls: Annotation<string[] | undefined>({ reducer: (_prev, next) => next, default: () => undefined }),
  musicUrl: Annotation<string | undefined>({ reducer: (_prev, next) => next, default: () => undefined }),
  finalVideoUrl: Annotation<string | undefined>({ reducer: (_prev, next) => next, default: () => undefined }),
  costTotal: Annotation<number>({ reducer: (prev, next) => prev + next, default: () => 0 }),
  /**
   * The user's note from a Regenerate. Empty string means "no note" — a node consumes it and
   * clears it, so a note attached to one stage can never leak into the next one's prompt.
   */
  regenerateNote: Annotation<string>({ reducer: (_prev, next) => next, default: () => '' }),
  /**
   * Which beats the next SCENES run covers. `'missing'` (the default) keeps every beat that already
   * has a READY `Scene` row and only generates the rest, so scenes generated one card at a time are
   * not paid for twice when the batch runs; `'all'` is the explicit "Regenerate all scenes" nuke.
   * Consumed and reset by `scenesNode`, same contract as `regenerateNote`.
   */
  sceneScope: Annotation<SceneScope>({ reducer: (_prev, next) => next, default: () => 'missing' }),
  /**
   * Whether the next IDEA run writes fresh or refines what is there. Same consume-and-reset contract
   * as `regenerateNote` and `sceneScope`: `ideaNode` clears it back to `'fresh'`, so a refine
   * requested once cannot silently turn the following Regenerate into another refine. Consumed by
   * T18; until then nothing reads it and every run is `'fresh'`.
   */
  ideaMode: Annotation<IdeaMode>({ reducer: (_prev, next) => next, default: () => 'fresh' }),
  /**
   * Whether the next SCRIPT run writes fresh or revises the breakdown that is there. Same
   * consume-and-reset contract as `ideaMode`: `scriptNode` clears it back to `'fresh'` once read, so
   * a refine requested once cannot silently turn the following Regenerate into another refine.
   */
  scriptMode: Annotation<ScriptMode>({ reducer: (_prev, next) => next, default: () => 'fresh' }),
  /** The critic's last verdict on the idea. Written by `IDEA_CRITIC`, read by `routeAfterIdeaCritic`. */
  ideaCritique: Annotation<IdeaCritique | undefined>({ reducer: (_prev, next) => next, default: () => undefined }),
  /**
   * How many times the RESEARCH ↔ IDEA loop has been round. Accumulates rather than replaces —
   * the critic returns `1` per pass and this counts them — because it is the guardrail that
   * terminates the loop, and a channel that can be reset by a later write is not a guardrail.
   */
  ideaIteration: Annotation<number>({ reducer: (prev, next) => prev + next, default: () => 0 }),
});

export type EpisodeGraphState = typeof EpisodeGraphAnnotation.State;
export type EpisodeGraphUpdate = typeof EpisodeGraphAnnotation.Update;
