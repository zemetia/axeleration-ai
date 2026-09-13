import { ChatOpenAI } from '@langchain/openai';

import { putObject } from '@/lib/storage';

import type { ProviderAdapter } from '../types';
import { outputKey } from '../util';

/** Raw text generation outside a LangChain chain — mirrors `anthropic.adapter.ts`. */
export const openaiAdapter: ProviderAdapter = {
  id: 'openai',
  capabilities: ['llm-text'],
  supports: (model) => model.startsWith('gpt-'),

  async run(req, ctx) {
    if (!req.prompt) throw new Error('openai: prompt is required');

    const model = new ChatOpenAI({ apiKey: ctx.apiKey, model: ctx.model });
    const t0 = Date.now();
    const response = await model.invoke(req.prompt, { signal: ctx.signal });
    const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const stored = await putObject(outputKey('openai', 'txt'), Buffer.from(text, 'utf8'));

    return {
      outputs: [{ url: stored.url, kind: 'text', meta: { text } }],
      providerMeta: { provider: 'openai', model: ctx.model, latencyMs: Date.now() - t0 },
    };
  },
};
