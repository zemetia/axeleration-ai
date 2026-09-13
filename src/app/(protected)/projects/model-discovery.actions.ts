'use server';

import { requireAuth } from '@/lib/auth';
import { apiKeyService } from '@/services';
import type { DiscoveredCatalog } from '@/providers/model-discovery';

/*
 * Lazy-imported for the same reason `settings/actions.ts` lazy-loads `@/providers/verify`: this
 * file is in the client's module graph (`useProviderModels` → `ProviderModelSelect`), and a static
 * import lands in that bundle whether or not the call ever runs. `model-discovery.ts` itself is
 * light, but keeping the import lazy means it stays that way even if it grows a heavier dependency
 * later without anyone noticing the bundle cost.
 */
async function discoverer() {
  return import('@/providers/model-discovery');
}

/**
 * Live model catalog (by capability) for a provider, scoped to one of the current user's own
 * saved keys. Returns `null` (never throws) whenever a live list isn't available — no key
 * selected yet, the key doesn't belong to the caller, the provider has no discovery endpoint, or
 * the call failed — so the model dropdown can always fall back to the static `catalog.ts` list.
 */
export async function listProviderModelsAction(provider: string, apiKeyId?: string): Promise<DiscoveredCatalog | null> {
  if (!apiKeyId) return null;
  const session = await requireAuth();

  const secret = await apiKeyService.getDecryptedForUser(apiKeyId, session.user.id);
  if (!secret || secret.provider !== provider) return null;

  const { discoverModels } = await discoverer();
  return discoverModels(provider, secret.plaintext);
}
