'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { generateEpisodeAction } from '@/app/(protected)/projects/[id]/episodes/actions';
import type { CreateEpisodeInput } from '@/services/episode.service';
import type { EpisodeVO } from '@/types/value-objects';

import { getJson } from './fetcher';

export function useEpisodes(projectId: string, initialData?: EpisodeVO[]) {
  return useQuery({
    queryKey: ['episodes', projectId],
    queryFn: () => getJson<EpisodeVO[]>(`/api/projects/${projectId}/episodes`),
    enabled: Boolean(projectId),
    ...(initialData && { initialData }),
  });
}

export function useGenerateEpisode(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEpisodeInput = {}) => generateEpisodeAction(projectId, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['episodes', projectId] }),
  });
}
