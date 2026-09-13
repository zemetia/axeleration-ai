import { z } from 'zod';

/**
 * What SCRIPT produces: a screenplay a person can read, not a list of shots.
 *
 * SCRIPT used to emit `sceneBreakdownSchema` directly, which asked one call to invent the story
 * *and* cut it into beats, and left no artefact in between that reads as a script. BREAKDOWN now
 * owns the cut (see `breakdown.prompt.ts`); this is the half a human reviews and edits.
 */
export const screenplaySchema = z.object({
  logline: z.string(),
  /** Continuous scene-headed prose. `@handle` mentions appear inline and are verified by T16's validator. */
  screenplay: z.string(),
  /**
   * The handles the writer means to feature. Asking for them measurably improves whether the prose
   * actually uses the roster — but it is a *claim*, not a record: `scriptNode` overwrites it with
   * the handles `validateMentions` found in the text, so nothing downstream can read a list that
   * disagrees with the screenplay it came from.
   */
  characters: z.array(z.string()).default([]),
});

export type Screenplay = z.infer<typeof screenplaySchema>;

/**
 * The scene shape itself lives in `@/lib/scene-spec` — the Script panel reads stored beats straight
 * off `EpisodeStageVO.output`, and it cannot pull `@/ai` into a client bundle to do it. Re-exported
 * here so the pipeline keeps importing its scene types from the module its prompts live in.
 */
export {
  normalizeScene,
  normalizeSceneBreakdown,
  readSceneSpecs,
  sceneBreakdownSchema,
  sceneDialogueSchema,
  sceneShotSchema,
  sceneSpecSchema,
  type SceneBreakdown,
  type SceneDialogueLine,
  type SceneShot,
  type SceneSpec,
} from '@/lib/scene-spec';
