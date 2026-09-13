import type { AssetLabRecord } from '@/assets/lab/lab-record';
import type { AssetAttributes } from '@/lib/validations/asset';
import type { AssetStatus, AssetType } from '@prisma/client';

export interface AssetVO {
  id: string;
  projectId: string;
  type: AssetType;
  typeLabel: string;
  handle: string;
  name: string;
  description: string | null;
  refUrl: string | null;
  voiceId: string | null;
  /** Typed per-type fields from `src/config/asset-schema.ts`, stored in `Asset.metadata`. */
  attributes: AssetAttributes;
  /** Base prompt and generated view sheet from the asset lab — `null` for hand-written assets. */
  lab: AssetLabRecord | null;
  status: AssetStatus;
  createdAt: string;
  updatedAt: string;
}
