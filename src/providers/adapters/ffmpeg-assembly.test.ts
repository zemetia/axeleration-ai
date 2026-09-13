// @vitest-environment node
import { execFile } from 'node:child_process';
import { mkdir, rm, unlink } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertFfmpegAvailable, ffmpegPath, probeVideo } from '@/lib/ffmpeg';
import { keyFromUrl, pathForKey } from '@/lib/storage';

import type { ProviderContext, ProviderRequest } from '../types';
import { ffmpegAssemblyAdapter, targetDimensions } from './ffmpeg-assembly.adapter';

describe('targetDimensions', () => {
  // The resolution label names the *short* side. Read as "height" instead — which is what this
  // adapter used to do — a 1080p vertical project renders 608×1080, well under what it asked for.
  it('9:16 puts the resolution on the width', () => {
    expect(targetDimensions('9:16', '1080p')).toEqual({ width: 1080, height: 1920 });
  });

  it('16:9 puts the resolution on the height', () => {
    expect(targetDimensions('16:9', '1080p')).toEqual({ width: 1920, height: 1080 });
  });

  it('1:1 is square at the resolution', () => {
    expect(targetDimensions('1:1', '720p')).toEqual({ width: 720, height: 720 });
  });

  it('defaults to 9:16 at 1080p — the project defaults — when neither is given', () => {
    expect(targetDimensions(undefined, undefined)).toEqual({ width: 1080, height: 1920 });
  });

  it('never yields an odd side, which libx264 rejects under yuv420p', () => {
    for (const aspect of ['9:16', '16:9', '1:1'] as const) {
      for (const resolution of ['720p', '1080p', '4K'] as const) {
        const { width, height } = targetDimensions(aspect, resolution);
        expect(width % 2).toBe(0);
        expect(height % 2).toBe(0);
      }
    }
  });
});

/*
 * Everything below shells out to a real ffmpeg. The clips are synthesized with `lavfi` rather than
 * committed as fixtures, and the suite skips itself where no binary exists so CI on a bare image
 * reports "skipped" instead of red.
 */
const hasFfmpeg = await assertFfmpegAvailable().then(
  () => true,
  () => false,
);

const CTX = { apiKey: '', model: 'local' } satisfies ProviderContext;
const FIXTURE_DIR = `test-ffmpeg-${Date.now().toString(36)}`;

interface ClipSpec {
  name: string;
  size: string;
  fps: number;
  seconds: number;
  withAudio: boolean;
}

/** Deliberately mismatched clips — this is the exact input `-c copy` concat cannot handle. */
const CLIPS: ClipSpec[] = [
  { name: 'scene-0.mp4', size: '640x360', fps: 24, seconds: 1, withAudio: false },
  { name: 'scene-1.mp4', size: '1080x1920', fps: 30, seconds: 1, withAudio: true },
  { name: 'scene-2.mp4', size: '480x480', fps: 15, seconds: 1, withAudio: false },
];

/**
 * Fixtures are built by calling ffmpeg directly rather than through fluent-ffmpeg: its capability
 * check rejects `-f lavfi` (see the adapter's `normalizeClip`), and a synthesized source is exactly
 * what these clips need to be.
 */
async function writeClip(spec: ClipSpec): Promise<string> {
  const key = `${FIXTURE_DIR}/${spec.name}`;
  const args = ['-y', '-f', 'lavfi', '-i', `testsrc=size=${spec.size}:rate=${spec.fps}:duration=${spec.seconds}`];
  if (spec.withAudio) args.push('-f', 'lavfi', '-i', `sine=frequency=440:duration=${spec.seconds}`);
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p');
  if (spec.withAudio) args.push('-c:a', 'aac');
  args.push(pathForKey(key));

  await promisify(execFile)(ffmpegPath(), args);
  return key;
}

const producedKeys: string[] = [];

