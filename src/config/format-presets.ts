import type { AspectRatio, Resolution } from '@prisma/client';

/**
 * Where a video is going to be published, expressed as the five numbers that actually control it.
 *
 * The video step asks for aspect ratio, resolution, target length and a scene-duration range —
 * four independent decisions that are really one decision most of the time ("this is a reel").
 * Picking a destination sets all of them; every field stays editable afterwards, so a preset is a
 * starting point, not a mode.
 *
 * The scene ranges are chosen so `estimateScenes` lands somewhere sane for the format: short,
 * fast cuts for vertical feeds, longer takes for widescreen.
 */

export interface FormatPreset {
  id: string;
  label: string;
  /** Where this format is published — the thing the user actually recognises. */
  description: string;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  targetTotalSeconds: number;
  sceneDurationMin: number;
  sceneDurationMax: number;
}

export const FORMAT_PRESETS: readonly FormatPreset[] = [
  {
    id: 'reels',
    label: 'Reels / Shorts / TikTok',
    description: 'Vertical, ~45s, fast cuts',
    aspectRatio: 'R9_16',
    resolution: 'P1080',
    targetTotalSeconds: 45,
    sceneDurationMin: 4,
    sceneDurationMax: 7,
  },
  {
    id: 'youtube',
    label: 'YouTube',
    description: 'Widescreen, ~3 min, longer takes',
    aspectRatio: 'R16_9',
    resolution: 'P1080',
    targetTotalSeconds: 180,
    sceneDurationMin: 8,
    sceneDurationMax: 14,
  },
  {
    id: 'square',
    label: 'Square feed post',
    description: 'Square, ~30s, for in-feed autoplay',
    aspectRatio: 'R1_1',
    resolution: 'P1080',
    targetTotalSeconds: 30,
    sceneDurationMin: 4,
    sceneDurationMax: 6,
  },
] as const;

/** The fields a preset owns — everything else in the draft is left alone when one is applied. */
export type FormatPresetPatch = Pick<
  FormatPreset,
  'aspectRatio' | 'resolution' | 'targetTotalSeconds' | 'sceneDurationMin' | 'sceneDurationMax'
>;

export function presetPatch(preset: FormatPreset): FormatPresetPatch {
  return {
    aspectRatio: preset.aspectRatio,
    resolution: preset.resolution,
    targetTotalSeconds: preset.targetTotalSeconds,
    sceneDurationMin: preset.sceneDurationMin,
    sceneDurationMax: preset.sceneDurationMax,
  };
}

/**
 * Which preset the current values correspond to, or `null` once they have been hand-tuned.
 *
 * Matching on the values rather than storing a chosen id is deliberate: the preset is not part of
 * the project, and a stored id would go stale the moment someone edits a field under it — leaving
 * a card highlighted that no longer describes the settings.
 */
export function matchPreset(values: FormatPresetPatch): FormatPreset | null {
  return (
    FORMAT_PRESETS.find(
      (preset) =>
        preset.aspectRatio === values.aspectRatio &&
        preset.resolution === values.resolution &&
        preset.targetTotalSeconds === values.targetTotalSeconds &&
        preset.sceneDurationMin === values.sceneDurationMin &&
        preset.sceneDurationMax === values.sceneDurationMax,
    ) ?? null
  );
}
