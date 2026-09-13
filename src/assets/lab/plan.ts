import { anchorViewOf, renderCountOf, viewOf } from '@/config/asset-views';
import type { AssetType } from '@prisma/client';

/**
 * How many images a selection of views actually renders, split by capability.
 *
 * Not `viewIds.length`: the anchor is a composed sheet — seven panels, seven renders — so the
 * forecast on the button would understate a run by six images without this. Shared by the new-asset
 * lab and the asset detail page, which have to quote the same number for the same click.
 */

export interface ShotPlan {
  /** Total renders the run will pay for. */
  total: number;
  /** Of those, the ones that go image-to-image against the identity rather than from text. */
  fromReference: number;
}

export function planShotCounts(
  type: AssetType,
  viewIds: readonly string[],
  hasUploadedReference: boolean,
): ShotPlan {
  const anchor = anchorViewOf(type);
  const total = viewIds.reduce((sum, id) => {
    const view = viewOf(type, id);
    return sum + (view ? renderCountOf(view) : 0);
  }, 0);

  // With an upload in hand every render is image-to-image. Without one, exactly one render is made
  // from text — the first panel of the anchor, or the anchor itself — and everything downstream,
  // including the anchor's remaining panels, is generated against it.
  if (hasUploadedReference) return { total, fromReference: total };
  const startsFromText = anchor ? viewIds.includes(anchor.id) : false;
  return { total, fromReference: Math.max(0, total - (startsFromText ? 1 : 0)) };
}
