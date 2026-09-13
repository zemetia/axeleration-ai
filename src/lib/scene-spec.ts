import { z } from 'zod';

import {
  sceneTotalSeconds,
  type ScenePromptDialogueLine,
  type ScenePromptInput,
  type ScenePromptShot,
} from '@/lib/scene-prompt';

/**
 * How a beat is stored, and how any stored beat is read back into the canonical shape.
 *
 * Lives in `@/lib` rather than beside the prompts because both halves of the app read stored beats:
 * the pipeline through `episodeService`, and the Script panel straight off `EpisodeStageVO.output`.
 * One migration, one place — a second copy in the UI would be the thing that eventually disagrees
 * with the pipeline about what a pre-block beat means. Nothing here reaches into `@/ai`, so it is
 * safe in a client bundle.
 */

export const sceneShotSchema = z.object({
  durationSeconds: z.number(),
  camera: z.string().default(''),
  action: z.string().default(''),
});

export const sceneDialogueSchema = z.object({
  shot: z.number().default(1),
  speaker: z.string().default(''),
  delivery: z.string().default(''),
  line: z.string(),
});

/**
 * One beat as it is stored, mirroring the block prompt it renders to (see `formatScenePrompt`).
 *
 * Lenient on purpose — every block defaults to empty, and the two legacy fields are still accepted,
 * because this schema is what reads rows written before the format changed. `normalizeScene` turns
 * any of those into the canonical `SceneSpec`; nothing downstream reads the raw parse.
 */
export const sceneSpecSchema = z.object({
  index: z.number(),
  /** Derived from `shots` on normalization — stored so cost forecasts can read it without re-summing. */
  durationSeconds: z.number().optional(),
  style: z.string().default(''),
  setting: z.string().default(''),
  shots: z.array(sceneShotSchema).default([]),
  lighting: z.string().default(''),
  audio: z.string().default(''),
  dialogue: z.array(sceneDialogueSchema).default([]),
  negative: z.string().default(''),
  /** Pre-block beats: a paragraph of prose and a one-word mood. Read, never written. */
  description: z.string().optional(),
  mood: z.string().optional(),
});

export const sceneBreakdownSchema = z.object({
  logline: z.string(),
  scenes: z.array(sceneSpecSchema).min(1),
});

export type SceneShot = ScenePromptShot;
export type SceneDialogueLine = ScenePromptDialogueLine;

/** The canonical beat — no legacy fields, every block present, `durationSeconds` agreeing with `shots`. */
export interface SceneSpec extends ScenePromptInput {
  index: number;
  durationSeconds: number;
}

export interface SceneBreakdown {
  logline: string;
  scenes: SceneSpec[];
}

type RawScene = z.infer<typeof sceneSpecSchema>;

/**
 * Folds a pre-block beat into the block shape. The old prose said what happens, which is a shot's
 * action, and the old mood said how it should feel, which is style — so the beat keeps its meaning
 * and its running time, and re-saving it from the editor is what fills in the rest.
 */
function migrateLegacyScene(raw: RawScene): Pick<SceneSpec, 'style' | 'shots'> {
  return {
    style: raw.mood?.trim() ?? '',
    shots: [{ durationSeconds: raw.durationSeconds ?? 0, camera: '', action: raw.description ?? '' }],
  };
}

export function normalizeScene(raw: RawScene): SceneSpec {
  // A beat with no shots but a legacy description is a pre-block row; one with neither is an empty
  // draft, and gets an empty shot list rather than a synthetic shot made of nothing.
  const legacy = raw.shots.length === 0 && (raw.description !== undefined || raw.mood !== undefined);
  const migrated = legacy ? migrateLegacyScene(raw) : null;
  const shots = migrated?.shots ?? raw.shots;

  return {
    index: raw.index,
    // `shots` is the only source of truth for timing — a stored `durationSeconds` that disagrees
    // with them is stale, and trusting it would put the shot windows and the clip length at odds.
    durationSeconds: sceneTotalSeconds(shots),
    style: migrated?.style || raw.style,
    setting: raw.setting,
    shots,
    lighting: raw.lighting,
    audio: raw.audio,
    dialogue: raw.dialogue,
    negative: raw.negative,
  };
}

export function normalizeSceneBreakdown(raw: z.infer<typeof sceneBreakdownSchema>): SceneBreakdown {
  return { logline: raw.logline, scenes: raw.scenes.map(normalizeScene) };
}

/**
 * Reads whatever a SCRIPT stage happens to hold — a full breakdown, a half-written draft with no
 * beats yet, or rows in the pre-block shape — and yields only the beats that survive, canonical.
 * Beat by beat rather than all-or-nothing: one malformed entry must not take a draft with it.
 */
export function readSceneSpecs(output: unknown): SceneSpec[] {
  const scenes = (output as { scenes?: unknown } | null)?.scenes;
  if (!Array.isArray(scenes)) return [];
  return scenes.flatMap((scene) => {
    const parsed = sceneSpecSchema.safeParse(scene);
    return parsed.success ? [normalizeScene(parsed.data)] : [];
  });
}
