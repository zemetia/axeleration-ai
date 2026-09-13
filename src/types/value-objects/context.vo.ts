export interface CharacterBibleVO {
  id: string;
  projectId: string;
  version: number;
  lockedTraits: Record<string, unknown>;
  seedImageUrl: string | null;
  status: string;
  updatedAt: string;
}

export interface ContinuityStateVO {
  projectId: string;
  summary: string;
  lastEpisodeNo: number;
  facts: Record<string, unknown> | null;
  updatedAt: string;
}
