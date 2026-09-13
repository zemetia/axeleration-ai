import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SceneVO } from '@/types/value-objects';

const assertFfmpegAvailable = vi.fn(async () => undefined);
const scenes = vi.fn<() => Promise<SceneVO[]>>();
interface AssemblyRequest {
  input: { sceneKeys: string[]; voiceKey?: string; musicKey?: string };
}

const run = vi.fn(async (_capability: string, _request: AssemblyRequest, _options: unknown) => ({
  outputs: [{ url: 'local://final.mp4', kind: 'video' as const }],
  costEstimate: 0,
  providerMeta: { provider: 'ffmpeg', model: 'local', latencyMs: 1 },
}));

vi.mock('@/lib/ffmpeg', () => ({ assertFfmpegAvailable: () => assertFfmpegAvailable() }));
vi.mock('@/lib/storage', () => ({ keyFromUrl: (url: string) => url.replace('local://', '') }));
vi.mock('@/providers/registry', () => ({
  providerRegistry: { run: (capability: string, request: AssemblyRequest, options: unknown) => run(capability, request, options) },
}));
vi.mock('@/services', () => ({
  apiKeyService: { getDecrypted: async () => 'key' },
  episodeService: { scenes: () => scenes() },
  projectService: { get: async () => ({ id: 'p1', aspectRatio: 'R9_16', resolution: 'P1080', modelConfig: null }) },
}));
vi.mock('../stage-io', () => ({
  withStage: async (_episodeId: string, _kind: string, body: () => Promise<{ result: string }>) => (await body()).result,
}));

const { renderNode } = await import('./render.node');

function scene(index: number, overrides: Partial<SceneVO> = {}): SceneVO {
  return {
    id: `s${index}`,
    episodeId: 'e1',
    index,
    status: 'READY',
    statusLabel: 'Ready',
    attempt: 1,
    style: '',
    setting: '',
    shots: [{ durationSeconds: 5, camera: '', action: '' }],
    lighting: '',
    audio: '',
    dialogue: [],
    negative: '',
    durationSeconds: 5,
    prompt: 'p',
    videoUrl: `local://scene-${index}.mp4`,
    error: null,
    costEstimate: 0,
    startedAt: null,
    finishedAt: null,
    ...overrides,
  };
}

const STATE = { episodeId: 'e1', projectId: 'p1' } as Parameters<typeof renderNode>[0];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('renderNode', () => {
  /*
   * The whole point of the change: the cut comes from `Scene` rows, not from the `scenes` graph
   * channel. A user who generated every beat one card at a time has correct rows and an *empty*
   * channel — `regenerateEpisodeScene` skips its checkpoint patch when the batch has not run — and
   * the old implementation refused to render for them.
   */
  it('stitches from the Scene rows even when the graph channel is empty', async () => {
    scenes.mockResolvedValue([scene(1), scene(2), scene(3)]);

    await renderNode(STATE);

    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0]?.[1].input.sceneKeys).toEqual(['scene-1.mp4', 'scene-2.mp4', 'scene-3.mp4']);
  });

  it('names the beats that have no clip instead of rendering a short film', async () => {
    scenes.mockResolvedValue([scene(1), scene(2, { status: 'PENDING', videoUrl: null }), scene(3, { videoUrl: null })]);

    await expect(renderNode(STATE)).rejects.toThrow(/no clip yet for scene 2, 3/);
    expect(run).not.toHaveBeenCalled();
  });

  it('refuses an episode with no scenes at all', async () => {
    scenes.mockResolvedValue([]);
    await expect(renderNode(STATE)).rejects.toThrow(/no scenes/);
  });

  // A missing binary must surface before the stage does any work — RENDER is last, so by the time
  // it runs the episode's entire generation bill has already been paid.
  it('checks for ffmpeg before touching anything else', async () => {
    assertFfmpegAvailable.mockRejectedValueOnce(new Error('ffmpeg is not runnable at "ffmpeg"'));

    await expect(renderNode(STATE)).rejects.toThrow(/not runnable/);
    expect(scenes).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });
});
