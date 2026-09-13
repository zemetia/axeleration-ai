import { beforeEach, describe, expect, it } from 'vitest';

import { providerRegistry } from './registry';
import type { ProviderAdapter, ProviderRequest } from './types';

function fakeAdapter(id: string, opts: { fail?: boolean; retryable?: boolean } = {}): ProviderAdapter {
  return {
    id,
    capabilities: ['text-to-image'],
    supports: () => true,
    run: async (req: ProviderRequest, ctx) => {
      if (opts.fail) throw new Error(`${id} failed`);
      return {
        outputs: [{ url: `https://storage.local/${id}.png`, kind: 'image' }],
        providerMeta: { provider: id, model: ctx.model, latencyMs: 1 },
        // surfaced for assertions
        ...({ __req: req } as unknown as object),
      };
    },
  };
}

describe('providerRegistry', () => {
  beforeEach(() => {
    providerRegistry.reset();
  });

  it('select() honors override > project config > default precedence', () => {
    providerRegistry.register(fakeAdapter('fal'));
    providerRegistry.register(fakeAdapter('replicate'));

    const withOverride = providerRegistry.select('text-to-image', {
      override: { provider: 'replicate', model: 'custom-model' },
      project: { textToImage: { provider: 'fal', model: 'project-model' } },
    });
    expect(withOverride.provider).toBe('replicate');
    expect(withOverride.model).toBe('custom-model');

    const withProjectOnly = providerRegistry.select('text-to-image', {
      project: { textToImage: { provider: 'fal', model: 'project-model' } },
    });
    expect(withProjectOnly.provider).toBe('fal');
    expect(withProjectOnly.model).toBe('project-model');

    const withDefaultOnly = providerRegistry.select('text-to-image');
    expect(withDefaultOnly.provider).toBe('fal'); // aiConfig.defaults.textToImage
  });

  it('run() falls back to the next registered provider on failure', async () => {
    providerRegistry.register(fakeAdapter('fal', { fail: true }));
    providerRegistry.register(fakeAdapter('replicate'));

    const result = await providerRegistry.run('text-to-image', { capability: 'text-to-image', prompt: 'a cat' });
    expect(result.providerMeta.provider).toBe('replicate');
  });

  it('throws once every provider for the capability has failed', async () => {
    providerRegistry.register(fakeAdapter('fal', { fail: true }));

    await expect(providerRegistry.run('text-to-image', { capability: 'text-to-image', prompt: 'a cat' })).rejects.toThrow();
  });

  // The bare "All providers exhausted" text cost a debugging session once: the real failure was a
  // 404 from the primary, invisible because the message named neither the model nor the cause.
  it('names what it tried and why it failed when every provider is exhausted', async () => {
    providerRegistry.register(fakeAdapter('fal', { fail: true }));

    await expect(
      providerRegistry.run('text-to-image', { capability: 'text-to-image', prompt: 'a cat' }),
    ).rejects.toThrow(/fal:fal-ai\/flux\/dev.*last error: fal failed/);
  });

  it('maps referenceImages through to the adapter call', async () => {
    providerRegistry.register(fakeAdapter('fal'));

    const req: ProviderRequest = {
      capability: 'text-to-image',
      prompt: '@luna in a forest',
      referenceImages: [{ handle: 'luna', type: 'CHARACTER', refUrl: 'https://storage.local/luna.png' }],
    };
    const result = (await providerRegistry.run('text-to-image', req)) as unknown as { __req: ProviderRequest };
    expect(result.__req.referenceImages?.[0]?.refUrl).toBe('https://storage.local/luna.png');
  });
});
