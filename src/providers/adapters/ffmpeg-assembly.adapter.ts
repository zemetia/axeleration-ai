import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { mapWithConcurrency } from '@/lib/concurrency';
import { assertFfmpegAvailable, probeVideo, runFfmpeg } from '@/lib/ffmpeg';
import { readObject, putObject } from '@/lib/storage';

import type { ProviderAdapter, ProviderRequest } from '../types';
import { outputKey } from '../util';

/**
 * Local ffmpeg assembly — not a generation model, just the final normalize/concat/mux step
 * (no vendor SDK, no network call).
 *
 * Why the normalize pass exists: the clips arriving here were produced by *different* models. A
 * project can route text-to-video to one vendor and image-to-video to another, and even one model
 * returns different dimensions per aspect ratio. The concat demuxer with `-c copy` requires every
 * input to agree on codec, resolution, pixel format, frame rate, time base and audio layout — when
 * they disagree it does not error, it emits a file whose later segments are frozen or desynced, and
 * nobody finds out until a human watches the render. So every clip is re-encoded to one profile
 * first, and only then concatenated; by that point `-c copy` is safe because we produced the inputs.
 */

/** Constant frame rate every clip is conformed to. */
const TARGET_FPS = 30;
/** A single time base for all clips — mismatched timescales are a silent source of A/V drift on concat. */
const TIMESCALE = 90000;
/** Intermediates only, so quality is near-visually-lossless and speed matters more than size. */
const NORMALIZE_ENCODE = ['-c:v libx264', '-preset veryfast', '-crf 18', '-pix_fmt yuv420p', `-video_track_timescale ${TIMESCALE}`];
const NORMALIZE_AUDIO = ['-c:a aac', '-ar 48000', '-ac 2', '-b:a 128k'];
/** `D:` is a spinning disk here, so N serial re-encodes is the slowest possible shape. */
const NORMALIZE_CONCURRENCY = 3;

/**
 * The resolution label names the **short side**: 1080p vertical is 1080×1920, not 608×1080.
 * The previous implementation read it as the height in every aspect ratio, which quietly rendered
 * 9:16 projects — the default — at well under the resolution they asked for.
 */
const SHORT_SIDE: Record<string, number> = { '720p': 720, '1080p': 1080, '4K': 2160 };

interface AssemblyManifest {
  /** Local storage keys of the scene video clips, in order. */
  sceneKeys: string[];
  voiceKey?: string;
  musicKey?: string;
  musicVolume?: number; // 0–1, default 0.25
}

export interface TargetDimensions {
  width: number;
  height: number;
}

