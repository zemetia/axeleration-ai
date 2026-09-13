import Replicate from 'replicate';

import type { ProviderAdapter, ProviderOutput } from '../types';
import { downloadToStorage, outputKey } from '../util';

type ReplicateItem = string | { url: () => URL | string } | { url: string };

async function itemToUrl(item: ReplicateItem): Promise<string> {
  if (typeof item === 'string') return item;
  if (typeof item.url === 'function') return String(item.url());
  return item.url;
}

function kindFor(capability: string): ProviderOutput['kind'] {
  if (capability === 'music') return 'audio';
  if (capability === 'image-to-video') return 'video';
  return 'image';
}

export const replicateAdapter: ProviderAdapter = {
  id: 'replicate',
  capabilities: ['text-to-image', 'image-to-video', 'music'],
  supports: (model) => model.includes('/'),

  async run(req, ctx) {
    const client = new Replicate({ auth: ctx.apiKey });

    const input: Record<string, unknown> = {
      prompt: req.prompt,
      negative_prompt: req.negativePrompt,
      image: req.referenceImages?.find((r) => r.refUrl)?.refUrl,
      duration: req.durationSeconds,
      ...(req.input ?? {}),
    };

    const t0 = Date.now();
    const raw = await client.run(ctx.model as `${string}/${string}`, { input, signal: ctx.signal });
    const items = (Array.isArray(raw) ? raw : [raw]) as ReplicateItem[];
    const kind = kindFor(req.capability);
    const ext = kind === 'image' ? 'png' : kind === 'video' ? 'mp4' : 'mp3';

    const outputs: ProviderOutput[] = await Promise.all(
      items.map(async (item, i) => {
        const url = await itemToUrl(item);
        const stored = await downloadToStorage(url, outputKey('replicate', `${i}.${ext}`));
        return { url: stored.url, kind };
      }),
    );

    return { outputs, providerMeta: { provider: 'replicate', model: ctx.model, latencyMs: Date.now() - t0 } };
  },
};
