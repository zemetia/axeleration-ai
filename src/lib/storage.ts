import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(/* turbopackIgnore: true */ process.env.LOCAL_STORAGE_DIR ?? './storage');
const PUBLIC_BASE = process.env.LOCAL_STORAGE_PUBLIC_BASE_URL ?? 'http://localhost:3000/media';

function resolveSafe(key: string): string {
  const filePath = path.resolve(ROOT, /* turbopackIgnore: true */ key);
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    throw new Error(`Invalid storage key: ${key}`);
  }
  return filePath;
}

export async function putObject(key: string, data: Buffer): Promise<{ key: string; url: string }> {
  const filePath = resolveSafe(key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, data);
  return { key, url: getUrl(key) };
}

export function getUrl(key: string): string {
  return `${PUBLIC_BASE}/${key.split(path.sep).join('/')}`;
}

export async function readObject(key: string): Promise<Buffer> {
  return readFile(resolveSafe(key));
}

/** Inverse of `getUrl` — recovers the storage key from a URL this module produced. */
export function keyFromUrl(url: string): string {
  if (!isLocalUrl(url)) throw new Error(`Not a local storage URL: ${url}`);
  return url.slice(PUBLIC_BASE.length + 1);
}

/**
 * Did this module produce the URL?
 *
 * The distinction matters on every outbound call: a hosted vendor cannot fetch
 * `http://localhost:3000/media/...`, so an adapter shipping a reference image has to upload or
 * inline the bytes rather than pass the link. Callers that need the bytes go through
 * `localPathFromUrl` (no HTTP round trip) when this is true, and `fetch` when it is not.
 */
export function isLocalUrl(url: string): boolean {
  return url.startsWith(PUBLIC_BASE + '/');
}

/** Absolute filesystem path for a storage key, with the same escape check `putObject` applies. */
export function pathForKey(key: string): string {
  return resolveSafe(key);
}

/** Absolute filesystem path behind a URL this module produced — for SDKs that take a path, not bytes. */
export function localPathFromUrl(url: string): string {
  return pathForKey(keyFromUrl(url));
}
