import { describe, expect, it } from 'vitest';

import { anchorViewOf, defaultViewIdsOf, renderCountOf } from '@/config/asset-views';

import { planShotCounts } from './plan';

describe('planShotCounts', () => {
  it('counts the anchor as one render per panel', () => {
    const anchor = anchorViewOf('CHARACTER');
    const panels = anchor?.panels?.length ?? 0;
    expect(panels).toBeGreaterThan(1);

    const plan = planShotCounts('CHARACTER', [anchor?.id ?? '', 'full-front'], false);
    // Quoting two views as two images is how a seven-panel anchor becomes a surprise on the bill.
    expect(plan.total).toBe(panels + 1);
    // Exactly one render starts from text — the anchor's first panel. Everything after it,
    // including the anchor's own remaining panels, is image-to-image.
    expect(plan.fromReference).toBe(panels);
  });

  it('makes every render image-to-image once a reference is uploaded', () => {
    const plan = planShotCounts('CHARACTER', defaultViewIdsOf('CHARACTER'), true);
    expect(plan.fromReference).toBe(plan.total);
  });

  it('leaves uncomposed types at one render per view', () => {
    const ids = defaultViewIdsOf('LOCATION');
    expect(planShotCounts('LOCATION', ids, false).total).toBe(ids.length);

    const anchor = anchorViewOf('LOCATION');
    expect(anchor && renderCountOf(anchor)).toBe(1);
  });
});
