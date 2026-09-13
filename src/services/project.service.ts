import { PROJECT_TYPE_LABELS } from '@/config/project-options';
import { prisma } from '@/lib/prisma';
import { estimateScenes, hasFewScenesWarning } from '@/lib/scene-estimate';
import type { ProjectInput, ProjectUpdateInput } from '@/lib/validations';
import type { ProjectVO } from '@/types/value-objects';
import type { Prisma } from '@prisma/client';

const projectWithCounts = {
  include: { _count: { select: { episodes: true, assets: true } } },
} satisfies Prisma.ProjectDefaultArgs;

type ProjectRow = Prisma.ProjectGetPayload<typeof projectWithCounts>;

function toProjectVO(row: ProjectRow): ProjectVO {
  const estimatedScenes = estimateScenes({
    targetTotalSeconds: row.targetTotalSeconds,
    sceneDurationMin: row.sceneDurationMin,
    sceneDurationMax: row.sceneDurationMax,
  });

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    typeLabel: PROJECT_TYPE_LABELS[row.type] ?? row.type,
    tags: row.tags,
    logline: row.logline ?? '',
    premise: row.premise,
    targetAudience: row.targetAudience ?? '',
    tone: row.tone ?? '',
    visualStyle: row.visualStyle ?? '',
    language: row.language,
    aspectRatio: row.aspectRatio,
    resolution: row.resolution,
    targetTotalSeconds: row.targetTotalSeconds,
    sceneDurationMin: row.sceneDurationMin,
    sceneDurationMax: row.sceneDurationMax,
    defaultResearchMode: row.defaultResearchMode,
    estimatedScenes,
    hasFewScenesWarning: hasFewScenesWarning(estimatedScenes),
    styleConfig: (row.styleConfig as Record<string, unknown> | null) ?? null,
    modelConfig: (row.modelConfig as Record<string, unknown> | null) ?? null,
    pipelineConfig: (row.pipelineConfig as Record<string, unknown> | null) ?? null,
    episodeCount: row._count.episodes,
    assetCount: row._count.assets,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * The form submits blank optional text as `''`; the column is nullable, so store `null`.
 * Keys absent from `input` stay absent, which matters for partial updates.
 */
function optionalText(input: ProjectUpdateInput) {
  const keys = ['logline', 'targetAudience', 'tone', 'visualStyle'] as const;
  const patch: { [K in (typeof keys)[number]]?: string | null } = {};
  for (const key of keys) {
    if (input[key] !== undefined) patch[key] = input[key] || null;
  }
  return patch;
}

export const projectService = {
  async list(ownerId: string): Promise<ProjectVO[]> {
    const rows = await prisma.project.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      ...projectWithCounts,
    });
    return rows.map(toProjectVO);
  },

  async get(id: string): Promise<ProjectVO | null> {
    const row = await prisma.project.findUnique({ where: { id }, ...projectWithCounts });
    return row ? toProjectVO(row) : null;
  },

  /**
   * Ownership check and fetch in a single query. Callers used to run `ownerOf(id)` and then
   * `get(id)` — two sequential round-trips reading the same row, on every project page,
   * settings page and layout. Filtering by `ownerId` in the `where` does both at once and
   * is the stricter check besides: a non-owner gets `null`, never a row.
   */
  async getForOwner(id: string, ownerId: string): Promise<ProjectVO | null> {
    const row = await prisma.project.findFirst({
      where: { id, ownerId },
      ...projectWithCounts,
    });
    return row ? toProjectVO(row) : null;
  },

  async ownerOf(id: string): Promise<string | null> {
    const row = await prisma.project.findUnique({ where: { id }, select: { ownerId: true } });
    return row?.ownerId ?? null;
  },

  async create(ownerId: string, input: ProjectInput): Promise<ProjectVO> {
    const row = await prisma.project.create({
      data: {
        ownerId,
        ...input,
        ...optionalText(input),
        styleConfig: input.styleConfig as Prisma.InputJsonValue | undefined,
        modelConfig: input.modelConfig as Prisma.InputJsonValue | undefined,
        pipelineConfig: input.pipelineConfig as Prisma.InputJsonValue | undefined,
      },
      ...projectWithCounts,
    });
    return toProjectVO(row);
  },

  async update(id: string, input: ProjectUpdateInput): Promise<ProjectVO> {
    const row = await prisma.project.update({
      where: { id },
      data: {
        ...input,
        ...optionalText(input),
        styleConfig: input.styleConfig as Prisma.InputJsonValue | undefined,
        modelConfig: input.modelConfig as Prisma.InputJsonValue | undefined,
        pipelineConfig: input.pipelineConfig as Prisma.InputJsonValue | undefined,
      },
      ...projectWithCounts,
    });
    return toProjectVO(row);
  },

  async remove(id: string): Promise<void> {
    await prisma.project.delete({ where: { id } });
  },
};