async function assemble(req: Partial<ProviderRequest> & { input: Record<string, unknown> }) {
  const result = await ffmpegAssemblyAdapter.run({ capability: 'video-assembly', ...req }, CTX);
  const url = result.outputs[0]?.url;
  expect(url).toBeTruthy();
  const key = keyFromUrl(url as string);
  producedKeys.push(key);
  return { result, probe: await probeVideo(pathForKey(key)) };
}

describe.skipIf(!hasFfmpeg)('ffmpegAssemblyAdapter', () => {
  let sceneKeys: string[] = [];

  beforeAll(async () => {
    await mkdir(path.dirname(pathForKey(`${FIXTURE_DIR}/x`)), { recursive: true });
    sceneKeys = [];
    for (const spec of CLIPS) sceneKeys.push(await writeClip(spec));
  }, 120_000);

  afterAll(async () => {
    await rm(path.dirname(pathForKey(`${FIXTURE_DIR}/x`)), { recursive: true, force: true });
    await Promise.all(producedKeys.map((key) => unlink(pathForKey(key)).catch(() => undefined)));
  });

  it('concatenates clips of different sizes and frame rates into the summed duration', async () => {
    const total = CLIPS.reduce((sum, clip) => sum + clip.seconds, 0);
    const { probe } = await assemble({ aspectRatio: '9:16', resolution: '720p', input: { sceneKeys } });

    // The real regression: with `-c copy` over mismatched inputs, ffmpeg emits a file whose
    // duration is wrong (or whose later segments are frozen) rather than failing outright.
    expect(probe.durationSeconds).toBeGreaterThan(total - 0.3);
    expect(probe.durationSeconds).toBeLessThan(total + 0.3);
  }, 180_000);

  it('conforms every clip to one profile', async () => {
    const { probe, result } = await assemble({ aspectRatio: '9:16', resolution: '720p', input: { sceneKeys } });

    expect({ width: probe.width, height: probe.height }).toEqual(targetDimensions('9:16', '720p'));
    expect(Math.round(probe.fps)).toBe(30);
    expect(result.providerMeta).toMatchObject({ provider: 'ffmpeg', scenes: CLIPS.length });
  }, 180_000);

  it('renders 16:9 landscape from the same vertical sources', async () => {
    const { probe } = await assemble({ aspectRatio: '16:9', resolution: '720p', input: { sceneKeys } });
    expect({ width: probe.width, height: probe.height }).toEqual(targetDimensions('16:9', '720p'));
  }, 180_000);

  it('carries a uniform audio track even though only one source clip had one', async () => {
    // Not cosmetic: concat requires every input to expose the same streams, so clips without audio
    // are given silence. Losing the one clip's native audio instead would be a regression — several
    // video models now emit sound of their own.
    const { probe } = await assemble({ aspectRatio: '9:16', resolution: '720p', input: { sceneKeys } });
    expect(probe.hasAudio).toBe(true);
  }, 180_000);

  it('rejects an empty manifest', async () => {
    await expect(ffmpegAssemblyAdapter.run({ capability: 'video-assembly', input: { sceneKeys: [] } }, CTX)).rejects.toThrow(
      /sceneKeys is required/,
    );
  });
});

describe('assertFfmpegAvailable', () => {
  it('names the binary and the env var when it cannot run', async () => {
    const original = process.env.FFMPEG_PATH;
    process.env.FFMPEG_PATH = path.join(path.sep, 'definitely', 'not', 'ffmpeg');
    const { assertFfmpegAvailable: assertFresh, resetFfmpegAvailability } = await import('@/lib/ffmpeg');
    resetFfmpegAvailability();
    try {
      await expect(assertFresh()).rejects.toThrow(/FFMPEG_PATH/);
    } finally {
      if (original === undefined) delete process.env.FFMPEG_PATH;
      else process.env.FFMPEG_PATH = original;
      resetFfmpegAvailability();
    }
  });
});
