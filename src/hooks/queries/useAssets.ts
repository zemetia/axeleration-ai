'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { setAssetStatusAction, upsertAssetAction } from '@/app/(protected)/projects/[id]/assets/actions';
import type { AssetVO } from '@/types/value-objects';
import type { AssetStatus, AssetType } from '@prisma/client';

import { getJson } from './fetcher';

export function useAssets(projectId: string, type?: AssetType, status?: AssetStatus) {
  const search = new URLSearchParams();
  if (type) search.set('type', type);
  if (status) search.set('status', status);
  const query = search.toString() ? `?${search}` : '';

  return useQuery({
    queryKey: ['assets', projectId, type ?? 'all', status ?? 'ACTIVE'],
    queryFn: () => getJson<AssetVO[]>(`/api/projects/${projectId}/assets${query}`),
    enabled: Boolean(projectId),
  });
}

export function useUpsertAsset(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => upsertAssetAction(projectId, formData),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['assets', projectId] }),
  });
}

export function useSetAssetStatus(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId, status }: { assetId: string; status: AssetStatus }) =>
      setAssetStatusAction(projectId, assetId, status),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['assets', projectId] }),
  });
}
