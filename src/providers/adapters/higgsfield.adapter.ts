import type { ProviderAdapter, ProviderOutput } from '../types';
import { downloadToStorage, outputKey, pollUntilDone } from '../util';

const BASE_URL = 'https://platform.higgsfield.ai';

interface HiggsfieldSubmitResponse {
  success: boolean;
  generation_id: string;
  request_id: string;
  status_url: string;
}

interface HiggsfieldStatusResponse {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  error?: string;
  results?: { url: string }[];
}

/** `ctx.model` is one of the DoP tiers ("dop-lite" | "dop-standard" | "dop-turbo") or "soul" (text-to-image). */
function pathFor(model: string, capability: string): { path: string; body: Record<string, unknown> } {
  if (model === 'soul' || capability === 'text-to-image') {
    return { path: '/v1/text2image/soul', body: {} };
  }
  const tier = model.replace(/^dop-/, '') || 'standard';
  return { path: '/v1/image2video/dop', body: { model: tier } };
}

/** Higgsfield's own API (cinematic image-to-video "DoP" + "Soul" stylized image generation). */
export const higgsfieldAdapter: ProviderAdapter = {
  id: 'higgsfield',
  capabilities: ['text-to-image', 'image-to-video'],
  supports: (model) => model === 'soul' || model.startsWith('dop-'),

  async run(req, ctx) {
    const { path, body: modelBody } = pathFor(ctx.model, req.capability);
    const body: Record<string, unknown> = {
      ...modelBody,
      prompt: req.prompt,
      image_url: req.referenceImages?.find((r) => r.refUrl)?.refUrl,
    };

    const t0 = Date.now();
    const submitRes = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ctx.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctx.signal,
    });
    if (!submitRes.ok) throw new Error(`higgsfield: submit failed (${submitRes.status})`);
    const submitted = (await submitRes.json()) as HiggsfieldSubmitResponse;

    const result = await pollUntilDone<HiggsfieldStatusResponse>({
      fetchStatus: async () => {
        const res = await fetch(submitted.status_url, {
          headers: { Authorization: `Bearer ${ctx.apiKey}` },
          signal: ctx.signal,
        });
        if (!res.ok) throw new Error(`higgsfield: poll failed (${res.status})`);
        return (await res.json()) as HiggsfieldStatusResponse;
      },
      isDone: (r) => r.status === 'completed',
      isFailed: (r) => r.status === 'failed',
      failureMessage: (r) => `higgsfield: generation failed — ${r.error ?? 'unknown error'}`,
      intervalMs: req.capability === 'text-to-image' ? 2000 : 5000,
    });

    if (!result.results?.length) throw new Error('higgsfield: no outputs returned');
    const kind: ProviderOutput['kind'] = req.capability === 'text-to-image' ? 'image' : 'video';
    const ext = kind === 'image' ? 'png' : 'mp4';

    const outputs: ProviderOutput[] = await Promise.all(
      result.results.map(async (r, i) => {
        const stored = await downloadToStorage(r.url, outputKey('higgsfield', `${i}.${ext}`));
        return { url: stored.url, kind };
      }),
    );

    return { outputs, providerMeta: { provider: 'higgsfield', model: ctx.model, latencyMs: Date.now() - t0 } };
  },
};
