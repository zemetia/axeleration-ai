import { ChatOpenAI } from '@langchain/openai';

import { putObject } from '@/lib/storage';

import type { ProviderAdapter } from '../types';
import { outputKey } from '../util';

/**
 * Sumopod is an OpenAI-compatible **gateway**, not a vendor: one key and one base URL front
 * GPT, Claude, Gemini, GLM, Qwen, DeepSeek… so it plugs in as `ChatOpenAI` + `configuration.baseURL`.
 * `.invoke()` and `.stream()` both work — the endpoint speaks SSE with `stream_options` support.
 */
export const SUMOPOD_BASE_URL = process.env.SUMOPOD_BASE_URL || 'https://ai.sumopod.com/v1';

/** Project-stored key wins; `SUMOPOD_API_KEY` is the platform-level fallback (mirrors `PLATFORM_ANTHROPIC_API_KEY`). */
export function resolveSumopodApiKey(apiKey?: string): string {
  const key = apiKey || process.env.SUMOPOD_API_KEY;
  if (!key) throw new Error('sumopod: no API key — set SUMOPOD_API_KEY or store one on the project');
  return key;
}

export interface SumopodChatModelOptions {
  apiKey?: string;
  model: string;
  temperature?: number;
}

export function createSumopodChatModel({ apiKey, model, temperature }: SumopodChatModelOptions): ChatOpenAI {
  return new ChatOpenAI({
    apiKey: resolveSumopodApiKey(apiKey),
    model,
    temperature,
    configuration: { baseURL: SUMOPOD_BASE_URL },
  });
}

/** Raw text generation outside a LangChain chain — mirrors `openai.adapter.ts`. */
export const sumopodAdapter: ProviderAdapter = {
  id: 'sumopod',
  capabilities: ['llm-text'],
  // A gateway routes whatever model id it is given — the catalog, not a prefix, is the allow-list here.
  supports: () => true,

  async run(req, ctx) {
    if (!req.prompt) throw new Error('sumopod: prompt is required');

    const model = createSumopodChatModel({ apiKey: ctx.apiKey, model: ctx.model });
    const t0 = Date.now();
    const response = await model.invoke(req.prompt, { signal: ctx.signal });
    const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const stored = await putObject(outputKey('sumopod', 'txt'), Buffer.from(text, 'utf8'));

    return {
      outputs: [{ url: stored.url, kind: 'text', meta: { text } }],
      providerMeta: { provider: 'sumopod', model: ctx.model, latencyMs: Date.now() - t0 },
    };
  },
};
