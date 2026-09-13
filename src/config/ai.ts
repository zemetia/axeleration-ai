/**
 * Static AI config: default provider/model per capability, generation limits, cost table.
 * Per-project overrides live in `Project.modelConfig` (Prisma) and win over these defaults —
 * see `providerRegistry.select()` in `src/providers/registry.ts`.
 */

import { bridgeCostTable } from './bridges';

export const aiConfig = {
  defaults: {
    llmText: { provider: 'anthropic', model: 'claude-sonnet-5' },
    textToImage: { provider: 'fal', model: 'fal-ai/flux/dev' },
    imageToImage: { provider: 'fal', model: 'fal-ai/flux/dev/image-to-image' },
    textToVideo: { provider: 'wavespeed', model: 'bytedance/seedance-2.0/text-to-video' },
    imageToVideo: { provider: 'higgsfield', model: 'dop-standard' },
    tts: { provider: 'elevenlabs', model: 'eleven_multilingual_v2' },
    music: { provider: 'replicate', model: 'meta/musicgen' },
    videoAssembly: { provider: 'ffmpeg', model: 'local' },
  },

  limits: {
    sceneConcurrency: 3,
    maxScenesPerEpisode: 60,
    maxRegenPerStage: 10,
    /** Hard cap on `web_search` calls per research agent run — bounds latency and keeps the ReAct loop from wandering. */
    researchMaxSearches: 6,
    /** Default results per search call — enough to pick from, small enough not to flood the context. */
    researchMaxResults: 5,
    /** Chars of page/response text handed back per read tool call. */
    researchPageChars: 6000,
  },

  /**
   * Coarse per-unit USD pricing used to compute `EpisodeStage.costEstimate`.
   * `per`: 'image' | 'second' (video/audio) | '1kchars' (tts) | 'call' (flat).
   * Order-of-magnitude accuracy only — enough for a "why is my bill this size" view.
   */
  costTable: {
    anthropic: { 'claude-sonnet-5': { per: '1kchars', usd: 0.003 } },
    openai: { 'gpt-5.1': { per: '1kchars', usd: 0.003 } },
    // Same order of magnitude as the resold copies in the `sumopod` table below — keep the two in step.
    deepseek: {
      'deepseek-v4-flash': { per: '1kchars', usd: 0.0004 },
      'deepseek-v4-pro': { per: '1kchars', usd: 0.001 },
    },
    // Gateway resale pricing tracks the upstream vendor closely — same order of magnitude as calling
    // them direct. Mirrors the model list in `catalog.ts`; re-sync together.
    sumopod: {
      'claude-opus-4-8': { per: '1kchars', usd: 0.015 },
      'claude-opus-4-7': { per: '1kchars', usd: 0.015 },
      'claude-sonnet-5': { per: '1kchars', usd: 0.003 },
      'claude-sonnet-4-6': { per: '1kchars', usd: 0.003 },
      'claude-haiku-4-5': { per: '1kchars', usd: 0.001 },
      'claude-fable-5': { per: '1kchars', usd: 0.003 },
      'gpt-5.4': { per: '1kchars', usd: 0.003 },
      'gpt-5.4-mini': { per: '1kchars', usd: 0.0006 },
      'gpt-5.4-nano': { per: '1kchars', usd: 0.0002 },
      'gpt-5': { per: '1kchars', usd: 0.003 },
      'gpt-5-mini': { per: '1kchars', usd: 0.0006 },
      'gpt-5-nano': { per: '1kchars', usd: 0.0002 },
      'gpt-4.1': { per: '1kchars', usd: 0.003 },
      'gpt-4.1-mini': { per: '1kchars', usd: 0.0006 },
      'gpt-4.1-nano': { per: '1kchars', usd: 0.0002 },
      'gpt-4o': { per: '1kchars', usd: 0.0025 },
      'gpt-4o-mini': { per: '1kchars', usd: 0.0002 },
      'gemini/gemini-3.1-pro-preview': { per: '1kchars', usd: 0.0025 },
      'gemini/gemini-3.5-flash': { per: '1kchars', usd: 0.0004 },
      'gemini/gemini-3-flash-preview': { per: '1kchars', usd: 0.0004 },
      'gemini/gemini-3.1-flash-lite': { per: '1kchars', usd: 0.0002 },
      'deepseek-v4-pro': { per: '1kchars', usd: 0.001 },
      'deepseek-v4-flash': { per: '1kchars', usd: 0.0004 },
      'qwen3.8-max-preview': { per: '1kchars', usd: 0.0016 },
      'qwen3.7-max': { per: '1kchars', usd: 0.0016 },
      'qwen3.7-plus': { per: '1kchars', usd: 0.0008 },
      'qwen3.6-plus': { per: '1kchars', usd: 0.0008 },
      'qwen3.6-flash': { per: '1kchars', usd: 0.0003 },
      'glm-5.2': { per: '1kchars', usd: 0.0016 },
      'glm-5.1': { per: '1kchars', usd: 0.0016 },
      'glm-5': { per: '1kchars', usd: 0.0016 },
      'glm-5-turbo': { per: '1kchars', usd: 0.0006 },
      'glm-5v-turbo': { per: '1kchars', usd: 0.0006 },
      'kimi-k3': { per: '1kchars', usd: 0.0016 },
      'kimi-k2.7': { per: '1kchars', usd: 0.0012 },
      'kimi-k2.6': { per: '1kchars', usd: 0.0012 },
      'MiniMax-M3': { per: '1kchars', usd: 0.0016 },
      'MiniMax-M2.7-highspeed': { per: '1kchars', usd: 0.0008 },
      'mimo-v2.5-pro': { per: '1kchars', usd: 0.0016 },
      'mimo-v2.5': { per: '1kchars', usd: 0.0008 },
      'seed-2-0-pro': { per: '1kchars', usd: 0.0016 },
      'seed-2-0-code': { per: '1kchars', usd: 0.0016 },
      'seed-2-0-mini': { per: '1kchars', usd: 0.0006 },
      'seed-2-0-lite': { per: '1kchars', usd: 0.0004 },
      hy3: { per: '1kchars', usd: 0.0012 },
    },
    google: {
      'gemini-3-pro': { per: '1kchars', usd: 0.003 },
      'imagen-4': { per: 'image', usd: 0.04 },
      'gemini-2.5-flash-image': { per: 'image', usd: 0.02 },
      'veo-3.1-generate-preview': { per: 'second', usd: 0.4 },
      'veo-3.1-fast-generate-preview': { per: 'second', usd: 0.15 },
    },
    fal: {
      'fal-ai/flux/dev': { per: 'image', usd: 0.025 },
      'fal-ai/flux/dev/image-to-image': { per: 'image', usd: 0.025 },
      'fal-ai/kling-video/v1/standard': { per: 'second', usd: 0.1 },
    },
    replicate: {
      'meta/musicgen': { per: 'second', usd: 0.02 },
    },
    wavespeed: {
      'bytedance/seedance-2.0/text-to-video': { per: 'second', usd: 0.3 },
      'bytedance/seedance-2.0/image-to-video': { per: 'second', usd: 0.3 },
    },
    higgsfield: {
      'dop-lite': { per: 'call', usd: 0.125 },
      'dop-standard': { per: 'call', usd: 0.406 },
      'dop-turbo': { per: 'call', usd: 0.563 },
    },
    seedance: {
      'doubao-seedance-2-0-260128': { per: 'second', usd: 0.3 },
      'doubao-seedance-2-0-fast-260128': { per: 'second', usd: 0.12 },
    },
    elevenlabs: {
      eleven_multilingual_v2: { per: '1kchars', usd: 0.18 },
    },
    // Bridged APIs price themselves in their own spec (`BridgeSpec.cost`). Spread last so a bridge
    // can only ever add a provider id, never silently reprice a hand-written one.
    ...bridgeCostTable(),
  } as Record<string, Record<string, { per: 'image' | 'second' | '1kchars' | 'call'; usd: number }>>,
} as const;

export type AiConfig = typeof aiConfig;
