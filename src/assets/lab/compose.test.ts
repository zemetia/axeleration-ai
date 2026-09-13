import { describe, expect, it } from 'vitest';

import { anchorViewOf, ASSET_VIEW_PLANS, viewOf, type AssetView } from '@/config/asset-views';
import { ASSET_TYPES } from '@/config/asset-schema';
import type { AssetType } from '@prisma/client';

import { composeShotPrompt } from './compose';

/** Every assertion below is about a specific angle, so a missing one is a test bug, not a pass. */
function requireView(type: AssetType, viewId: string): AssetView {
  const view = viewOf(type, viewId);
  if (!view) throw new Error(`Fixture view ${type}/${viewId} no longer exists`);
  return view;
}

const CHARACTER = {
  type: 'CHARACTER' as const,
  name: 'Luna',
  description: 'A courier who runs the night routes.',
  attributes: {
    hair: 'Silver, blunt fringe',
    traits: ['guarded', 'fast'],
    mustKeep: 'Crescent scar on the left cheek',
    avoid: 'No visible sponsor logos',
    negativePrompt: 'extra fingers, plastic skin',
  },
};

describe('composeShotPrompt', () => {
  it('leads with the subject and ends with the continuity lock', () => {
    const view = requireView('CHARACTER', 'profile');
    const { prompt } = composeShotPrompt({ ...CHARACTER, view });
    const lines = prompt.split('\n\n');

    expect(lines[0]).toContain('"Luna"');
    // Identity before camera: an image model weights the head of the prompt hardest, and the
    // character is what must survive.
    expect(prompt.indexOf('Silver, blunt fringe')).toBeLessThan(prompt.indexOf(view.directive));
    expect(lines.at(-1)).toContain('Crescent scar on the left cheek');
  });

  it('folds the avoid field into the negative prompt', () => {
    const { negativePrompt } = composeShotPrompt({
      ...CHARACTER,
      view: requireView('CHARACTER', 'portrait'),
    });
    expect(negativePrompt).toContain('No visible sponsor logos');
    expect(negativePrompt).toContain('watermark');
  });

  it('folds the negative prompt field into the negatives and keeps it out of the positive prompt', () => {
    const { prompt, negativePrompt } = composeShotPrompt({
      ...CHARACTER,
      view: requireView('CHARACTER', 'portrait'),
    });
    expect(negativePrompt).toContain('plastic skin');
    // The whole point of the field: an image model told to draw "plastic skin" draws plastic skin.
    expect(prompt).not.toContain('plastic skin');
  });

  it('keeps a term the user repeats from the baseline exactly once', () => {
    const { negativePrompt } = composeShotPrompt({
      ...CHARACTER,
      attributes: { ...CHARACTER.attributes, negativePrompt: 'Blurry, six fingers' },
      view: requireView('CHARACTER', 'portrait'),
    });
    expect(negativePrompt?.match(/blurry/gi)).toHaveLength(1);
    expect(negativePrompt).toContain('six fingers');
  });

  it('adds the view own negatives', () => {
    const anchor = requireView('CHARACTER', 'portrait');
    const { negativePrompt } = composeShotPrompt({ ...CHARACTER, view: anchor });
    expect(negativePrompt).toContain('different face identity');
    expect(anchor.negative).toBeTruthy();
  });

  it('renders a panel as one plain image, never as the grid', () => {
    const view = requireView('CHARACTER', 'portrait');
    const panel = view.panels?.[2];
    if (!panel) throw new Error('The character anchor no longer has panels');

    const { prompt, negativePrompt } = composeShotPrompt({ ...CHARACTER, view, panel });
    // The sheet's own layout language must not reach a cell: a panel that comes back as its own
    // little grid cannot be tiled into one.
    expect(prompt).not.toContain('multi-panel grid');
    expect(prompt).not.toContain('Face close-up panels');
    expect(prompt).toContain(panel.directive);
    expect(negativePrompt).toContain('collage');
  });

  it('lets the anchor sheet lead with its own layout subject', () => {
    const view = requireView('CHARACTER', 'portrait');
    const { prompt } = composeShotPrompt({ ...CHARACTER, view });
    // Layout first: a model that reads the description before the grid renders one panel.
    expect(prompt.startsWith('Character reference sheet, multi-panel grid of "Luna".')).toBe(true);
    expect(prompt).toContain('3/4 face angle');
  });

  it('keeps the base prompt when the fields do not already say it', () => {
    const { prompt } = composeShotPrompt({
      ...CHARACTER,
      view: requireView('CHARACTER', 'portrait'),
      basePrompt: 'she should read as exhausted',
    });
    expect(prompt).toContain('she should read as exhausted');
  });

  it('appends an inherited style after the directive', () => {
    const view = requireView('LOCATION', 'establishing');
    const { prompt } = composeShotPrompt({
      type: 'LOCATION',
      name: 'Rainy alley',
      attributes: {},
      view,
      styleText: '90s cel anime, teal and amber',
    });
    expect(prompt.indexOf(view.directive)).toBeLessThan(prompt.indexOf('90s cel anime'));
  });

  it('ignores continuity fields a type does not declare', () => {
    // MAP has no `mustKeep` field; a stale value must not leak into its prompt.
    const { prompt } = composeShotPrompt({
      type: 'MAP',
      name: 'World map',
      attributes: { mustKeep: 'should not appear' },
      view: requireView('MAP', 'full'),
    });
    expect(prompt).not.toContain('should not appear');
  });
});

describe('asset view plans', () => {
  it('gives every visual type exactly one anchor', () => {
    for (const type of ASSET_TYPES) {
      const plan = ASSET_VIEW_PLANS[type];
      const anchors = plan.views.filter((view) => view.isAnchor);
      // The whole batch is rendered against the anchor — two would make the choice arbitrary, and
      // none would leave a sheet with nothing to stay consistent with.
      expect(anchors.length, `${type} anchors`).toBe(plan.views.length === 0 ? 0 : 1);
    }
  });

  it('selects the anchor by default wherever one exists', () => {
    for (const type of ASSET_TYPES) {
      const anchor = anchorViewOf(type);
      if (anchor) expect(anchor.defaultOn, `${type} anchor default`).toBe(true);
    }
  });

  it('keeps view ids unique within a type', () => {
    for (const type of ASSET_TYPES) {
      const ids = ASSET_VIEW_PLANS[type].views.map((view) => view.id);
      expect(new Set(ids).size, `${type} view ids`).toBe(ids.length);
    }
  });
});
