import { aiConfig } from '@/config/ai';

export interface SceneEstimateInput {
  targetTotalSeconds: number;
  sceneDurationMin: number;
  sceneDurationMax: number;
}

/** Derives the expected scene count for a Video Config, clamped to the platform's per-episode cap. */
export function estimateScenes({
  targetTotalSeconds,
  sceneDurationMin,
  sceneDurationMax,
}: SceneEstimateInput): number {
  const avgDuration = (sceneDurationMin + sceneDurationMax) / 2;
  if (avgDuration <= 0) return 0;
  const raw = Math.round(targetTotalSeconds / avgDuration);
  return Math.min(Math.max(raw, 0), aiConfig.limits.maxScenesPerEpisode);
}

export const LOW_SCENE_COUNT_THRESHOLD = 3;

export function hasFewScenesWarning(estimatedScenes: number): boolean {
  return estimatedScenes < LOW_SCENE_COUNT_THRESHOLD;
}
