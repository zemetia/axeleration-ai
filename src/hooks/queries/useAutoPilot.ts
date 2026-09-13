'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  cancelEpisodeRunAction,
  startAutoPilotAction,
  stopAutoPilotAction,
} from '@/app/(protected)/projects/[id]/episodes/actions';
import type { EpisodeWithStagesVO } from '@/types/value-objects';

import { getJson } from './fetcher';

/**
 * The episode row itself, polled while auto-pilot is running.
 *
 * Polling stops the moment the run does, rather than running on a fixed interval: an idle control
 * room should cost nothing, and the rate limiter in `src/proxy/rate-limit.ts` has to accommodate
 * this app's own polling (LEARN.md, 2026-07-28).
 */
export function useEpisode(episodeId: string, initialData?: EpisodeWithStagesVO) {
  return useQuery({
    queryKey: ['episode', episodeId],
    queryFn: () => getJson<EpisodeWithStagesVO>(`/api/episodes/${episodeId}`),
    enabled: Boolean(episodeId),
    ...(initialData ? { initialData } : {}),
    refetchInterval: (query) => (query.state.data?.autoPilot.isRunning ? 4000 : false),
  });
}

/**
 * Invalidates everything auto-pilot moves. It approves stages and starts generation, so the stage
 * list, the scene cards and the forecast are all downstream of it.
 */
function useAutoPilotMutation<TInput>(
  episodeId: string,
  mutationFn: (input: TInput) => Promise<{ message?: string }>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['episode', episodeId] });
      queryClient.invalidateQueries({ queryKey: ['episode-stages', episodeId] });
      queryClient.invalidateQueries({ queryKey: ['episode-scenes', episodeId] });
      queryClient.invalidateQueries({ queryKey: ['episode-forecast', episodeId] });
    },
  });
}

export function useStartAutoPilot(episodeId: string) {
  return useAutoPilotMutation(episodeId, (budgetUsd: number) =>
    startAutoPilotAction(episodeId, budgetUsd),
  );
}

export function useStopAutoPilot(episodeId: string) {
  return useAutoPilotMutation(episodeId, () => stopAutoPilotAction(episodeId));
}

/**
 * Stops the run itself, not just auto-pilot. Shares the invalidation set because a cancel settles
 * stage and scene rows as well as the episode.
 */
export function useCancelEpisodeRun(episodeId: string) {
  return useAutoPilotMutation(episodeId, () => cancelEpisodeRunAction(episodeId));
}
