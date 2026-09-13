import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

import { putObject } from '@/lib/storage';

import type { ProviderAdapter } from '../types';
import { outputKey } from '../util';

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const reader = stream.getReader();
  for (let r = await reader.read(); !r.done; r = await reader.read()) {
    chunks.push(Buffer.from(r.value));
  }
  return Buffer.concat(chunks);
}

export const elevenlabsAdapter: ProviderAdapter = {
  id: 'elevenlabs',
  capabilities: ['tts'],
  supports: (model) => model.startsWith('eleven_'),

  async run(req, ctx) {
    const voiceId = req.voiceId ?? req.referenceImages?.find((r) => r.type === 'VOICE')?.voiceId;
    if (!voiceId) throw new Error('elevenlabs: voiceId is required for TTS');
    if (!req.prompt) throw new Error('elevenlabs: prompt (text) is required for TTS');

    const client = new ElevenLabsClient({ apiKey: ctx.apiKey });
    const t0 = Date.now();
    const stream = await client.textToSpeech.convert(voiceId, {
      text: req.prompt,
      modelId: ctx.model,
    });
    const buffer = await streamToBuffer(stream);
    const stored = await putObject(outputKey('elevenlabs', 'mp3'), buffer);

    return {
      outputs: [{ url: stored.url, kind: 'audio' }],
      providerMeta: { provider: 'elevenlabs', model: ctx.model, latencyMs: Date.now() - t0 },
    };
  },
};
