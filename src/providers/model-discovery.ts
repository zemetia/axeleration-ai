import type { ModelOption } from './catalog';
import type { Capability } from './types';

/**
 * Live "what models does this key unlock right now", per capability, for vendors that expose a
 * clean discovery endpoint. `catalog.ts` stays the fallback (no key yet, the vendor has no
 * discovery endpoint, or the live call failed) and the source of truth for every other vendor.
 *
 * Base URLs are duplicated from `adapters/{sumopod,deepseek}.adapter.ts` rather than imported —
 * those adapters pull in `ChatOpenAI` from `@langchain/openai` at module scope, and this module is
 * reachable from a Server Action that a client hook imports (same trap as `verify.ts`, see its
 * comment and the 2026-07-29 entry in LEARN.md).
 */
const SUMOPOD_BASE_URL = process.env.SUMOPOD_BASE_URL || 'https://ai.sumopod.com/v1';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';

const TIMEOUT_MS = 15_000;

/** One provider's live catalog, split by capability — a chat vendor only ever fills `llm-text`. */
export type DiscoveredCatalog = Partial<Record<Capability, ModelOption[]>>;

async function fetchJson(url: string, headers: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

// ─── Chat vendors — OpenAI-shaped `{ data: [{ id }] }` or a vendor-specific list ──────────────

/** Model ids not worth surfacing in a chat-model dropdown, across every OpenAI-shaped `/models` list. */
const NON_CHAT_MODEL = /embedding|whisper|tts|dall-e|gpt-image|moderation|davinci|babbage|curie|^ada/i;

async function openaiCompatibleChatIds(url: string, apiKey: string, keep: (id: string) => boolean): Promise<ModelOption[]> {
  const json = asRecord(await fetchJson(url, { Authorization: `Bearer ${apiKey}` }));
  const data = Array.isArray(json?.data) ? json.data : [];
  const ids = data
    .map((item) => asRecord(item)?.id)
    .filter((id): id is string => typeof id === 'string' && keep(id));
  return [...new Set(ids)].sort().map((id) => ({ id, label: id }));
}

async function asChatCatalog(models: ModelOption[]): Promise<DiscoveredCatalog> {
  return models.length ? { 'llm-text': models } : {};
}

async function discoverOpenai(apiKey: string): Promise<DiscoveredCatalog> {
  const models = await openaiCompatibleChatIds(
    'https://api.openai.com/v1/models',
    apiKey,
    (id) => id.startsWith('gpt-') && !NON_CHAT_MODEL.test(id),
  );
  return asChatCatalog(models);
}

/** DeepSeek's own model ids are whatever their `/models` endpoint says today — no local guessing (their ids have changed before, e.g. `deepseek-chat`/`deepseek-reasoner` → `deepseek-v4-flash`/`deepseek-v4-pro`). */
async function discoverDeepseek(apiKey: string): Promise<DiscoveredCatalog> {
  const models = await openaiCompatibleChatIds(`${DEEPSEEK_BASE_URL}/models`, apiKey, () => true);
  return asChatCatalog(models);
}

async function discoverSumopod(apiKey: string): Promise<DiscoveredCatalog> {
  // A gateway routes whatever id it's given (see `sumopod.adapter.ts`), so the only filter here is
  // "not obviously non-chat" — same reasoning `catalog.ts` used to hand-exclude embedding models.
  const models = await openaiCompatibleChatIds(`${SUMOPOD_BASE_URL}/models`, apiKey, (id) => !NON_CHAT_MODEL.test(id));
  return asChatCatalog(models);
}

async function discoverAnthropic(apiKey: string): Promise<DiscoveredCatalog> {
  const json = asRecord(
    await fetchJson('https://api.anthropic.com/v1/models?limit=100', {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    }),
  );
  const data = Array.isArray(json?.data) ? json.data : [];
  const models = data
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => typeof item?.id === 'string')
    .map((item) => ({
      id: item.id as string,
      label: typeof item.display_name === 'string' ? item.display_name : (item.id as string),
    }));
  return asChatCatalog(models);
}

