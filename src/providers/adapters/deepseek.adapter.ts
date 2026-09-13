import { ChatOpenAI } from '@langchain/openai';

import { putObject } from '@/lib/storage';

import type { ProviderAdapter } from '../types';
import { outputKey } from '../util';

/**
 * DeepSeek's API is OpenAI-compatible, so it plugs in as `ChatOpenAI` + `configuration.baseURL`
 * (same trick as `sumopod.adapter.ts`) instead of needing its own SDK.
 */
export const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';

/** Project-stored key wins; `DEEPSEEK_API_KEY` is the platform-level fallback (mirrors `SUMOPOD_API_KEY`). */
export function resolveDeepseekApiKey(apiKey?: string): string {
  const key = apiKey || process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('deepseek: no API key — set DEEPSEEK_API_KEY or store one on the project');
  return key;
}

export interface DeepseekChatModelOptions {
  apiKey?: string;
  model: string;
  temperature?: number;
}

export function createDeepseekChatModel({ apiKey, model, temperature }: DeepseekChatModelOptions): ChatOpenAI {
  return new ChatOpenAI({
    apiKey: resolveDeepseekApiKey(apiKey),
    model,
    temperature,
    configuration: { baseURL: DEEPSEEK_BASE_URL },
  });
}

/** Raw text generation outside a LangChain chain — mirrors `openai.adapter.ts`. */
export const deepseekAdapter: ProviderAdapter = {
  id: 'deepseek',
  capabilities: ['llm-text'],
  supports: (model) => model.startsWith('deepseek-'),

  async run(req, ctx) {
    if (!req.prompt) throw new Error('deepseek: prompt is required');

    const model = createDeepseekChatModel({ apiKey: ctx.apiKey, model: ctx.model });
    const t0 = Date.now();
    const response = await model.invoke(req.prompt, { signal: ctx.signal });
    const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const stored = await putObject(outputKey('deepseek', 'txt'), Buffer.from(text, 'utf8'));

    return {
      outputs: [{ url: stored.url, kind: 'text', meta: { text } }],
      providerMeta: { provider: 'deepseek', model: ctx.model, latencyMs: Date.now() - t0 },
    };
  },
};
