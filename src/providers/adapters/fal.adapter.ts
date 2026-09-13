import { fal } from '@fal-ai/client';

import type { ProviderAdapter, ProviderOutput, ProviderRequest } from '../types';
import { downloadToStorage, outputKey } from '../util';

interface FalFile {
  url: string;
  content_type?: string;
}

interface FalOutput {
  images?: FalFile[];
  image?: FalFile;
  video?: FalFile;
  audio?: FalFile;
}

function normalizeFalOutputs(data: FalOutput): { url: string; kind: ProviderOutput['kind'] }[] {
  if (data.images?.length) return data.images.map((f) => ({ url: f.url, kind: 'image' as const }));
  if (data.image) return [{ url: data.image.url, kind: 'image' as const }];
  if (data.video) return [{ url: data.video.url, kind: 'video' as const }];
  if (data.audio) return [{ url: data.audio.url, kind: 'audio' as const }];
  throw new Error('fal: unrecognized output shape');
}

function mapAspect(aspectRatio?: ProviderRequest['aspectRatio']) {
  const map: Record<string, string> = { '9:16': 'portrait_16_9', '16:9': 'landscape_16_9', '1:1': 'square' };
  return aspectRatio ? { image_size: map[aspectRatio] } : {};
}

export const falAdapter: ProviderAdapter = {
  id: 'fal',
  capabilities: ['text-to-image', 'image-to-image', 'text-to-video', 'image-to-video'],
  supports: (model) => model.startsWith('fal-ai/'),

  async run(req, ctx) {
    fal.config({ credentials: ctx.apiKey });

    const input: Record<string, unknown> = {
      prompt: req.prompt,
      negative_prompt: req.negativePrompt,
      image_url: req.referenceImages?.find((r) => r.refUrl)?.refUrl,
      ...mapAspect(req.aspectRatio),
      ...(req.input ?? {}),
    };

    const t0 = Date.now();
    const { data } = await fal.subscribe(ctx.model, { input, abortSignal: ctx.signal });
    const raw = normalizeFalOutputs(data as FalOutput);

    const outputs: ProviderOutput[] = await Promise.all(
      raw.map(async (o, i) => {
        const ext = o.kind === 'image' ? 'png' : o.kind === 'video' ? 'mp4' : 'mp3';
        const stored = await downloadToStorage(o.url, outputKey('fal', `${i}.${ext}`));
        return { url: stored.url, kind: o.kind };
      }),
    );

    return { outputs, providerMeta: { provider: 'fal', model: ctx.model, latencyMs: Date.now() - t0 } };
  },
};
