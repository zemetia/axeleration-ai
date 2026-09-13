import { describe, expect, it } from 'vitest';

import { estimateScenes } from '@/lib/scene-estimate';

import { FORMAT_PRESETS, matchPreset, presetPatch } from './format-presets';

describe('format presets', () => {
  it('round-trips: applying a preset makes it the matched one', () => {
    for (const preset of FORMAT_PRESETS) {
      expect(matchPreset(presetPatch(preset))?.id).toBe(preset.id);
    }
  });

  it('reports null once any field is hand-tuned', () => {
    const [first] = FORMAT_PRESETS;
    if (!first) throw new Error('expected at least one preset');
    expect(matchPreset({ ...presetPatch(first), targetTotalSeconds: 61 })).toBeNull();
  });

  it('has no two presets with identical settings, or one would shadow the other', () => {
    const keys = FORMAT_PRESETS.map((preset) => JSON.stringify(presetPatch(preset)));
    expect(new Set(keys).size).toBe(FORMAT_PRESETS.length);
  });

  /**
   * A preset that produces one or two scenes would trip the wizard's own "fewer than 3 scenes"
   * warning the moment it is applied — a suggested default must not be immediately suspect.
   */
  it('every preset yields a workable scene count', () => {
    for (const preset of FORMAT_PRESETS) {
      const scenes = estimateScenes(preset);
      expect(scenes, `${preset.id} produced ${scenes} scenes`).toBeGreaterThanOrEqual(3);
      expect(scenes, `${preset.id} produced ${scenes} scenes`).toBeLessThanOrEqual(60);
    }
  });

  it('keeps the scene duration range coherent', () => {
    for (const preset of FORMAT_PRESETS) {
      expect(preset.sceneDurationMin).toBeLessThanOrEqual(preset.sceneDurationMax);
      expect(preset.sceneDurationMin).toBeGreaterThan(0);
    }
  });
});
