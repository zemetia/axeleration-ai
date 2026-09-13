import { isLocalUrl, keyFromUrl, putObject, readObject } from '@/lib/storage';

/** Fetches a vendor-hosted output and persists it to local storage — outputs must never be raw vendor URLs. */
export async function downloadToStorage(url: string, key: string): Promise<{ key: string; url: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download provider output (${res.status}): ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return putObject(key, buffer);
}

export function outputKey(provider: string, ext: string): string {
  return `providers/${provider}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

interface PollOptions<T> {
  fetchStatus: () => Promise<T>;
  isDone: (result: T) => boolean;
  isFailed: (result: T) => boolean;
  failureMessage: (result: T) => string;
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** Generic submit-then-poll helper shared by aggregator-style REST adapters (wavespeed, higgsfield, seedance). */
export async function pollUntilDone<T>(opts: PollOptions<T>): Promise<T> {
  const intervalMs = opts.intervalMs ?? 3000;
  const timeoutMs = opts.timeoutMs ?? 5 * 60 * 1000;
  const deadline = Date.now() + timeoutMs;

  while (true) {
    if (opts.signal?.aborted) throw new Error('Provider polling aborted');
    const result = await opts.fetchStatus();
    if (opts.isFailed(result)) throw new Error(opts.failureMessage(result));
    if (opts.isDone(result)) return result;
    if (Date.now() > deadline) throw new Error('Provider polling timed out');
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export function mapAspectToSize(aspectRatio?: string, base = 1024): string {
  const { width, height } = dimensionsFor(aspectRatio, base);
  return `${width}*${height}`;
}

/**
 * Pixel dimensions for an aspect ratio. Separate from `mapAspectToSize` because the separator is
 * vendor taste — WaveSpeed wants `1024*576`, others want `1024x576` or two distinct fields — and a
 * bridge spec composes whichever it needs from `{{width}}` and `{{height}}`.
 */
export function dimensionsFor(aspectRatio?: string, base = 1024): { width: number; height: number } {
  switch (aspectRatio) {
    case '9:16':
      return { width: Math.round((base * 9) / 16), height: base };
    case '16:9':
      return { width: base, height: Math.round((base * 9) / 16) };
    default:
      return { width: base, height: base };
  }
}

/**
 * Bytes behind an asset URL, whether it is ours or a vendor's.
 *
 * Reference images live in local storage, whose public base is localhost in development — an
 * adapter that needs to *ship* those bytes (inline as base64, or upload to the vendor) must read
 * them off disk rather than fetch a URL no hosted API could reach either.
 */
export async function readAssetBytes(url: string): Promise<Buffer> {
  if (isLocalUrl(url)) return readObject(keyFromUrl(url));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to read asset (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};

/** Lowercase extension from a URL's *path* — query strings on signed vendor URLs are ignored. */
export function extFromUrl(url: string, fallback: string): string {
  const path = url.split(/[?#]/)[0] ?? '';
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  return ext && ext.length <= 4 && /^[a-z0-9]+$/.test(ext) && path.includes('.') ? ext : fallback;
}

export function mimeForExt(ext: string): string {
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}
