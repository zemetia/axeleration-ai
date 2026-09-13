'use client';

/**
 * Plain GET fetcher for the read hooks.
 *
 * These reads used to call Server Actions. That was wrong on three counts, and it is the
 * main reason the app felt unresponsive:
 *
 *  1. Server Actions are POSTs that Next.js runs through a **serial queue** — only one is
 *     in flight per client at a time. A page mounting `useProject` + `useEpisodes` +
 *     `useAssets` executed three round-trips back-to-back instead of in parallel.
 *  2. Every Server Action response also carries a re-render of the *entire current route's*
 *     RSC tree. Reading a list of projects re-ran the layout, the auth check and every
 *     server component on the page, then shipped that payload back — for a read.
 *  3. They can never be cached, revalidated or prefetched: POST is opaque to every layer
 *     between the browser and the handler.
 *
 * GET route handlers have none of those properties: parallel, cacheable, no RSC re-render.
 */
export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Request failed with ${res.status}`);
  }
  return res.json() as Promise<T>;
}
