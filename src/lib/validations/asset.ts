import { AssetType } from '@prisma/client';
import { z } from 'zod';

import { assetLabRecordSchema } from '@/assets/lab/lab-record';
import { assetFieldOf, assetFieldsOf } from '@/config/asset-schema';

export const assetHandleSchema = z
  .string()
  .min(1, 'Handle is required')
  .max(60, 'Handle is too long')
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'Use lowercase letters, numbers, and hyphens only');

/** One typed attribute value — prose fields are strings, `tags` fields are string arrays. */
export const assetAttributeValueSchema = z.union([
  z.string().max(2000, 'Value is too long'),
  z.array(z.string().max(120)).max(24),
]);

export const assetAttributesSchema = z.record(z.string(), assetAttributeValueSchema);

export type AssetAttributeValue = z.infer<typeof assetAttributeValueSchema>;
export type AssetAttributes = Record<string, AssetAttributeValue>;

export const assetSchema = z.object({
  type: z.nativeEnum(AssetType),
  handle: assetHandleSchema,
  name: z.string().min(1, 'Name is required').max(120, 'Name is too long').trim(),
  description: z.string().max(2000, 'Description is too long').optional(),
  refUrl: z.string().optional(),
  voiceId: z.string().max(120).optional(),
  metadata: assetAttributesSchema.optional(),
  /** Asset lab record — base prompt plus the generated view sheet. See `src/assets/lab/lab-record.ts`. */
  lab: assetLabRecordSchema.optional(),
});

export const assetUpdateSchema = assetSchema.partial().extend({
  id: z.string().min(1),
});

export type AssetInput = z.infer<typeof assetSchema>;
export type AssetUpdateInput = z.infer<typeof assetUpdateSchema>;

/**
 * Drops keys that do not belong to the type's schema and every empty value, so switching an
 * asset's type never leaves orphaned attributes behind in `metadata`. Shape mismatches (a string
 * where the field expects tags) are coerced rather than rejected — the source is a form, and a
 * half-filled attribute is not worth failing a save over.
 */
export function normalizeAssetAttributes(type: AssetType, raw: unknown): AssetAttributes {
  const parsed = assetAttributesSchema.safeParse(raw);
  if (!parsed.success) return {};

  const result: AssetAttributes = {};
  for (const field of assetFieldsOf(type)) {
    const value = parsed.data[field.key];
    if (value === undefined) continue;

    if (field.kind === 'tags') {
      const tags = (Array.isArray(value) ? value : value.split(','))
        .map((tag) => tag.trim())
        .filter(Boolean);
      if (tags.length > 0) result[field.key] = tags;
      continue;
    }

    const text = (Array.isArray(value) ? value.join(', ') : value).trim();
    if (text) result[field.key] = text;
  }
  return result;
}

/** `true` when the asset has anything worth showing for this attribute key. */
export function hasAssetAttribute(type: AssetType, attributes: AssetAttributes, key: string): boolean {
  if (!assetFieldOf(type, key)) return false;
  const value = attributes[key];
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}
