import type { AspectRatio, ProjectType, Resolution } from '@prisma/client';

export interface ProjectDTO {
  id: string;
  ownerId: string;
  name: string;
  type: ProjectType;
  tags: string[];
  logline: string | null;
  premise: string;
  targetAudience: string | null;
  tone: string | null;
  visualStyle: string | null;
  language: string;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  targetTotalSeconds: number;
  sceneDurationMin: number;
  sceneDurationMax: number;
  styleConfig: Record<string, unknown> | null;
  modelConfig: Record<string, unknown> | null;
  episodeCount: number;
  assetCount: number;
  createdAt: Date;
  updatedAt: Date;
}
