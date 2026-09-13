'use server';

import { requireAuth } from '@/lib/auth';
import { apiKeySchema } from '@/lib/validations';
import { apiKeyService } from '@/services';
import type { VerifyOutcome } from '@/providers/verify';

export interface ActionResult {
  errors?: Record<string, string[]>;
  message?: string;
}

export interface SaveApiKeyResult extends ActionResult {
  /** What the provider said when the key was tested. Absent only when validation failed first. */
  verification?: { outcome: VerifyOutcome; detail: string };
}

/*
 * `@/providers/verify` is loaded lazily for the same reason the episode actions lazy-load Inngest:
 * `useSaveApiKey` is a client hook that imports this module, so anything imported here statically
 * lands in the settings page's bundle graph. `'use server'` is a runtime boundary, not a
 * compile-time one — see LEARN.md, 2026-07-29.
 */
async function verifier() {
  return import('@/providers/verify');
}

/**
 * Saves a key and tells the user whether it actually works.
 *
 * A rejected key is not saved: storing a credential the provider just refused only guarantees the
 * failure resurfaces later as a FAILED stage, which is exactly the loop this replaces. A key that
 * could not be *tested* (offline, provider down, no probe for that provider) is saved and reported
 * as untested — being unable to reach a provider is not evidence against the key.
 */
export async function saveApiKeyAction(input: unknown): Promise<SaveApiKeyResult> {
  const session = await requireAuth();

  const parsed = apiKeySchema.safeParse(input);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { verifyApiKey } = await verifier();
  const verification = await verifyApiKey(parsed.data.provider, parsed.data.apiKey);

  if (verification.outcome === 'invalid') {
    return { verification, errors: { apiKey: [verification.detail] } };
  }

  await apiKeyService.create(session.user.id, parsed.data.provider, parsed.data.apiKey, parsed.data.label);
  return { verification };
}

/**
 * Re-tests a key that is already saved. The reason this exists separately from the save path: a key
 * is valid when pasted and dead three weeks later — revoked, expired, out of credit — and nothing
 * in the app would say so until a run failed. Decrypts server-side; the plaintext never leaves here.
 */
export async function testApiKeyAction(id: string): Promise<SaveApiKeyResult> {
  const session = await requireAuth();

  const secret = await apiKeyService.getDecryptedForUser(id, session.user.id);
  if (!secret) {
    return { message: 'Forbidden' };
  }

  const { verifyApiKey } = await verifier();
  return { verification: await verifyApiKey(secret.provider, secret.plaintext) };
}

export async function deleteApiKeyAction(id: string): Promise<ActionResult> {
  const session = await requireAuth();

  const removed = await apiKeyService.remove(id, session.user.id);
  if (!removed) {
    return { message: 'Forbidden' };
  }
  return {};
}
