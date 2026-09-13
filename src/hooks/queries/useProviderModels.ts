'use client';

import { useQuery } from '@tanstack/react-query';

import { listProviderModelsAction } from '@/app/(protected)/projects/model-discovery.actions';

/**
 * Live model catalog (by capability) for a provider, keyed by which saved key is selected — a
 * different key can unlock a different model set. One fetch covers every capability a vendor
 * offers (a single WaveSpeed call, say, covers its image *and* video rows), so `ProviderModelSelect`
 * slices out the capability it needs rather than this hook taking one. `null`/`undefined` inputs
 * and a `null` result (no live catalog for this provider) both resolve to "nothing to show" —
 * `ProviderModelSelect` falls back to `catalog.ts` in that case.
 */
export function useProviderModels(provider: string | undefined, apiKeyId: string | undefined) {
  return useQuery({
    queryKey: ['provider-models', provider, apiKeyId],
    queryFn: () => listProviderModelsAction(provider ?? '', apiKeyId),
    enabled: Boolean(provider && apiKeyId),
    staleTime: 5 * 60 * 1000,
  });
}
