import { ASSET_TYPE_LABELS } from '@/config/asset-schema';
import type { AssetVO } from '@/types/value-objects';

import { buildAssetProfile } from './profile';

/**
 * The list of `@handle`s a writing prompt is allowed to use.
 *
 * Every creative prompt told the model to reference assets by `@handle` and to invent none — but
 * nothing ever passed it the handles, so the whole asset library was unreachable unless the user
 * typed a mention by hand. This is the missing half: SCRIPT and scene composition get the roster,
 * `assetResolver` substitutes whatever they mention back out (see `resolver.ts`).
 */

export const NO_ASSETS_ROSTER = '(none — this project has no assets, so do not write any @handle)';

/** VOICE assets attach to TTS in `voice.node`, not to prose — mentioning one inline would splice a voice profile into a shot description. */
const WRITABLE_TYPES = (asset: AssetVO) => asset.type !== 'VOICE';

/** Enough assets to describe a cast and its world; past this the roster costs more than it buys. */
const ROSTER_LIMIT = 40;
/** A profile is one paragraph, but a heavily filled-in asset can run long — the roster only needs the identifying half. */
const PROFILE_CHARS = 240;

export interface AssetRosterOptions {
  /** Handles and names only — for stages that decide *what happens*, not what a shot looks like. */
  compact?: boolean;
}

export function buildAssetRoster(assets: AssetVO[], options: AssetRosterOptions = {}): string {
  const usable = assets.filter(WRITABLE_TYPES);
  if (usable.length === 0) return NO_ASSETS_ROSTER;

  const shown = usable.slice(0, ROSTER_LIMIT);
  const lines = shown.map((asset) => {
    const label = ASSET_TYPE_LABELS[asset.type] ?? asset.type;
    if (options.compact) return `@${asset.handle} — ${label}: ${asset.name}`;
    const profile = truncate(buildAssetProfile(asset), PROFILE_CHARS);
    // Whether an asset carries a reference image decides text-to-video vs image-to-video downstream,
    // so it is worth the model knowing which mentions actually pin the look.
    const ref = asset.refUrl ? ' [has reference image]' : '';
    return `@${asset.handle} — ${label}: ${profile}${ref}`;
  });

  const overflow = usable.length - shown.length;
  if (overflow > 0) lines.push(`(+${overflow} more assets not listed — do not guess their handles)`);

  return lines.join('\n');
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}
