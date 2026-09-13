import { eventType } from 'inngest';
import { z } from 'zod';

import { STAGE_ORDER } from '@/config/pipeline';

/**
 * The pipeline's event contract. Server Actions (T08) emit these; the functions in
 * `src/inngest/functions/` consume them. Events are deliberately decoupled from handlers —
 * an action never waits for generation to finish.
 *
 * Inngest v4 types events with Standard Schema, so one `eventType` is both the trigger for a
 * function and the typed constructor for `inngest.send(...)`.
 */

/** Built from `STAGE_ORDER` so a new stage cannot be added to the graph and forgotten here. */
const stageKind = z.enum(STAGE_ORDER);

/** `projectId` rides along so Inngest can cap concurrency per project without a DB lookup. */
export const episodeGenerate = eventType('episode/generate', {
  schema: z.object({ episodeId: z.string(), projectId: z.string() }),
});

export const stageApprove = eventType('episode/stage.approve', {
  schema: z.object({ episodeId: z.string(), stage: stageKind }),
});

/**
 * `scope` is SCENES-only and defaults to `'all'` (regenerate every beat). `'missing'` generates just
 * the beats without a clip yet, which is how "Generate remaining scenes" composes with the per-card
 * Generate — see the `sceneScope` channel in `src/ai/graph/state.ts`.
 */
export const stageRegenerate = eventType('episode/stage.regenerate', {
  schema: z.object({
    episodeId: z.string(),
    stage: stageKind,
    note: z.string().optional(),
    scope: z.enum(['missing', 'all']).optional(),
  }),
});

/**
 * Refine the idea in place rather than rewriting it — the `ideaMode: 'refine'` path (T18).
 *
 * Deliberately its own event instead of a `mode` field on `stageRegenerate`: refine is IDEA-only,
 * and widening a stage-generic contract with a field that is meaningless for seven of the eight
 * stages is how a payload starts needing a comment to explain when it applies.
 */
export const ideaRefine = eventType('episode/idea.refine', {
  schema: z.object({ episodeId: z.string(), note: z.string().optional() }),
});

/**
 * Research again, then write a new idea from what came back — the two-stage action the Idea room
 * offers as one button. It is one event (and one function) rather than two sends so the pair cannot
 * half-happen: fresh research paired with the idea it was supposed to replace is worse than either
 * stage failing outright, because nothing on screen says the two no longer match.
 */
export const ideaRerunResearch = eventType('episode/idea.rerun-research', {
  schema: z.object({ episodeId: z.string(), note: z.string().optional() }),
});

/**
 * Refine the scene breakdown in place rather than cutting a new one from the idea — the
 * `scriptMode: 'refine'` path. Same reasoning as `ideaRefine`: its own event rather than a `mode`
 * field on `stageRegenerate`, since refine is SCRIPT-only here.
 */
export const scriptRefine = eventType('episode/script.refine', {
  schema: z.object({ episodeId: z.string(), note: z.string().optional() }),
});

/**
 * Searches for whatever the user typed and appends what comes back to the existing dossier — the
 * additive counterpart to `stageRegenerate`, which replaces RESEARCH wholesale. See
 * `src/ai/research/additional-research.ts` for the merge.
 */
export const researchAdditional = eventType('episode/research.additional', {
  schema: z.object({ episodeId: z.string(), query: z.string().min(1) }),
});

export const sceneRegenerate = eventType('episode/scene.regenerate', {
  schema: z.object({
    episodeId: z.string(),
    projectId: z.string(),
    sceneIndex: z.number().int(),
    note: z.string().optional(),
  }),
});

/**
 * Stops whatever is running on an episode. Every generation function lists this in its `cancelOn`,
 * matched on `episodeId`, so one event stops the batch, the stage run and auto-pilot together —
 * the user thinks of them as one thing ("stop"), and stopping only some of them would let
 * auto-pilot immediately start the next stage.
 */
export const runCancel = eventType('episode/run.cancel', {
  schema: z.object({ episodeId: z.string() }),
});

/**
 * Starts auto-pilot. The budget itself is not on the event — it lives on the episode row, so
 * raising or cancelling it mid-run takes effect on the next step rather than being frozen into a
 * payload the loop would keep spending against.
 */
export const autoPilotStart = eventType('episode/autopilot.start', {
  schema: z.object({ episodeId: z.string(), projectId: z.string() }),
});

export const bibleGenerate = eventType('project/bible.generate', {
  schema: z.object({ projectId: z.string() }),
});
