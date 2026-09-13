import { bridgeCatalogEntries } from '@/config/bridges';

import type { Capability } from './types';

export interface ModelOption {
  id: string;
  label: string;
  /** Secondary line shown under the label in the model dropdown — e.g. a live price. */
  description?: string;
}

export interface ProviderCatalogEntry {
  /** Matches `ApiKey.provider` and `ProviderAdapter.id`. */
  provider: string;
  label: string;
  models: Partial<Record<Capability, ModelOption[]>>;
}

/**
 * Drives the Settings → "AI Providers" UI (T09 `ProviderModelSelect`): one dropdown per
 * capability (Chat, Image, Video, Voice, Music), listing every provider/model that supports it.
 * All providers here are hosted APIs — no locally-run model.
 */
const builtInCatalog: ProviderCatalogEntry[] = [
  {
    provider: 'anthropic',
    label: 'Anthropic',
    models: {
      'llm-text': [
        { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
        { id: 'claude-opus-5', label: 'Claude Opus 5' },
        { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
      ],
    },
  },
  {
    provider: 'openai',
    label: 'OpenAI',
    models: {
      'llm-text': [
        { id: 'gpt-5.1', label: 'GPT-5.1' },
        { id: 'gpt-5.1-mini', label: 'GPT-5.1 Mini' },
      ],
    },
  },
  {
    // Static fallback only — `model-discovery.ts` fetches DeepSeek's live `/models` list once a
    // key is selected, and DeepSeek has renamed these ids before (`deepseek-chat`/`deepseek-reasoner`
    // → `deepseek-v4-flash`/`deepseek-v4-pro` as of 2026-07-24), so this list is not the last word.
    provider: 'deepseek',
    label: 'DeepSeek',
    models: {
      'llm-text': [
        { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
        { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
      ],
    },
  },
  {
    // OpenAI-compatible gateway — one key fronts many vendors, so model ids here are Sumopod's own
    // catalog (`GET https://ai.sumopod.com/v1/models`), not the upstream vendors' ids. Full mirror
    // of that endpoint's chat-capable models as of 2026-07-29 — re-sync periodically, it's a moving
    // resale catalog. Embedding models (`text-embedding-3-*`, `gemini/gemini-embedding-001`) are
    // excluded: this system has no `embedding` Capability to attach them to.
    provider: 'sumopod',
    label: 'Sumopod (OpenAI-compatible gateway)',
    models: {
      'llm-text': [
        { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 (Sumopod)' },
        { id: 'claude-opus-4-7', label: 'Claude Opus 4.7 (Sumopod)' },
        { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 (Sumopod)' },
        { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Sumopod)' },
        { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (Sumopod)' },
        { id: 'claude-fable-5', label: 'Claude Fable 5 (Sumopod)' },
        { id: 'gpt-5.4', label: 'GPT-5.4 (Sumopod)' },
        { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini (Sumopod)' },
        { id: 'gpt-5.4-nano', label: 'GPT-5.4 Nano (Sumopod)' },
        { id: 'gpt-5', label: 'GPT-5 (Sumopod)' },
        { id: 'gpt-5-mini', label: 'GPT-5 Mini (Sumopod)' },
        { id: 'gpt-5-nano', label: 'GPT-5 Nano (Sumopod)' },
        { id: 'gpt-4.1', label: 'GPT-4.1 (Sumopod)' },
        { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini (Sumopod)' },
        { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano (Sumopod)' },
        { id: 'gpt-4o', label: 'GPT-4o (Sumopod)' },
        { id: 'gpt-4o-mini', label: 'GPT-4o Mini (Sumopod)' },
        { id: 'gemini/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview (Sumopod)' },
        { id: 'gemini/gemini-3.5-flash', label: 'Gemini 3.5 Flash (Sumopod)' },
        { id: 'gemini/gemini-3-flash-preview', label: 'Gemini 3 Flash Preview (Sumopod)' },
        { id: 'gemini/gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (Sumopod)' },
        { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro (Sumopod)' },
        { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash (Sumopod)' },
        { id: 'qwen3.8-max-preview', label: 'Qwen 3.8 Max Preview (Sumopod)' },
        { id: 'qwen3.7-max', label: 'Qwen 3.7 Max (Sumopod)' },
        { id: 'qwen3.7-plus', label: 'Qwen 3.7 Plus (Sumopod)' },
        { id: 'qwen3.6-plus', label: 'Qwen 3.6 Plus (Sumopod)' },
        { id: 'qwen3.6-flash', label: 'Qwen 3.6 Flash (Sumopod)' },
        { id: 'glm-5.2', label: 'GLM-5.2 (Sumopod)' },
        { id: 'glm-5.1', label: 'GLM-5.1 (Sumopod)' },
        { id: 'glm-5', label: 'GLM-5 (Sumopod)' },
        { id: 'glm-5-turbo', label: 'GLM-5 Turbo (Sumopod)' },
        { id: 'glm-5v-turbo', label: 'GLM-5V Turbo (Sumopod)' },
        { id: 'kimi-k3', label: 'Kimi K3 (Sumopod)' },
        { id: 'kimi-k2.7', label: 'Kimi K2.7 (Sumopod)' },
        { id: 'kimi-k2.6', label: 'Kimi K2.6 (Sumopod)' },
        { id: 'MiniMax-M3', label: 'MiniMax M3 (Sumopod)' },
        { id: 'MiniMax-M2.7-highspeed', label: 'MiniMax M2.7 Highspeed (Sumopod)' },
        { id: 'mimo-v2.5-pro', label: 'MiMo V2.5 Pro (Sumopod)' },
        { id: 'mimo-v2.5', label: 'MiMo V2.5 (Sumopod)' },
        { id: 'seed-2-0-pro', label: 'Seed 2.0 Pro (Sumopod)' },
        { id: 'seed-2-0-code', label: 'Seed 2.0 Code (Sumopod)' },
        { id: 'seed-2-0-mini', label: 'Seed 2.0 Mini (Sumopod)' },
        { id: 'seed-2-0-lite', label: 'Seed 2.0 Lite (Sumopod)' },
        { id: 'hy3', label: 'Hunyuan 3 (Sumopod)' },
      ],
    },
  },
  {
    provider: 'google',
    label: 'Google (Gemini / Imagen / Veo)',
    models: {
      'llm-text': [{ id: 'gemini-3-pro', label: 'Gemini 3 Pro' }],
      'text-to-image': [
        { id: 'imagen-4', label: 'Imagen 4' },
        { id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image' },
      ],
      'image-to-image': [{ id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image (edit)' }],
      'text-to-video': [
        { id: 'veo-3.1-generate-preview', label: 'Veo 3.1' },
        { id: 'veo-3.1-fast-generate-preview', label: 'Veo 3.1 Fast' },
      ],
      'image-to-video': [
        { id: 'veo-3.1-generate-preview', label: 'Veo 3.1 (image-to-video)' },
        { id: 'veo-3.1-fast-generate-preview', label: 'Veo 3.1 Fast (image-to-video)' },
      ],
    },
  },
  {
    provider: 'fal',
    label: 'fal.ai',
    models: {
      'text-to-image': [{ id: 'fal-ai/flux/dev', label: 'FLUX.1 Dev' }],
      'image-to-image': [{ id: 'fal-ai/flux/dev/image-to-image', label: 'FLUX.1 Dev (image-to-image)' }],
      'text-to-video': [{ id: 'fal-ai/kling-video/v1/standard/text-to-video', label: 'Kling v1 Standard (text-to-video)' }],
      'image-to-video': [{ id: 'fal-ai/kling-video/v1/standard', label: 'Kling v1 Standard (image-to-video)' }],
    },
  },
  {
    provider: 'replicate',
    label: 'Replicate',
    models: {
      'text-to-image': [{ id: 'black-forest-labs/flux-schnell', label: 'FLUX Schnell' }],
      'image-to-video': [{ id: 'bytedance/seedance-2.0', label: 'Seedance 2.0 (via Replicate)' }],
      music: [{ id: 'meta/musicgen', label: 'MusicGen' }],
    },
  },
  {
    // Aggregator exposing 1,000+ hosted models — this is a curated slice of the vendor's most-used
    // ones per capability (`GET https://api.wavespeed.ai/api/v3/models` has the full live catalog),
    // synced against https://wavespeed.ai/models as of 2026-08-07. Re-sync periodically.
    provider: 'wavespeed',
    label: 'WaveSpeed AI',
    models: {
      'text-to-image': [
        { id: 'wavespeed-ai/z-image/turbo', label: 'Z-Image Turbo' },
        { id: 'bytedance/seedream-v5.0-pro', label: 'Seedream v5.0 Pro' },
        { id: 'google/nano-banana-pro/text-to-image', label: 'Nano Banana Pro' },
        { id: 'google/nano-banana-2/text-to-image', label: 'Nano Banana 2' },
        { id: 'openai/gpt-image-2/text-to-image', label: 'GPT Image 2' },
        { id: 'alibaba/qwen-image-3.0/text-to-image', label: 'Qwen Image 3.0' },
        { id: 'alibaba/qwen-image-3.0-pro/text-to-image', label: 'Qwen Image 3.0 Pro' },
      ],
      'image-to-image': [
        { id: 'bytedance/seedream-v5.0-pro/edit', label: 'Seedream v5.0 Pro (edit)' },
        { id: 'google/nano-banana-pro/edit', label: 'Nano Banana Pro (edit)' },
        { id: 'google/nano-banana-2/edit', label: 'Nano Banana 2 (edit)' },
        { id: 'openai/gpt-image-2/edit', label: 'GPT Image 2 (edit)' },
        { id: 'alibaba/qwen-image-3.0/edit', label: 'Qwen Image 3.0 (edit)' },
        { id: 'alibaba/qwen-image-3.0-pro/edit', label: 'Qwen Image 3.0 Pro (edit)' },
      ],
      'text-to-video': [
        { id: 'bytedance/seedance-2.0/text-to-video', label: 'Seedance 2.0 (text-to-video)' },
        { id: 'bytedance/seedance-2.0-fast/text-to-video', label: 'Seedance 2.0 Fast (text-to-video)' },
        { id: 'wavespeed-ai/minimax-h3/text-to-video', label: 'MiniMax H3 (text-to-video)' },
        { id: 'x-ai/grok-imagine-video-v1.5/text-to-video', label: 'Grok Imagine Video v1.5 (text-to-video)' },
        { id: 'black-forest-labs/flux-3/text-to-video', label: 'FLUX 3 (text-to-video)' },
      ],
      'image-to-video': [
        { id: 'bytedance/seedance-2.0/image-to-video', label: 'Seedance 2.0 (image-to-video)' },
        { id: 'bytedance/seedance-2.0-fast/image-to-video', label: 'Seedance 2.0 Fast (image-to-video)' },
        { id: 'wavespeed-ai/minimax-h3/image-to-video', label: 'MiniMax H3 (image-to-video)' },
        { id: 'x-ai/grok-imagine-video-v1.5/image-to-video', label: 'Grok Imagine Video v1.5 (image-to-video)' },
        { id: 'black-forest-labs/flux-3/image-to-video', label: 'FLUX 3 (image-to-video)' },
        { id: 'higgsfield/higgsfield-dop-image-to-video', label: 'Higgsfield DoP (image-to-video)' },
      ],
    },
  },
  {
    provider: 'higgsfield',
    label: 'Higgsfield',
    models: {
      'text-to-image': [{ id: 'soul', label: 'Higgsfield Soul (text-to-image)' }],
      'image-to-video': [
        { id: 'dop-lite', label: 'DoP Lite' },
        { id: 'dop-standard', label: 'DoP Standard' },
        { id: 'dop-turbo', label: 'DoP Turbo' },
      ],
    },
  },
  {
    provider: 'seedance',
    label: 'Seedance (ByteDance, direct)',
    models: {
      'text-to-video': [
        { id: 'doubao-seedance-2-0-260128', label: 'Seedance 2.0' },
        { id: 'doubao-seedance-2-0-fast-260128', label: 'Seedance 2.0 Fast' },
      ],
      'image-to-video': [
        { id: 'doubao-seedance-2-0-260128', label: 'Seedance 2.0' },
        { id: 'doubao-seedance-2-0-fast-260128', label: 'Seedance 2.0 Fast' },
      ],
    },
  },
  {
    provider: 'elevenlabs',
    label: 'ElevenLabs',
    models: {
      tts: [
        { id: 'eleven_multilingual_v2', label: 'Multilingual v2' },
        { id: 'eleven_flash_v2_5', label: 'Flash v2.5 (low latency)' },
      ],
    },
  },
  {
    provider: 'ffmpeg',
    label: 'Local ffmpeg (assembly only)',
    models: { 'video-assembly': [{ id: 'local', label: 'ffmpeg' }] },
  },
];

/**
 * Hand-written adapters first, then every API declared in `src/config/bridges.ts`. Bridged vendors
 * are appended rather than interleaved so the dropdown keeps a stable order as specs are added, and
 * so the built-in list stays readable as the literal it is.
 */
export const providerCatalog: ProviderCatalogEntry[] = [...builtInCatalog, ...bridgeCatalogEntries()];

export function providersFor(capability: Capability): ProviderCatalogEntry[] {
  return providerCatalog.filter((entry) => entry.models[capability]?.length);
}

export function defaultModelFor(provider: string, capability: Capability): string | undefined {
  return providerCatalog.find((entry) => entry.provider === provider)?.models[capability]?.[0]?.id;
}