async function discoverGoogle(apiKey: string): Promise<DiscoveredCatalog> {
  const json = asRecord(
    await fetchJson('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
      'x-goog-api-key': apiKey,
    }),
  );
  const data = Array.isArray(json?.models) ? json.models : [];
  const models = data
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => {
      const methods = Array.isArray(item?.supportedGenerationMethods) ? item.supportedGenerationMethods : [];
      const name = typeof item?.name === 'string' ? item.name : '';
      // Imagen/Veo share this endpoint under `predict`/`predictLongRunning` — out of scope here,
      // `catalog.ts` keeps those static. Only the chat-capable Gemini models qualify.
      return methods.includes('generateContent') && name.includes('gemini');
    })
    .map((item) => {
      const name = item.name as string; // "models/gemini-3-pro"
      const id = name.startsWith('models/') ? name.slice('models/'.length) : name;
      return { id, label: typeof item.displayName === 'string' ? item.displayName : id };
    });
  return asChatCatalog(models);
}

// ─── WaveSpeed — one call returns its whole catalog, already tagged with capability and price ──

const WAVESPEED_TYPE_TO_CAPABILITY: Partial<Record<string, Capability>> = {
  'text-to-image': 'text-to-image',
  'image-to-image': 'image-to-image',
  'text-to-video': 'text-to-video',
  'image-to-video': 'image-to-video',
  // `video-to-video` and `text-to-audio` have no Capability in this app — skipped, not mapped.
};

function formatUsd(amount: number): string {
  return `$${amount < 0.01 ? amount.toFixed(4) : amount.toFixed(2)}`;
}

/**
 * WaveSpeed exposes its *entire* 1,000+ model catalog from one endpoint, each entry already
 * tagged with `type` (capability) and `base_price` — unlike the chat vendors above, no per-model
 * filtering heuristic is needed, so this is the one vendor where discovery can fully replace the
 * hand-curated slice in `catalog.ts` rather than just refreshing it.
 */
async function discoverWavespeed(apiKey: string): Promise<DiscoveredCatalog> {
  const json = asRecord(
    await fetchJson('https://api.wavespeed.ai/api/v3/models', { Authorization: `Bearer ${apiKey}` }),
  );
  const data = Array.isArray(json?.data) ? json.data : [];

  const catalog: DiscoveredCatalog = {};
  for (const raw of data) {
    const item = asRecord(raw);
    const id = typeof item?.model_id === 'string' ? item.model_id : undefined;
    const capability = typeof item?.type === 'string' ? WAVESPEED_TYPE_TO_CAPABILITY[item.type] : undefined;
    if (!item || !id || !capability) continue;

    const name = typeof item.name === 'string' ? item.name : id;
    const description = typeof item.base_price === 'number' ? formatUsd(item.base_price) : undefined;
    (catalog[capability] ??= []).push({ id, label: name, description });
  }
  for (const list of Object.values(catalog)) list?.sort((a, b) => a.label.localeCompare(b.label));
  return catalog;
}

/**
 * Providers with a clean, uniformly-shaped discovery endpoint. Everything else (fal, replicate,
 * higgsfield, seedance, elevenlabs, bridged vendors…) keeps the curated static list in
 * `catalog.ts` — their APIs either have no discovery endpoint or mix capabilities in one list in
 * ways that would need a per-vendor heuristic to sort out correctly.
 */
const DISCOVERERS: Partial<Record<string, (apiKey: string) => Promise<DiscoveredCatalog>>> = {
  openai: discoverOpenai,
  deepseek: discoverDeepseek,
  sumopod: discoverSumopod,
  anthropic: discoverAnthropic,
  google: discoverGoogle,
  wavespeed: discoverWavespeed,
};

/**
 * Live catalog for a provider, split by capability, or `null` when this provider has no discovery
 * endpoint or the call failed — either way the caller falls back to `catalog.ts`.
 */
export async function discoverModels(provider: string, apiKey: string): Promise<DiscoveredCatalog | null> {
  const discover = DISCOVERERS[provider];
  if (!discover) return null;
  try {
    const catalog = await discover(apiKey);
    return Object.keys(catalog).length ? catalog : null;
  } catch {
    return null;
  }
}
