import { z } from 'zod';

/**
 * What the asset lab leaves behind on `Asset.lab`.
 *
 * A generated sheet costs real money, so the shots are persisted rather than held in the browser
 * until the tab closes: reopening an asset shows the angles it was built from, and a later
 * regeneration only pays for the views that changed. The base prompt is kept alongside them
 * because it is the input that produced the whole set — without it, "regenerate this asset" starts
 * from nothing.
 *
 * Stored as JSON (not rows) deliberately: nothing queries an individual shot, they are only ever
 * read as a set belonging to one asset.
 */

export const assetShotSchema = z.object({
  /** `AssetView.id` from `src/config/asset-views.ts`. */
  viewId: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  /** Local storage URL — never a raw vendor URL, same rule as `ProviderOutput`. */
  url: z.string().min(1),
  /** The fully composed prompt this image came from — the only way to explain a bad shot later. */
  prompt: z.string().max(6000),
  provider: z.string().max(60),
  model: z.string().max(160),
  costUsd: z.number().nonnegative().optional(),
  /** True when the shot was generated from the anchor image rather than from text alone. */
  fromReference: z.boolean().optional(),
  createdAt: z.string(),
});

export const assetLabRecordSchema = z.object({
  /** The user's own sentence — what they asked the lab for before any AI expansion. */
  basePrompt: z.string().max(4000).optional(),
  /** Handle of the STYLE asset the sheet inherited, if any. */
  styleHandle: z.string().max(60).optional(),
  shots: z.array(assetShotSchema).max(48).default([]),
});

export type AssetShot = z.infer<typeof assetShotSchema>;
export type AssetLabRecord = z.infer<typeof assetLabRecordSchema>;

/** Tolerant read: a malformed or absent record degrades to "no lab history", never to an error. */
export function parseLabRecord(raw: unknown): AssetLabRecord | null {
  if (raw === null || raw === undefined) return null;
  const parsed = assetLabRecordSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
