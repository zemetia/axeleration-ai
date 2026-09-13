import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EXAMPLE_BRIDGE_SPECS } from '@/config/bridges';

import type { ProviderRequest } from '../types';
import { createBridgeAdapter } from './adapter';
import { parseBridgeSpecs } from './types';
import type { BridgeSpec, BridgeSpecInput } from './types';

vi.mock('@/lib/storage', () => ({
  putObject: vi.fn(async (key: string, data: Buffer) => ({ key, url: `stored://${key}`, size: data.length })),
  isLocalUrl: (url: string) => url.startsWith('http://localhost:3000/media/'),
  keyFromUrl: (url: string) => url.replace('http://localhost:3000/media/', ''),
  readObject: vi.fn(async () => Buffer.from('PNGBYTES')),
}));

const { putObject } = await import('@/lib/storage');

/** One queued response per call, in order — the shape of a submit-then-poll conversation. */
function mockFetchSequence(responses: { status?: number; json?: unknown; body?: string }[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  let index = 0;

  const fetchMock = vi.fn(async (input: URL | string, init: RequestInit = {}) => {
    calls.push({ url: input.toString(), init });
    const next = responses[Math.min(index++, responses.length - 1)] ?? {};
    const status = next.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => next.json,
      text: async () => next.body ?? JSON.stringify(next.json ?? ''),
      arrayBuffer: async () => new TextEncoder().encode(next.body ?? 'BYTES').buffer,
    } as unknown as Response;
  });

  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

function specNamed(id: string): BridgeSpecInput {
  const spec = EXAMPLE_BRIDGE_SPECS.find((candidate) => candidate.id === id);
  if (!spec) throw new Error(`No example spec "${id}"`);
  return spec;
}

const syncSpec = parseBridgeSpecs([specNamed('example-sync-image')])[0];
const asyncSpec = parseBridgeSpecs([specNamed('example-async-video')])[0];

if (!syncSpec || !asyncSpec) throw new Error('Example specs failed to parse');

const textToImage: ProviderRequest = { capability: 'text-to-image', prompt: 'a cat', aspectRatio: '16:9' };

/** The spec's real interval is 5s; the tests assert the loop, not the wait. */
function fastPolling(spec: BridgeSpec): BridgeSpec {
  if (!spec.poll) throw new Error('Expected a polling spec');
  return { ...spec, poll: { ...spec.poll, intervalMs: 1 } };
}

describe('createBridgeAdapter', () => {
  beforeEach(() => {
    vi.mocked(putObject).mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('derives id, capabilities and supported models from the spec', () => {
    const adapter = createBridgeAdapter(syncSpec);
    expect(adapter.id).toBe('example-sync-image');
    expect(adapter.capabilities).toEqual(['text-to-image', 'image-to-image']);
    expect(adapter.supports('fast-diffusion-v2')).toBe(true);
    expect(adapter.supports('not-a-model')).toBe(false);
  });

  it('renders the auth header and drops body keys the request did not fill', async () => {
    const { calls } = mockFetchSequence([
      { json: { data: [{ url: 'https://cdn.example.com/out.png' }] } },
      { body: 'IMAGEBYTES' },
    ]);

    const adapter = createBridgeAdapter(syncSpec);
    await adapter.run(textToImage, { apiKey: 'secret-key', model: 'fast-diffusion-v2' });

    const submit = calls[0];
    expect(submit?.url).toBe('https://api.example-vendor.com/v1/images/generations');
    expect((submit?.init.headers as Record<string, string>)['Authorization']).toBe('Bearer secret-key');

    const body = JSON.parse(String(submit?.init.body)) as Record<string, unknown>;
    expect(body).toEqual({ model: 'fast-diffusion-v2', prompt: 'a cat', size: '1024x576' });
    // No seed, no reference image, no negative prompt were set — none may be sent as null.
    expect(Object.keys(body)).not.toContain('seed');
    expect(Object.keys(body)).not.toContain('image');
  });

  it('persists a sync API`s outputs to local storage rather than returning the vendor URL', async () => {
    mockFetchSequence([
      { json: { data: [{ url: 'https://cdn.example.com/out.png' }] } },
      { body: 'IMAGEBYTES' },
    ]);

    const adapter = createBridgeAdapter(syncSpec);
    const result = await adapter.run(textToImage, { apiKey: 'k', model: 'fast-diffusion-v2' });

    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]?.kind).toBe('image');
    expect(result.outputs[0]?.url).toMatch(/^stored:\/\/providers\/example-sync-image\/.*\.png$/);
    expect(result.providerMeta.provider).toBe('example-sync-image');
  });

  it('polls until the terminal status, feeding the submit response`s task id into the poll URL', async () => {
    const { calls } = mockFetchSequence([
      { json: { data: { task_id: 'task-42' } } },
      { json: { data: { state: 'processing' } } },
      { json: { data: { state: 'succeeded', assets: [{ video_url: 'https://cdn.example.com/clip.mp4' }] } } },
      { body: 'VIDEOBYTES' },
    ]);

    const adapter = createBridgeAdapter(fastPolling(asyncSpec));
    const result = await adapter.run(
      { capability: 'text-to-video', prompt: 'a cat', durationSeconds: 8 },
      { apiKey: 'k', model: 'motion-xl' },
    );

    expect(calls[0]?.url).toBe('https://api.example-vendor.com/v2/motion-xl/submit');
    expect(calls[1]?.url).toBe('https://api.example-vendor.com/v2/tasks/task-42');
    expect(calls[2]?.url).toBe('https://api.example-vendor.com/v2/tasks/task-42');
    expect(result.outputs[0]?.kind).toBe('video');
    expect(result.outputs[0]?.url).toMatch(/\.mp4$/);

    // `{{duration}}` is a whole placeholder, so it stays a JSON number.
    const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>;
    expect(body['duration_seconds']).toBe(8);
  });

  it('throws the vendor`s own message when the poll reaches a failure status', async () => {
    mockFetchSequence([
      { json: { data: { task_id: 'task-7' } } },
      { json: { data: { state: 'failed', error: { message: 'content policy' } } } },
    ]);

    const adapter = createBridgeAdapter(fastPolling(asyncSpec));
    await expect(
      adapter.run({ capability: 'text-to-video', prompt: 'x' }, { apiKey: 'k', model: 'motion-xl' }),
    ).rejects.toThrow(/content policy/);
  });

  it('surfaces the response body on a non-2xx submit, which is the whole diagnosis for a wrong spec', async () => {
    mockFetchSequence([{ status: 400, body: '{"error":"unknown field `size`"}' }]);

    const adapter = createBridgeAdapter(syncSpec);
    await expect(adapter.run(textToImage, { apiKey: 'k', model: 'fast-diffusion-v2' })).rejects.toThrow(
      /submit failed \(400\)[\s\S]*unknown field/,
    );
  });

  it('inlines a local reference image as a data URI when imageInput is not `url`', async () => {
    const { calls } = mockFetchSequence([
      { json: { data: [{ url: 'https://cdn.example.com/out.png' }] } },
      { body: 'IMAGEBYTES' },
    ]);

    const adapter = createBridgeAdapter(syncSpec);
    await adapter.run(
      {
        capability: 'image-to-image',
        prompt: 'a cat',
        referenceImages: [
          { handle: 'luna', type: 'CHARACTER', refUrl: 'http://localhost:3000/media/assets/luna.png' },
        ],
      },
      { apiKey: 'k', model: 'fast-diffusion-v2-edit' },
    );

    const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>;
    // Read off disk and inlined — a hosted vendor could never have fetched the localhost URL.
    expect(body['image']).toBe(`data:image/png;base64,${Buffer.from('PNGBYTES').toString('base64')}`);
  });

  it('decodes a base64 output instead of trying to download it', async () => {
    const payload = Buffer.from('RAWIMAGE').toString('base64');
    mockFetchSequence([{ json: { data: [{ url: `data:image/png;base64,${payload}` }] } }]);

    const adapter = createBridgeAdapter(syncSpec);
    const result = await adapter.run(textToImage, { apiKey: 'k', model: 'fast-diffusion-v2' });

    expect(result.outputs[0]?.url).toMatch(/^stored:\/\//);
    const [, data] = vi.mocked(putObject).mock.calls[0] ?? [];
    expect(data?.toString()).toBe('RAWIMAGE');
  });

  it('fails loudly when the outputs path holds nothing', async () => {
    mockFetchSequence([{ json: { data: [] } }]);

    const adapter = createBridgeAdapter(syncSpec);
    await expect(adapter.run(textToImage, { apiKey: 'k', model: 'fast-diffusion-v2' })).rejects.toThrow(
      /no outputs at "data"/,
    );
  });
});

describe('parseBridgeSpecs', () => {
  it('accepts every shipped example', () => {
    expect(parseBridgeSpecs(EXAMPLE_BRIDGE_SPECS)).toHaveLength(EXAMPLE_BRIDGE_SPECS.length);
  });

  it('names the offending spec when one is malformed', () => {
    expect(() => parseBridgeSpecs([{ id: 'Bad Id', label: 'x', models: {}, submit: { url: 'u' }, outputs: { path: 'p' } }])).toThrow(
      /Bad Id/,
    );
  });

  it('rejects a spec that offers no models at all', () => {
    expect(() =>
      parseBridgeSpecs([{ id: 'empty', label: 'x', models: {}, submit: { url: 'u' }, outputs: { path: 'p' } }]),
    ).toThrow(/at least one model/);
  });

  it('rejects two bridges claiming the same id, which would share one saved API key', () => {
    expect(() => parseBridgeSpecs([specNamed('example-sync-image'), specNamed('example-sync-image')])).toThrow(
      /Duplicate bridge spec id/,
    );
  });
});
