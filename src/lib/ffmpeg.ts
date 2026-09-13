import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import ffmpeg from 'fluent-ffmpeg';

const execFileAsync = promisify(execFile);

/**
 * ffmpeg discovery and probing.
 *
 * RENDER is the last stage of the pipeline, so a missing binary used to surface *after* every scene
 * had been generated and paid for. `assertFfmpegAvailable()` is called before the stage does any
 * work, which turns that into an instant, readable failure.
 */

export function ffmpegPath(): string {
  return process.env.FFMPEG_PATH?.trim() || 'ffmpeg';
}

/** Defaults to the sibling of `FFMPEG_PATH` when only that one is set, since they ship together. */
export function ffprobePath(): string {
  const explicit = process.env.FFPROBE_PATH?.trim();
  if (explicit) return explicit;
  const ffmpegBin = process.env.FFMPEG_PATH?.trim();
  return ffmpegBin ? ffmpegBin.replace(/ffmpeg(\.exe)?$/i, (m) => m.replace(/ffmpeg/i, 'ffprobe')) : 'ffprobe';
}

let verified: Promise<void> | null = null;

/**
 * Verifies both binaries respond, once per process. Only a *successful* check is memoized — caching
 * the rejection would make a fixed PATH stay broken until the server restarts.
 */
export function assertFfmpegAvailable(): Promise<void> {
  verified ??= verify().catch((err: unknown) => {
    verified = null;
    throw err;
  });
  return verified;
}

async function verify(): Promise<void> {
  const binaries: Array<[label: string, bin: string, envVar: string]> = [
    ['ffmpeg', ffmpegPath(), 'FFMPEG_PATH'],
    ['ffprobe', ffprobePath(), 'FFPROBE_PATH'],
  ];

  for (const [label, bin, envVar] of binaries) {
    try {
      await execFileAsync(bin, ['-version']);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(
        `${label} is not runnable at "${bin}". Install ffmpeg and put it on PATH, or set ${envVar} to its full path. (${reason})`,
      );
    }
  }

  // fluent-ffmpeg spawns `ffmpeg`/`ffprobe` off PATH unless told otherwise, so a working
  // FFMPEG_PATH would be ignored by every command without this.
  ffmpeg.setFfmpegPath(ffmpegPath());
  ffmpeg.setFfprobePath(ffprobePath());
}

/** Test seam — lets a suite re-run the check after changing the env. */
export function resetFfmpegAvailability(): void {
  verified = null;
}

export interface VideoProbe {
  width: number;
  height: number;
  /** Frames per second, resolved from `r_frame_rate` (`"30000/1001"` → 29.97). */
  fps: number;
  hasAudio: boolean;
  durationSeconds: number;
}

function parseFps(rate: string | undefined): number {
  if (!rate) return 0;
  const [num, den] = rate.split('/');
  const numerator = Number(num);
  const denominator = den === undefined ? 1 : Number(den);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
  return numerator / denominator;
}

export function probeVideo(filePath: string): Promise<VideoProbe> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err instanceof Error ? err : new Error(String(err)));
      const video = data.streams.find((stream) => stream.codec_type === 'video');
      if (!video) return reject(new Error(`No video stream in ${filePath}`));
      resolve({
        width: Number(video.width ?? 0),
        height: Number(video.height ?? 0),
        fps: parseFps(video.r_frame_rate),
        hasAudio: data.streams.some((stream) => stream.codec_type === 'audio'),
        durationSeconds: Number(data.format.duration ?? 0),
      });
    });
  });
}

/** Runs one command built by `build`, saving to `outPath`. Rejects with ffmpeg's own stderr on failure. */
export function runFfmpeg(build: (cmd: ffmpeg.FfmpegCommand) => ffmpeg.FfmpegCommand, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    build(ffmpeg())
      .on('error', (err: Error, _stdout: string | null, stderr: string | null) =>
        reject(new Error(stderr ? `${err.message}\n${stderr}` : err.message)),
      )
      .on('end', () => resolve())
      .save(outPath);
  });
}
