import type { ProviderAdapter } from '../types';
import { downloadToStorage, outputKey, pollUntilDone } from '../util';

const BASE_URL = 'https://ark.ap-southeast.bytepluses.com/api/v3';

interface ArkTaskSubmitResponse {
  id: string;
}

interface ArkTaskStatusResponse {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  error?: { message: string };
  content?: { video_url: string };
}

type ArkContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

/** ByteDance Seedance, called direct via BytePlus ModelArk (Volcengine Ark's international endpoint) — no aggregator. */
export const seedanceAdapter: ProviderAdapter = {
  id: 'seedance',
  capabilities: ['text-to-video', 'image-to-video'],
  supports: (model) => model.startsWith('doubao-seedance-'),

  async run(req, ctx) {
    const content: ArkContentPart[] = [{ type: 'text', text: req.prompt ?? '' }];
    for (const ref of req.referenceImages ?? []) {
      if (ref.refUrl) content.push({ type: 'image_url', image_url: { url: ref.refUrl } });
    }

    const t0 = Date.now();
    const submitRes = await fetch(`${BASE_URL}/contents/generations/tasks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ctx.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ctx.model,
        content,
        duration: req.durationSeconds,
        aspect_ratio: req.aspectRatio,
        resolution: req.resolution,
      }),
      signal: ctx.signal,
    });
    if (!submitRes.ok) throw new Error(`seedance: submit failed (${submitRes.status})`);
    const submitted = (await submitRes.json()) as ArkTaskSubmitResponse;

    const result = await pollUntilDone<ArkTaskStatusResponse>({
      fetchStatus: async () => {
        const res = await fetch(`${BASE_URL}/contents/generations/tasks/${submitted.id}`, {
          headers: { Authorization: `Bearer ${ctx.apiKey}` },
          signal: ctx.signal,
        });
        if (!res.ok) throw new Error(`seedance: poll failed (${res.status})`);
        return (await res.json()) as ArkTaskStatusResponse;
      },
      isDone: (r) => r.status === 'succeeded',
      isFailed: (r) => r.status === 'failed' || r.status === 'cancelled',
      failureMessage: (r) => `seedance: generation failed — ${r.error?.message ?? 'unknown error'}`,
      intervalMs: 5000,
    });

    if (!result.content?.video_url) throw new Error('seedance: no video returned');
    const stored = await downloadToStorage(result.content.video_url, outputKey('seedance', 'mp4'));

    return {
      outputs: [{ url: stored.url, kind: 'video' }],
      providerMeta: { provider: 'seedance', model: ctx.model, latencyMs: Date.now() - t0 },
    };
  },
};
