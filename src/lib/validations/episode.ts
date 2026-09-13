import { z } from 'zod';

/**
 * Boundary schemas for the *hand-written* half of the pipeline — every stage in the Idea room can
 * be typed by the user instead of generated, and these are what that input is validated against.
 * Deliberately self-contained: `@/lib/validations` is reachable from client components, so nothing
 * here may import `@/ai/*` (see the bundling note in `episodes/actions.ts`).
 */

export const sceneDialogueLineSchema = z.object({
  /** Which shot the line is spoken over — 1-based, matching the "Shot N" labels in the prompt. */
  shot: z.number().int().min(1, 'Dialogue belongs to a shot').default(1),
  speaker: z.string().max(80),
  /** How it is said, not what is said — "whispered, out of breath". */
  delivery: z.string().max(120, 'Delivery note is too long').default(''),
  line: z.string().min(1, 'A dialogue line cannot be empty').max(1000, 'Dialogue line is too long'),
});

/** One shot inside the clip. Its duration is what places it on the scene's timeline. */
export const sceneShotInputSchema = z.object({
  durationSeconds: z.number().int().min(1, 'A shot needs at least one second').max(600, 'Shot is too long'),
  camera: z.string().max(600, 'Camera note is too long').default(''),
  action: z.string().max(2000, 'Action is too long').default(''),
});

/** Longest a single generation may be — the same cap the old per-scene duration carried. */
const MAX_SCENE_SECONDS = 600;

/**
 * One beat as a human types it — mirrors `sceneBreakdownSchema.scenes[]` minus `index`, which the
 * service assigns. `index` is an identity (it keys `Scene` rows and the graph's `scenes` channel),
 * never something the client gets to pick.
 *
 * There is no `durationSeconds` here either: a beat is one generation cut into shots, so its length
 * is the sum of them and accepting a separate number would only let the two disagree.
 */
export const sceneSpecInputSchema = z
  .object({
    style: z.string().max(1000, 'Style is too long').default(''),
    setting: z.string().max(2000, 'Setting is too long').default(''),
    shots: z.array(sceneShotInputSchema).min(1, 'A scene needs at least one shot').max(20, 'Too many shots'),
    lighting: z.string().max(1000, 'Lighting is too long').default(''),
    audio: z.string().max(1000, 'Audio is too long').default(''),
    dialogue: z.array(sceneDialogueLineSchema).max(40, 'Too many dialogue lines').default([]),
    negative: z.string().max(1000, 'Negative is too long').default(''),
  })
  .superRefine((scene, ctx) => {
    const total = scene.shots.reduce((sum, shot) => sum + shot.durationSeconds, 0);
    if (total > MAX_SCENE_SECONDS) {
      ctx.addIssue({
        code: 'custom',
        path: ['shots'],
        message: `A scene is one generation — keep the shots under ${MAX_SCENE_SECONDS}s in total`,
      });
    }
    // A line pinned to a shot that isn't there would render as "Shot 4" over a three-shot clip.
    for (const [position, line] of scene.dialogue.entries()) {
      if (line.shot > scene.shots.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['dialogue', position, 'shot'],
          message: `Shot ${line.shot} does not exist in this scene`,
        });
      }
    }
  });

export const scriptPatchSchema = z.object({
  logline: z.string().max(500, 'Logline is too long').optional(),
});

export const ideaTextSchema = z.string().trim().min(1, 'Write something first').max(20_000, 'Idea is too long');

export const researchSourceInputSchema = z.object({
  url: z.string().url('Enter a valid URL'),
  title: z.string().max(200, 'Source title is too long').optional(),
});

export const researchFindingInputSchema = z.object({
  claim: z.string().min(1, 'A finding needs a claim').max(300, 'Claim is too long'),
  detail: z.string().max(2000, 'Detail is too long').default(''),
  sources: z.array(researchSourceInputSchema).max(10, 'Too many sources').default([]),
});

/** Edits to the RESEARCH stage's stored dossier — `findings`, when present, replaces the array wholesale. */
export const researchDossierPatchSchema = z.object({
  summary: z.string().max(10_000, 'Summary is too long').optional(),
  findings: z.array(researchFindingInputSchema).max(50, 'Too many findings').optional(),
});

export type SceneDialogueLineInput = z.infer<typeof sceneDialogueLineSchema>;
export type SceneShotInput = z.infer<typeof sceneShotInputSchema>;
export type SceneSpecInput = z.infer<typeof sceneSpecInputSchema>;
export type ScriptPatch = z.infer<typeof scriptPatchSchema>;
export type ResearchSourceInput = z.infer<typeof researchSourceInputSchema>;
export type ResearchFindingInput = z.infer<typeof researchFindingInputSchema>;
export type ResearchDossierPatch = z.infer<typeof researchDossierPatchSchema>;
