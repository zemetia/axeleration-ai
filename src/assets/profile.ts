import { assetSchemaOf } from '@/config/asset-schema';
import type { AssetVO } from '@/types/value-objects';

/**
 * Renders an asset as the text that replaces its `@handle` in a prompt.
 *
 * The description alone was the whole payload before typed attributes existed; it is still the
 * lead sentence, but everything the user filled in per type now follows as `Label: value`
 * clauses. Kept to one paragraph on purpose — the mention is substituted *inline*, so a
 * multi-line block would wreck the surrounding sentence.
 */
export function buildAssetProfile(asset: Pick<AssetVO, 'type' | 'name' | 'description' | 'attributes'>): string {
  const lead = asset.description?.trim() || asset.name;
  const clauses: string[] = [];

  for (const section of assetSchemaOf(asset.type).sections) {
    for (const field of section.fields) {
      // A negative-only field describes what must *not* appear; naming it here would put it in
      // front of an image model as a thing to draw.
      if (field.negativeOnly) continue;
      const value = asset.attributes[field.key];
      const text = Array.isArray(value) ? value.join(', ') : value?.trim();
      if (!text) continue;
      clauses.push(`${field.label}: ${stripTrailingPeriod(text)}`);
    }
  }

  if (clauses.length === 0) return lead;
  return `${stripTrailingPeriod(lead)} (${clauses.join('; ')})`;
}

function stripTrailingPeriod(text: string): string {
  return text.trim().replace(/\.$/, '');
}
