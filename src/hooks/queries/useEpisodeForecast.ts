'use client';

import { useQuery } from '@tanstack/react-query';

import type { EpisodeForecast, StageForecast } from '@/lib/cost-forecast';
import type { EpisodeReadiness } from '@/lib/provider-readiness';

export interface EpisodeForecastResponse {
  stages: EpisodeForecast;
  /** Whether each stage has a credential for every provider it would call — see `provider-readiness.ts`. */
  readiness: EpisodeReadiness;
  /** Keyed by scene `index` (the beat's identity), not by position. */
  scenes: Record<string, StageForecast>;
  /** `stages.SCENES` priced over only the beats with no clip yet — what "Generate remaining" costs. */
  scenesRemaining: StageForecast;
  /** How many beats that is. */
  remainingCount: number;
}

async function forecastClient(episodeId: string): Promise<EpisodeForecastResponse> {
  const res = await fetch(`/api/episodes/${episodeId}/forecast`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load cost forecast');
  return res.json() as Promise<EpisodeForecastResponse>;
}

/**
 * Prices — and preconditions — for the actions on this page. Invalidated alongside
 * `episode-stages` because editing a beat's duration or dialogue changes what the next run costs,
 * and adding the first beat is what makes SCENES start needing a video credential.
 */
export function useEpisodeForecast(episodeId: string) {
  return useQuery({
    queryKey: ['episode-forecast', episodeId],
    queryFn: () => forecastClient(episodeId),
    enabled: Boolean(episodeId),
  });
}
