import type { AssetStatus, AssetType } from '@prisma/client';

export interface AssetDTO {
  id: string;
  projectId: string;
  type: AssetType;
  handle: string;
  name: string;
  description: string | null;
  refUrl: string | null;
  voiceId: string | null;
  metadata: Record<string, unknown> | null;
  status: AssetStatus;
  createdAt: Date;
  updatedAt: Date;
}
