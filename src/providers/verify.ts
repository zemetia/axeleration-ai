/** Pure data (spec objects only) — safe to import here, unlike the adapters. See the note below. */
import { bridgeVerifyProbes } from '@/config/bridges';

/**
 * Does this API key actually work?
 *
 * Saving a key used to be unconditional: the form said "Saved." whatever the string was, and the
 * first real signal arrived minutes into a run as `401` buried inside a FAILED stage on attempt 5.
 * The key is verifiable the moment it is pasted, so it is verified then.
 *
 * Each probe is the cheapest authenticated read the provider offers — a model/voice list, never a
 * generation. The point is to separate "this credential is rejected" from "this credential is fine
 * but something else went wrong", so the three outcomes are distinct: `valid`, `invalid` (the
 * provider said 401/403), and `unknown` (network error, timeout, or an endpoint we cannot probe).
 * `unknown` must never block a save — an offline machine is not a bad key.
 */

/**
 * Read from the environment rather than imported from `sumopod.adapter.ts`, which also exports it.
 * This module is reachable from a Server Action that a client hook imports, and the adapter pulls
 * `ChatOpenAI` — so importing the constant would drag LangChain into the settings bundle. Same
 * trap as the `'use server'` incident in LEARN.md; the two must be kept in sync by hand.
 */
const SUMOPOD_BASE_URL = process.env.SUMOPOD_BASE_URL || 'https://ai.sumopod.com/v1';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';

export type VerifyOutcome = 'valid' | 'invalid' | 'unknown';

export interface VerifyResult {
  outcome: VerifyOutcome;
  /** Human-facing detail: the provider's own words where useful, ours otherwise. */
  detail: string;
}

/** A probe is a URL plus the header shape that provider authenticates with. */
interface Probe {
  url: string;
  headers: (apiKey: string) => Record<string, string>;
}

const PROBES: Record<string, Probe> = {
  anthropic: {
    url: 'https://api.anthropic.com/v1/models?limit=1',
    headers: (apiKey) => ({ 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }),
  },
  openai: {
    url: 'https://api.openai.com/v1/models',
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
  },
  deepseek: {
    url: `${DEEPSEEK_BASE_URL}/models`,
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
  },
  sumopod: {
    // The gateway is OpenAI-compatible, so its own `/models` is both the auth check and the
    // authoritative list of what it actually fronts (see the 2026-07-29 note in THIS.md).
    url: `${SUMOPOD_BASE_URL}/models`,
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
  },
  google: {
    url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',
    headers: (apiKey) => ({ 'x-goog-api-key': apiKey }),
  },
  fal: {
    url: 'https://rest.alpha.fal.ai/tokens/whoami',
    headers: (apiKey) => ({ Authorization: `Key ${apiKey}` }),
  },
  replicate: {
    url: 'https://api.replicate.com/v1/account',
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
  },
  elevenlabs: {
    url: 'https://api.elevenlabs.io/v1/user',
    headers: (apiKey) => ({ 'xi-api-key': apiKey }),
  },
  wavespeed: {
    url: 'https://api.wavespeed.ai/api/v3/balance',
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
  },
};

const TIMEOUT_MS = 10_000;

/**
 * Probe for a bridged API (`src/config/bridges.ts`), built from its `verify` block. Same three
 * outcomes as a built-in probe — a bridge that declared no `verify` simply has no probe and its key
 * saves as `unknown`, which is the honest answer rather than a fabricated pass.
 */
function bridgeProbe(provider: string): Probe | undefined {
  const spec = bridgeVerifyProbes()[provider];
  if (!spec) return undefined;
  return {
    url: spec.url,
    headers: (apiKey) => ({ [spec.header]: spec.format.replaceAll('{{apiKey}}', apiKey) }),
  };
}

export async function verifyApiKey(provider: string, apiKey: string): Promise<VerifyResult> {
  const probe = PROBES[provider] ?? bridgeProbe(provider);
  if (!probe) {
    return {
      outcome: 'unknown',
      detail: `Saved. There is no cheap way to test a ${provider} key, so it will be proven by the first run.`,
    };
  }
  if (!apiKey.trim()) {
    return { outcome: 'invalid', detail: 'The key is empty.' };
  }

  try {
    const res = await fetch(probe.url, {
      headers: probe.headers(apiKey),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });

    if (res.ok) {
      return { outcome: 'valid', detail: `${provider} accepted the key.` };
    }
    if (res.status === 401 || res.status === 403) {
      // The provider's own message names the actual problem — expired, revoked, wrong project,
      // out of credit — which a generic "invalid key" would throw away.
      const body = await res.text().catch(() => '');
      return {
        outcome: 'invalid',
        detail: providerMessage(body) ?? `${provider} rejected the key (${res.status}).`,
      };
    }
    if (res.status === 429) {
      // Rate limited means authenticated: the key got far enough to be counted.
      return { outcome: 'valid', detail: `${provider} accepted the key (rate limited right now).` };
    }
    return {
      outcome: 'unknown',
      detail: `${provider} answered ${res.status}. The key may still be fine.`,
    };
  } catch (err) {
    const reason =
      err instanceof Error && err.name === 'TimeoutError' ? 'timed out' : 'could not be reached';
    return {
      outcome: 'unknown',
      detail: `${provider} ${reason}. The key was saved but not tested.`,
    };
  }
}

/** Pulls the provider's own error text out of a JSON body, if it put one there. */
function providerMessage(body: string): string | null {
  if (!body) return null;
  try {
    const parsed: unknown = JSON.parse(body);
    const message = findMessage(parsed);
    return message ? message.slice(0, 200) : null;
  } catch {
    return body.trim().slice(0, 200) || null;
  }
}

function findMessage(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  for (const key of ['message', 'error', 'detail', 'error_message']) {
    const found = findMessage(record[key]);
    if (found) return found;
  }
  return null;
}
