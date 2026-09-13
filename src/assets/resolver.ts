import { assetService } from '@/services';
import type { AssetVO } from '@/types/value-objects';
import type { AssetRef } from '@/providers/types';

import { extractMentions } from './mention';
import { buildAssetProfile } from './profile';

export interface ResolveResult {
  /** `text` with every known `@handle` replaced by the asset's canonical description. */
  rewritten: string;
  /** Deduped references to attach to the provider call. */
  refs: AssetRef[];
  /** Handles with no matching asset — surfaced to the UI as a non-blocking warning. */
  unknown: string[];
}

function toAssetRef(asset: AssetVO): AssetRef {
  return {
    handle: asset.handle,
    type: asset.type,
    refUrl: asset.refUrl ?? undefined,
    voiceId: asset.voiceId ?? undefined,
    description: buildAssetProfile(asset),
  };
}

export const assetResolver = {
  async resolve(projectId: string, text: string): Promise<ResolveResult> {
    const handles = extractMentions(text);
    if (handles.length === 0) return { rewritten: text, refs: [], unknown: [] };

    const assets = await assetService.byHandles(projectId, handles);
    const byHandle = new Map(assets.map((asset) => [asset.handle, asset]));

    let rewritten = text;
    const refs: AssetRef[] = [];
    const unknown: string[] = [];

    for (const handle of handles) {
      const asset = byHandle.get(handle);
      if (!asset) {
        unknown.push(handle);
        continue;
      }
      rewritten = rewritten.replaceAll(`@${handle}`, buildAssetProfile(asset));
      refs.push(toAssetRef(asset));
    }

    return { rewritten, refs, unknown };
  },
};

/** Splits resolved refs by how they attach to a `ProviderRequest` (image/video refs vs. TTS voice). */
export function splitRefsForRequest(refs: AssetRef[]): { referenceImages: AssetRef[]; voiceId?: string } {
  return {
    referenceImages: refs.filter((ref) => ref.type !== 'VOICE'),
    voiceId: refs.find((ref) => ref.type === 'VOICE')?.voiceId,
  };
}
