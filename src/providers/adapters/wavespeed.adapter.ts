import { Client } from 'wavespeed';

import { isLocalUrl, localPathFromUrl } from '@/lib/storage';

import { ProviderError } from '../errors';
import type { ProviderAdapter, ProviderOutput } from '../types';
import { downloadToStorage, extFromUrl, mapAspectToSize, outputKey } from '../util';

/**
 * WaveSpeed AI — an aggregator exposing 1,000+ models behind one submit-then-poll REST shape.
 *
 * Built on the vendor's own SDK (`wavespeed`, MIT, zero dependencies) rather than hand-rolled fetch,
 * for one reason that mattered and two that were free. The one that mattered: `client.upload()`.
 * Reference images live in local storage, whose public base is `http://localhost:3000/media` — a
 * hosted vendor cannot fetch that, so the previous version silently shipped an unreachable link for
 * every @mention. The free ones: the SDK already models the vendor's terminal states, and
 * `runNoThrow` returns the task id even on failure, which is the one thing a support ticket needs.
 *
 * Two properties of the SDK worth knowing, both handled below:
 *
 * - **It has no `AbortSignal`.** `run()` owns its own polling loop. `ctx.signal` is honoured by
 *   racing it, so the caller unblocks — but the *vendor-side task keeps running and keeps billing*.
 *   That is not a regression (nothing in the UI can cancel a run yet) but it is a real limit: a
 *   true cancel needs a vendor cancel endpoint, not a local abort.
 * - **It reads `WAVESPEED_API_KEY` at import.** Never relied on here: the key is always passed to
 *   the constructor, because it comes from the user's encrypted `ApiKey` row, not the environment.
 */

/**
 * Origin only — the SDK appends `/api/v3/...` itself (`_submit`, `_wait`, `upload`). Passing the
 * versioned path here produced `…/api/v3/api/v3/<model>`, i.e. a 404 on *every* submit, which the
 * fallback chain then reported as the useless "All providers exhausted".
 */
const BASE_URL = 'https://api.wavespeed.ai';

/** Video models are the slow path; an image poll every second is wasted requests on an 8s clip. */
const POLL_INTERVAL_SECONDS = { image: 1, video: 5 } as const;

function kindForModel(model: string): 'image' | 'video' {
  return /video/.test(model) ? 'video' : 'image';
}

/**
 * A reference image the vendor can actually reach.
 *
 * Local storage URLs are uploaded to WaveSpeed and swapped for the returned CDN link; anything
 * already public is passed through untouched. `upload()` takes a *path*, not bytes, which is why
 * `localPathFromUrl` exists — the file is already on this disk, so there is nothing to buffer.
 */
async function publicImageUrl(client: Client, refUrl: string | undefined): Promise<string | undefined> {
  if (!refUrl) return undefined;
  if (!isLocalUrl(refUrl)) return refUrl;
  return client.upload(localPathFromUrl(refUrl));
}

/**
 * Whether another provider is worth trying for this failure.
 *
 * Cannot be answered by `instanceof`/`name`: `runNoThrow` catches the typed exception the SDK threw
 * and re-wraps it, so a `WavespeedSubmissionException` comes back out as a
 * `WavespeedUnknownException` whose *message* is the original one. Checking the class therefore
 * called every failure retryable, and a permanently broken request (bad model id → 404) burned a
 * turn on every other registered adapter before surfacing as "All providers exhausted".
 *
 * So: match the message the way the SDK matches its own. A 4xx other than 429 is the caller's
 * fault and will fail identically next time; 429/5xx/timeouts are worth a fallback.
 */
function isRetryableFailure(error: unknown): boolean {
  const text = String(error instanceof Error ? error.message : (error ?? '')).toLowerCase();
  if (/http 4\d\d/.test(text) && !text.includes('429')) return false;
  return true;
}

/** Rejects when `signal` aborts, so a caller can stop waiting on the SDK's internal poll loop. */
function abortRace<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new Error('wavespeed: aborted before submit'));
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      signal.addEventListener(
        'abort',
        () => reject(new Error('wavespeed: aborted (the vendor task keeps running)')),
        { once: true },
      );
    }),
  ]);
}

export const wavespeedAdapter: ProviderAdapter = {
  id: 'wavespeed',
  capabilities: ['text-to-image', 'image-to-image', 'text-to-video', 'image-to-video'],
  supports: () => true,

  async run(req, ctx) {
    const kind = kindForModel(ctx.model);
    const client = new Client(ctx.apiKey, { baseUrl: BASE_URL, maxRetries: 0 });

    const t0 = Date.now();
    const image = await publicImageUrl(client, req.referenceImages?.find((r) => r.refUrl)?.refUrl);

    const input: Record<string, unknown> = {
      prompt: req.prompt,
      negative_prompt: req.negativePrompt,
      image,
      duration: req.durationSeconds,
      size: kind === 'image' ? mapAspectToSize(req.aspectRatio) : undefined,
      seed: req.seed,
      ...(req.input ?? {}),
    };
    // The vendor 400s on an explicit null where it accepts an absent key.
    for (const key of Object.keys(input)) {
      if (input[key] === undefined) delete input[key];
    }

    const result = await abortRace(
      client.runNoThrow(ctx.model, input, { pollInterval: POLL_INTERVAL_SECONDS[kind] }),
      ctx.signal,
    );

    if (!result.outputs?.length) {
      const error = result.detail.error;
      throw new ProviderError(
        `wavespeed: ${error?.message ?? 'no outputs returned'} (task ${result.detail.taskId || 'unknown'})`,
        {
          provider: 'wavespeed',
          retryable: isRetryableFailure(error),
          cause: error,
        },
      );
    }

    const urls = result.outputs.filter((url: unknown): url is string => typeof url === 'string');
    const outputs: ProviderOutput[] = await Promise.all(
      urls.map(async (url, i) => {
        const ext = extFromUrl(url, kind === 'image' ? 'png' : 'mp4');
        const stored = await downloadToStorage(url, outputKey('wavespeed', `${i}.${ext}`));
        return { url: stored.url, kind, meta: { taskId: result.detail.taskId } };
      }),
    );

    return {
      outputs,
      providerMeta: { provider: 'wavespeed', model: ctx.model, latencyMs: Date.now() - t0 },
    };
  },
};
