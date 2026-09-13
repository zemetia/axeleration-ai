import { parseLabRecord } from '@/assets/lab/lab-record';
import { ASSET_TYPE_LABELS } from '@/config/asset-schema';
import { prisma } from '@/lib/prisma';
import { normalizeAssetAttributes, type AssetInput, type AssetUpdateInput } from '@/lib/validations';
import type { AssetVO } from '@/types/value-objects';
import type { Asset, AssetStatus, AssetType, Prisma } from '@prisma/client';

function toAssetVO(asset: Asset): AssetVO {
  return {
    id: asset.id,
    projectId: asset.projectId,
    type: asset.type,
    typeLabel: ASSET_TYPE_LABELS[asset.type] ?? asset.type,
    handle: asset.handle,
    name: asset.name,
    description: asset.description,
    refUrl: asset.refUrl,
    voiceId: asset.voiceId,
    attributes: normalizeAssetAttributes(asset.type, asset.metadata),
    lab: parseLabRecord(asset.lab),
    status: asset.status,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}

export interface AssetListOptions {
  type?: AssetType;
  status?: AssetStatus;
}

export const assetService = {
  async list(projectId: string, options: AssetListOptions = {}): Promise<AssetVO[]> {
    const rows = await prisma.asset.findMany({
      where: {
        projectId,
        status: options.status ?? 'ACTIVE',
        ...(options.type ? { type: options.type } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toAssetVO);
  },

  async byHandles(projectId: string, handles: string[]): Promise<AssetVO[]> {
    if (handles.length === 0) return [];
    const rows = await prisma.asset.findMany({ where: { projectId, handle: { in: handles } } });
    return rows.map(toAssetVO);
  },

  async get(projectId: string, handle: string): Promise<AssetVO | null> {
    const row = await prisma.asset.findUnique({ where: { projectId_handle: { projectId, handle } } });
    return row ? toAssetVO(row) : null;
  },

  /**
   * Scoped by project on purpose: the detail page's ownership gate is the project, so an id from
   * another project must not resolve just because the reader owns *this* one.
   */
  async byId(projectId: string, id: string): Promise<AssetVO | null> {
    const row = await prisma.asset.findFirst({ where: { id, projectId } });
    return row ? toAssetVO(row) : null;
  },

  async ownerOf(id: string): Promise<string | null> {
    const row = await prisma.asset.findUnique({
      where: { id },
      select: { project: { select: { ownerId: true } } },
    });
    return row?.project.ownerId ?? null;
  },

  async create(projectId: string, input: AssetInput): Promise<AssetVO> {
    const { lab, ...rest } = input;
    const row = await prisma.asset.create({
      data: {
        projectId,
        ...rest,
        metadata: normalizeAssetAttributes(input.type, input.metadata) as Prisma.InputJsonValue,
        ...(lab ? { lab: lab as Prisma.InputJsonValue } : {}),
      },
    });
    return toAssetVO(row);
  },

  /** `refUrl: null` clears the reference — an absent key leaves the stored one alone. */
  async update(
    id: string,
    input: Omit<AssetUpdateInput, 'id' | 'refUrl'> & { refUrl?: string | null },
  ): Promise<AssetVO> {
    // Attributes are normalized against the *incoming* type, which differs from the stored one
    // when the user re-typed the asset — normalizing against the old row would strip them all.
    const type =
      input.type ?? (await prisma.asset.findUniqueOrThrow({ where: { id }, select: { type: true } })).type;
    const { lab, ...rest } = input;
    const row = await prisma.asset.update({
      where: { id },
      data: {
        ...rest,
        ...(input.metadata
          ? { metadata: normalizeAssetAttributes(type, input.metadata) as Prisma.InputJsonValue }
          : {}),
        ...(lab ? { lab: lab as Prisma.InputJsonValue } : {}),
      },
    });
    return toAssetVO(row);
  },

  async setStatus(id: string, status: AssetStatus): Promise<AssetVO> {
    const row = await prisma.asset.update({ where: { id }, data: { status } });
    return toAssetVO(row);
  },

  async archive(id: string): Promise<AssetVO> {
    return assetService.setStatus(id, 'ARCHIVED');
  },
};
