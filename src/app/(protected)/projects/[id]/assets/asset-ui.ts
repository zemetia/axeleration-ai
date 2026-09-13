import { Compass, Image, Map, Mic2, Package, Sparkles, User, UserRound, type LucideIcon } from 'lucide-react';

import { assetSchemaOf } from '@/config/asset-schema';
import type { AssetVO } from '@/types/value-objects';
import type { AssetType } from '@prisma/client';

export interface AssetAccent {
  icon: LucideIcon;
  /** Text/icon colour class — token-backed, one hue per type (see globals.css). */
  text: string;
  /** 10%-alpha wash for chips and empty image placeholders. */
  surface: string;
  border: string;
}

export const ASSET_TYPE_ACCENTS: Record<AssetType, AssetAccent> = {
  CHARACTER: {
    icon: User,
    text: 'text-asset-character',
    surface: 'bg-asset-character-subtle',
    border: 'border-asset-character',
  },
  PERSON: {
    icon: UserRound,
    text: 'text-asset-person',
    surface: 'bg-asset-person-subtle',
    border: 'border-asset-person',
  },
  STYLE: { icon: Sparkles, text: 'text-asset-style', surface: 'bg-asset-style-subtle', border: 'border-asset-style' },
  LOCATION: {
    icon: Compass,
    text: 'text-asset-location',
    surface: 'bg-asset-location-subtle',
    border: 'border-asset-location',
  },
  AMBIENCE: {
    icon: Image,
    text: 'text-asset-ambience',
    surface: 'bg-asset-ambience-subtle',
    border: 'border-asset-ambience',
  },
  MAP: { icon: Map, text: 'text-asset-map', surface: 'bg-asset-map-subtle', border: 'border-asset-map' },
  PROP: { icon: Package, text: 'text-asset-prop', surface: 'bg-asset-prop-subtle', border: 'border-asset-prop' },
  VOICE: { icon: Mic2, text: 'text-asset-voice', surface: 'bg-asset-voice-subtle', border: 'border-asset-voice' },
};

export function accentOf(type: AssetType): AssetAccent {
  return ASSET_TYPE_ACCENTS[type];
}

/** Flattens an attribute value for search and chip display. */
export function attributeText(value: string | string[] | undefined): string {
  if (!value) return '';
  return Array.isArray(value) ? value.join(', ') : value;
}

export interface AssetHighlight {
  key: string;
  label: string;
  value: string;
}

/** The identifying attributes a card shows under the name — empty ones drop out. */
export function highlightsOf(asset: AssetVO): AssetHighlight[] {
  const schema = assetSchemaOf(asset.type);
  const fields = schema.sections.flatMap((section) => section.fields);

  return schema.highlightKeys
    .map((key) => ({
      key,
      label: fields.find((field) => field.key === key)?.label ?? key,
      value: attributeText(asset.attributes[key]),
    }))
    .filter((highlight) => highlight.value.length > 0);
}

/** Everything a search query should match against — handle, name, prose, and every attribute. */
export function searchTextOf(asset: AssetVO): string {
  return [asset.handle, asset.name, asset.description ?? '', asset.typeLabel]
    .concat(Object.values(asset.attributes).map(attributeText))
    .join(' ')
    .toLowerCase();
}
