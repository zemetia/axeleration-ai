import { ChatAnthropic } from '@langchain/anthropic';

import { putObject } from '@/lib/storage';

import type { ProviderAdapter } from '../types';
import { outputKey } from '../util';

/**
 * Raw text generation outside a LangChain chain (T04 nodes use `ChatAnthropic` directly via the
 * model router instead). Kept in the registry so `llm-text` participates in provider selection/fallback.
 */
export const anthropicAdapter: ProviderAdapter = {
  id: 'anthropic',
  capabilities: ['llm-text'],
  supports: (model) => model.startsWith('claude-'),

  async run(req, ctx) {
    if (!req.prompt) throw new Error('anthropic: prompt is required');

    const model = new ChatAnthropic({ apiKey: ctx.apiKey, model: ctx.model });
    const t0 = Date.now();
    const response = await model.invoke(req.prompt, { signal: ctx.signal });
    const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const stored = await putObject(outputKey('anthropic', 'txt'), Buffer.from(text, 'utf8'));

    return {
      outputs: [{ url: stored.url, kind: 'text', meta: { text } }],
      providerMeta: { provider: 'anthropic', model: ctx.model, latencyMs: Date.now() - t0 },
    };
  },
};
