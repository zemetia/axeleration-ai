import type { StageKind } from '@prisma/client';

/**
 * The pipeline's shape, in one place.
 *
 * The stage order used to be written out as a literal in six modules — the graph's `interruptAfter`,
 * stage-row seeding, auto-pilot's "what is READY", the client rail's remaining-work preview,
 * credential readiness, and the forecast. Six independent literals means inserting a stage into five
 * of them leaves the sixth quietly describing a pipeline that no longer exists, and the symptom is
 * never an error: the graph interrupts somewhere the UI does not expect, or Approve prices the wrong
 * stage.
 *
 * Deliberately dependency-free. Client components read the stage list, so this module must never
 * import `@/ai/*`, `@/inngest/*` or `@/providers/*` — the `@prisma/client` import below is
 * type-only and erased at build time. See `docs/knowledge/THIS.md` (Don'ts).
 */

/**
 * `satisfies` rather than a `readonly StageKind[]` annotation: the annotation would widen this to an
 * array of the union and destroy the literal tuple type, which is what lets `z.enum(STAGE_ORDER)`
 * build the event and MCP tool schemas from the same source instead of retyping the list twice more.
 * The `satisfies` still fails the build if a value is not a real `StageKind`.
 */
export const STAGE_ORDER = [
  'RESEARCH',
  'IDEA',
  'SCRIPT',
  'BREAKDOWN',
  'SCENES',
  'VOICE',
  'MUSIC',
  'RENDER',
] as const satisfies readonly StageKind[];

/**
 * A graph node that is not a stage: it has no `EpisodeStage` row, no approve gate and no rail entry.
 * Same call T11 made for the research agent — machinery inside a stage, not a deliverable.
 */
export type GraphOnlyNode = 'IDEA_CRITIC';
export type GraphNode = StageKind | GraphOnlyNode;

/**
 * Where the graph parks for review.
 *
 * Normally one park per stage, but IDEA is spliced: `IDEA_CRITIC` runs immediately after it, so the
 * critique is on screen when the user reviews the idea rather than arriving a resume later.
 * Interrupting after IDEA *and* after the critic would cost an extra Approve click for nothing.
 */
export const INTERRUPT_AFTER: GraphNode[] = [...STAGE_ORDER.filter((kind) => kind !== 'IDEA'), 'IDEA_CRITIC'];

/**
 * Bumped whenever the graph's *node/edge shape* changes — not when a node's implementation changes.
 *
 * A LangGraph checkpoint stores each thread's channel values **and `next`**, the node to run when it
 * resumes. Rewire the graph and every parked thread still holds a `next` computed against the old
 * wiring: v1 threads parked after SCRIPT carry `next: ['SCENES']`, which under v2 skips BREAKDOWN
 * entirely and hands SCENES an empty breakdown. That does not throw — it renders an episode with no
 * scenes. Stamping the version on the episode is what turns that silent wrong answer into a refusal.
 *
 * v1 — RESEARCH → IDEA → SCRIPT → SCENES → VOICE → MUSIC → RENDER
 * v2 — SCRIPT → BREAKDOWN → SCENES, and IDEA → IDEA_CRITIC → (conditional)
 */
export const GRAPH_VERSION = 2;

/**
 * What Approve actually starts. Approving a stage accepts it *and* runs the next one, so the price
 * and the credential check both belong to the successor. `null` for the last stage, which starts
 * nothing.
 */
export function nextStageAfter(kind: StageKind): StageKind | null {
  return STAGE_ORDER[STAGE_ORDER.indexOf(kind) + 1] ?? null;
}

/** Stages after `kind`, in order — "is there downstream work?" for manual writes. */
export function stagesAfter(kind: StageKind): StageKind[] {
  return [...STAGE_ORDER.slice(STAGE_ORDER.indexOf(kind) + 1)];
}
