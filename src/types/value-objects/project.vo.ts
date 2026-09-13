import type { AspectRatio, ProjectType, ResearchMode, Resolution } from '@prisma/client';

export interface ProjectVO {
  id: string;
  name: string;
  type: ProjectType;
  typeLabel: string;
  tags: string[];
  logline: string;
  premise: string;
  targetAudience: string;
  tone: string;
  visualStyle: string;
  language: string;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  targetTotalSeconds: number;
  sceneDurationMin: number;
  sceneDurationMax: number;
  defaultResearchMode: ResearchMode;
  estimatedScenes: number;
  hasFewScenesWarning: boolean;
  styleConfig: Record<string, unknown> | null;
  modelConfig: Record<string, unknown> | null;
  pipelineConfig: Record<string, unknown> | null;
  episodeCount: number;
  assetCount: number;
  createdAt: string;
  updatedAt: string;
}
