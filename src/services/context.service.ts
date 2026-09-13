import { prisma } from '@/lib/prisma';
import type { CharacterBibleVO, ContinuityStateVO } from '@/types/value-objects';
import type { CharacterBible, ContinuityState } from '@prisma/client';

function toCharacterBibleVO(row: CharacterBible): CharacterBibleVO {
  return {
    id: row.id,
    projectId: row.projectId,
    version: row.version,
    lockedTraits: (row.lockedTraits as Record<string, unknown>) ?? {},
    seedImageUrl: row.seedImageUrl,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toContinuityStateVO(row: ContinuityState): ContinuityStateVO {
  return {
    projectId: row.projectId,
    summary: row.summary,
    lastEpisodeNo: row.lastEpisodeNo,
    facts: (row.facts as Record<string, unknown> | null) ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const contextService = {
  async getCharacterBible(projectId: string): Promise<CharacterBibleVO | null> {
    const row = await prisma.characterBible.findUnique({ where: { projectId } });
    return row ? toCharacterBibleVO(row) : null;
  },

  /** 1:1 optional relation — creates the blank row on first read so nodes always get a value back. */
  async getContinuityState(projectId: string): Promise<ContinuityStateVO> {
    const row = await prisma.continuityState.upsert({
      where: { projectId },
      create: { projectId },
      update: {},
    });
    return toContinuityStateVO(row);
  },

  async updateContinuitySummary(projectId: string, summary: string, lastEpisodeNo: number): Promise<ContinuityStateVO> {
    const row = await prisma.continuityState.upsert({
      where: { projectId },
      create: { projectId, summary, lastEpisodeNo },
      update: { summary, lastEpisodeNo },
    });
    return toContinuityStateVO(row);
  },
};
