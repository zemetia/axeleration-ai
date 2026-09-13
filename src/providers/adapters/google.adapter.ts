import { GoogleGenAI } from '@google/genai';

import { putObject } from '@/lib/storage';

import type { Capability, ProviderAdapter, ProviderOutput, ProviderRequest } from '../types';
import { outputKey } from '../util';

async function fetchAsInlineImage(url: string): Promise<{ imageBytes: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`google: failed to fetch reference image (${res.status})`);
  const mimeType = res.headers.get('content-type') ?? 'image/png';
  const imageBytes = Buffer.from(await res.arrayBuffer()).toString('base64');
  return { imageBytes, mimeType };
}

async function runChat(ai: GoogleGenAI, req: ProviderRequest, model: string) {
  const response = await ai.models.generateContent({ model, contents: req.prompt ?? '' });
  const text = response.text ?? '';
  const stored = await putObject(outputKey('google', 'txt'), Buffer.from(text, 'utf8'));
  return [{ url: stored.url, kind: 'text' as const, meta: { text } }];
}

async function runImage(ai: GoogleGenAI, req: ProviderRequest, model: string): Promise<ProviderOutput[]> {
  const refImage = req.referenceImages?.find((r) => r.refUrl)?.refUrl;

  if (model === 'gemini-2.5-flash-image' || model === 'gemini-3-pro-image-preview') {
    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
      { text: req.prompt ?? '' },
    ];
    if (refImage) {
      const inline = await fetchAsInlineImage(refImage);
      parts.push({ inlineData: { data: inline.imageBytes, mimeType: inline.mimeType } });
    }
    const response = await ai.models.generateContent({ model, contents: [{ role: 'user', parts }] });
    const imagePart = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p && p.inlineData);
    const inlineData = imagePart && 'inlineData' in imagePart ? imagePart.inlineData : undefined;
    if (!inlineData?.data) throw new Error('google: no image returned');
    const stored = await putObject(outputKey('google', 'png'), Buffer.from(inlineData.data, 'base64'));
    return [{ url: stored.url, kind: 'image' }];
  }

  const response = await ai.models.generateImages({
    model,
    prompt: req.prompt ?? '',
    config: { numberOfImages: 1, aspectRatio: req.aspectRatio },
  });
  const images = response.generatedImages ?? [];
  if (!images.length) throw new Error('google: no image returned');

  return Promise.all(
    images.map(async (img, i) => {
      const bytes = img.image?.imageBytes;
      if (!bytes) throw new Error('google: image missing imageBytes');
      const stored = await putObject(outputKey('google', `${i}.png`), Buffer.from(bytes, 'base64'));
      return { url: stored.url, kind: 'image' as const };
    }),
  );
}

async function runVideo(ai: GoogleGenAI, req: ProviderRequest, model: string, apiKey: string): Promise<ProviderOutput[]> {
  const refImage = req.referenceImages?.find((r) => r.refUrl)?.refUrl;
  const image = refImage ? await fetchAsInlineImage(refImage) : undefined;

  let operation = await ai.models.generateVideos({
    model,
    prompt: req.prompt ?? '',
    image,
    config: {
      aspectRatio: req.aspectRatio,
      durationSeconds: req.durationSeconds,
      resolution: req.resolution === '4K' ? '4k' : req.resolution,
    },
  });

  while (!operation.done) {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const videos = operation.response?.generatedVideos ?? [];
  if (!videos.length) throw new Error('google: no video returned');

  return Promise.all(
    videos.map(async (v, i) => {
      const uri = v.video?.uri;
      if (!uri) throw new Error('google: video missing uri');
      const res = await fetch(`${uri}&key=${apiKey}`);
      if (!res.ok) throw new Error(`google: failed to download video (${res.status})`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const stored = await putObject(outputKey('google', `${i}.mp4`), buffer);
      return { url: stored.url, kind: 'video' as const };
    }),
  );
}

type Runner = (ai: GoogleGenAI, req: ProviderRequest, model: string, apiKey: string) => Promise<ProviderOutput[]>;

const RUNNERS: Partial<Record<Capability, Runner>> = {
  'llm-text': (ai, req, model) => runChat(ai, req, model),
  'text-to-image': (ai, req, model) => runImage(ai, req, model),
  'image-to-image': (ai, req, model) => runImage(ai, req, model),
  'text-to-video': runVideo,
  'image-to-video': runVideo,
};

export const googleAdapter: ProviderAdapter = {
  id: 'google',
  capabilities: ['llm-text', 'text-to-image', 'image-to-image', 'text-to-video', 'image-to-video'],
  supports: (model) => /^(gemini-|imagen-|veo-)/.test(model),

  async run(req, ctx) {
    const runner = RUNNERS[req.capability];
    if (!runner) throw new Error(`google: unsupported capability "${req.capability}"`);

    const ai = new GoogleGenAI({ apiKey: ctx.apiKey });
    const t0 = Date.now();
    const outputs = await runner(ai, req, ctx.model, ctx.apiKey);

    return { outputs, providerMeta: { provider: 'google', model: ctx.model, latencyMs: Date.now() - t0 } };
  },
};
