import type { EpisodeStatus, StageKind, StageStatus } from '@prisma/client';

export interface EpisodeStageDTO {
  id: string;
  episodeId: string;
  kind: StageKind;
  status: StageStatus;
  attempt: number;
  output: Record<string, unknown> | null;
  error: string | null;
  costEstimate: number | null;
  providerMeta: Record<string, unknown> | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EpisodeDTO {
  id: string;
  projectId: string;
  number: number;
  title: string | null;
  status: EpisodeStatus;
  graphThreadId: string | null;
  finalVideoUrl: string | null;
  totalCost: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EpisodeWithStagesDTO extends EpisodeDTO {
  stages: EpisodeStageDTO[];
}
