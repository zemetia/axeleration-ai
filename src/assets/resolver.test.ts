import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AssetVO } from '@/types/value-objects';

const { byHandles } = vi.hoisted(() => ({ byHandles: vi.fn() }));

vi.mock('@/services', () => ({
  assetService: { byHandles },
}));

const { assetResolver, splitRefsForRequest } = await import('./resolver');

function makeAsset(overrides: Partial<AssetVO>): AssetVO {
  return {
    id: 'asset-1',
    projectId: 'project-1',
    type: 'CHARACTER',
    typeLabel: 'Character',
    lab: null,
    handle: 'luna',
    name: 'Luna',
    description: 'Luna (silver hair, red scarf)',
    refUrl: 'https://storage.local/luna.png',
    voiceId: null,
    attributes: {},
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('assetResolver.resolve', () => {
  beforeEach(() => {
    byHandles.mockReset();
  });

  it('returns the text unchanged when there are no mentions', async () => {
    const result = await assetResolver.resolve('project-1', 'no handles here');
    expect(result).toEqual({ rewritten: 'no handles here', refs: [], unknown: [] });
    expect(byHandles).not.toHaveBeenCalled();
  });

  it('rewrites a known CHARACTER mention and attaches its reference image', async () => {
    byHandles.mockResolvedValue([makeAsset({})]);

    const result = await assetResolver.resolve('project-1', '@luna walks into a forest');

    expect(result.rewritten).toBe('Luna (silver hair, red scarf) walks into a forest');
    expect(result.unknown).toEqual([]);
    expect(result.refs).toEqual([
      { handle: 'luna', type: 'CHARACTER', refUrl: 'https://storage.local/luna.png', voiceId: undefined, description: 'Luna (silver hair, red scarf)' },
    ]);
  });

  it('routes a VOICE mention to voiceId, not referenceImages', async () => {
    byHandles.mockResolvedValue([
      makeAsset({ handle: 'luna-voice', type: 'VOICE', typeLabel: 'Voice', refUrl: null, voiceId: 'el-voice-123', description: null }),
    ]);

    const result = await assetResolver.resolve('project-1', '@luna-voice says the line');
    const { referenceImages, voiceId } = splitRefsForRequest(result.refs);

    expect(referenceImages).toEqual([]);
    expect(voiceId).toBe('el-voice-123');
  });

  it('passes unknown handles through as literal text and reports them, without throwing', async () => {
    byHandles.mockResolvedValue([]);

    const result = await assetResolver.resolve('project-1', 'greetings from @ghost');

    expect(result.rewritten).toBe('greetings from @ghost');
    expect(result.unknown).toEqual(['ghost']);
    expect(result.refs).toEqual([]);
  });

  it('dedupes refs when a handle is mentioned more than once', async () => {
    byHandles.mockResolvedValue([makeAsset({})]);

    const result = await assetResolver.resolve('project-1', '@luna sees @luna in the mirror');

    expect(result.refs).toHaveLength(1);
    expect(byHandles).toHaveBeenCalledWith('project-1', ['luna']);
  });
});