/** libx264 rejects odd dimensions under yuv420p, so every derived side is rounded to even. */
function even(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

export function targetDimensions(aspectRatio: ProviderRequest['aspectRatio'], resolution: ProviderRequest['resolution']): TargetDimensions {
  const short = SHORT_SIDE[resolution ?? '1080p'] ?? 1080;
  if (aspectRatio === '16:9') return { width: even((short * 16) / 9), height: short };
  if (aspectRatio === '1:1') return { width: short, height: short };
  return { width: short, height: even((short * 16) / 9) }; // 9:16 — the project default
}

/**
 * Fit-and-letterbox, never crop: a clip that came back at the wrong aspect ratio should show bars,
 * not lose the subject's head. `setsar=1` matters as much as the scale — a non-square pixel
 * aspect ratio surviving into the concat plays back stretched.
 */
function normalizeFilter({ width, height }: TargetDimensions): string {
  return [
    `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`,
    'setsar=1',
    `fps=${TARGET_FPS}`,
  ].join(',');
}

async function materialize(dir: string, key: string, name: string): Promise<string> {
  const buffer = await readObject(key);
  const filePath = path.join(dir, name);
  await writeFile(filePath, buffer);
  return filePath;
}

/**
 * One clip → one file matching the target profile exactly.
 *
 * Clips that carry no audio get a synthesized silent track rather than none: several video models
 * emit native audio and several do not, and concat needs every input to have the same streams. The
 * `-shortest` here is the correct use of the flag — `anullsrc` is infinite, so the video decides
 * the length. (Contrast the mux pass below, where audio is finite and `-shortest` would truncate.)
 *
 * The silence is a *filtergraph source*, not a second `-f lavfi` input, because fluent-ffmpeg
 * validates every input's `-f` against `ffmpeg -formats` — where lavfi does not appear, being
 * registered as a device — and rejects the command before it runs.
 */
async function normalizeClip(inputPath: string, outputPath: string, dims: TargetDimensions): Promise<void> {
  const { hasAudio } = await probeVideo(inputPath);

  const filters = [`[0:v]${normalizeFilter(dims)}[v]`];
  if (!hasAudio) filters.push('anullsrc=r=48000:cl=stereo[a]');

  await runFfmpeg(
    (cmd) =>
      cmd
        .input(inputPath)
        .complexFilter(filters)
        .outputOptions([
          '-map [v]',
          hasAudio ? '-map 0:a:0' : '-map [a]',
          `-r ${TARGET_FPS}`,
          ...NORMALIZE_ENCODE,
          ...NORMALIZE_AUDIO,
          ...(hasAudio ? [] : ['-shortest']),
        ]),
    outputPath,
  );
}

/** Escapes a path for the concat demuxer's `file '…'` syntax. */
function concatEntry(filePath: string): string {
  return `file '${filePath.replace(/'/g, "'\\''")}'`;
}

export const ffmpegAssemblyAdapter: ProviderAdapter = {
  id: 'ffmpeg',
  capabilities: ['video-assembly'],
  supports: () => true,

  async run(req, _ctx) {
    const manifest = req.input as unknown as AssemblyManifest;
    if (!manifest?.sceneKeys?.length) throw new Error('ffmpeg: manifest.sceneKeys is required');
    await assertFfmpegAvailable();

    const dims = targetDimensions(req.aspectRatio, req.resolution);
    const workDir = await mkdtemp(path.join(tmpdir(), 'axl-assembly-'));
    const t0 = Date.now();
    try {
      const clipPaths = await Promise.all(manifest.sceneKeys.map((key, i) => materialize(workDir, key, `scene-${i}.mp4`)));

      const normalizedPaths = await mapWithConcurrency(clipPaths, NORMALIZE_CONCURRENCY, async (clipPath, i) => {
        const outputPath = path.join(workDir, `normalized-${i}.mp4`);
        await normalizeClip(clipPath, outputPath, dims);
        return outputPath;
      });

      const concatListPath = path.join(workDir, 'concat.txt');
      await writeFile(concatListPath, normalizedPaths.map(concatEntry).join('\n'));

      const concatenatedPath = path.join(workDir, 'concatenated.mp4');
      await runFfmpeg(
        (cmd) => cmd.input(concatListPath).inputOptions(['-f concat', '-safe 0']).outputOptions(['-c copy']),
        concatenatedPath,
      );

      const voicePath = manifest.voiceKey ? await materialize(workDir, manifest.voiceKey, 'voice.mp3') : undefined;
      const musicPath = manifest.musicKey ? await materialize(workDir, manifest.musicKey, 'music.mp3') : undefined;

      // No voice and no music (the `skipAudio` path, and any project without a VOICE asset): the
      // concatenated file already is the deliverable. Re-encoding it through a mux pass that has
      // nothing to mux would cost a full generation loss for no change.
      const finalPath = voicePath || musicPath ? path.join(workDir, 'final.mp4') : concatenatedPath;
      if (finalPath !== concatenatedPath) {
        await muxAudio({ videoPath: concatenatedPath, voicePath, musicPath, musicVolume: manifest.musicVolume, outPath: finalPath });
      }

      const buffer = await readFile(finalPath);
      const stored = await putObject(outputKey('ffmpeg', 'mp4'), buffer);

      return {
        outputs: [{ url: stored.url, kind: 'video' as const }],
        providerMeta: {
          provider: 'ffmpeg',
          model: 'local',
          latencyMs: Date.now() - t0,
          scenes: normalizedPaths.length,
          width: dims.width,
          height: dims.height,
          fps: TARGET_FPS,
        },
      };
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  },
};

interface MuxAudioInput {
  videoPath: string;
  voicePath?: string;
  musicPath?: string;
  musicVolume?: number;
  outPath: string;
}

/**
 * Lays voice and/or music over the finished cut. The video is already at the target profile, so it
 * is stream-copied — only audio is encoded.
 *
 * `apad` on the mixed track is what makes `-shortest` safe: without it, audio shorter than the
 * video ends the output early and silently truncates the film. Per-scene voice alignment is still
 * out of scope (the voice track is laid across the whole episode, not per beat) — see
 * `docs/plan/tasks/T14-video-assembly-hardening.md` §5.
 */
async function muxAudio(input: MuxAudioInput): Promise<void> {
  const { videoPath, voicePath, musicPath, outPath } = input;

  await runFfmpeg((cmd) => {
    cmd.input(videoPath);
    if (voicePath) cmd.input(voicePath);
    if (musicPath) cmd.input(musicPath);

    const musicVolume = input.musicVolume ?? 0.25;
    const filters =
      voicePath && musicPath
        ? [`[1:a][2:a]amix=inputs=2:weights=1 ${musicVolume}:duration=longest[mixed]`, '[mixed]apad[a]']
        : ['[1:a]apad[a]'];

    return cmd
      .complexFilter(filters)
      .outputOptions(['-map 0:v:0', '-map [a]', '-c:v copy', ...NORMALIZE_AUDIO, '-shortest']);
  }, outPath);
}
