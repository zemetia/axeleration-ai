import { putObject } from '@/lib/storage';

import { ProviderError, isRetryableStatus } from '../errors';
import type { ProviderAdapter, ProviderOutput, ProviderRequest } from '../types';
import {
  dimensionsFor,
  downloadToStorage,
  extFromUrl,
  mimeForExt,
  outputKey,
  pollUntilDone,
  readAssetBytes,
} from '../util';
import { getPath, renderHeaders, renderString, renderValue } from './template';
import { capabilitiesOf } from './types';
import type { BridgeSpec } from './types';

/**
 * Turns a `BridgeSpec` into a real `ProviderAdapter`.
 *
 * One adapter instance per spec, with `id` taken straight from the spec — deliberately *not* a
 * single `bridge` adapter multiplexing on `ctx.model`. The id is what `ApiKey.provider` is keyed on,
 * so a shared id would force every bridged API to share one credential; giving each its own means
 * the Settings screen, the readiness preflight, the cost forecast and the key verification all treat
 * a bridged API exactly like a hand-written one, with no special cases anywhere downstream.
 *
 * What this owns: auth placement, template rendering, submit, optional polling, output extraction,
 * and persisting outputs to local storage. What it deliberately does not own: retries and provider
 * fallback (the registry's job) and pricing (`aiConfig.costTable`, fed from `spec.cost`).
 */
export function createBridgeAdapter(spec: BridgeSpec): ProviderAdapter {
  const capabilities = capabilitiesOf(spec);
  const modelIds = new Set(
    capabilities.flatMap((capability) => spec.models[capability]?.map((model) => model.id) ?? []),
  );

  return {
    id: spec.id,
    capabilities,
    supports: (model) => modelIds.has(model),

    async run(req, ctx) {
      const t0 = Date.now();
      const vars = await buildVars(spec, req, ctx.apiKey, ctx.model);

      const submitJson = await request(spec, spec.submit, vars, ctx.signal, 'submit');

      let finalJson = submitJson;
      if (spec.poll) {
        const poll = spec.poll;
        const taskId = getPath(submitJson, poll.taskIdPath);
        const pollVars = { ...vars, taskId, submit: submitJson };

        finalJson = await pollUntilDone<unknown>({
          fetchStatus: () => request(spec, poll, pollVars, ctx.signal, 'poll'),
          isDone: (json) => matchesStatus(json, poll.statusPath, poll.doneWhen),
          isFailed: (json) => matchesStatus(json, poll.statusPath, poll.failWhen),
          failureMessage: (json) => {
            const detail = poll.errorPath ? getPath(json, poll.errorPath) : undefined;
            return `${spec.id}: generation failed — ${asText(detail) ?? String(getPath(json, poll.statusPath))}`;
          },
          intervalMs: poll.intervalMs,
          timeoutMs: poll.timeoutMs,
          signal: ctx.signal,
        });
      }

      const source = spec.outputs.from === 'submit' ? submitJson : finalJson;
      const payloads = collectOutputPayloads(spec, source);
      if (!payloads.length) {
        throw new ProviderError(`${spec.id}: no outputs at "${spec.outputs.path}"`, {
          provider: spec.id,
          retryable: false,
        });
      }

      const kind = resolveKind(spec, req, payloads[0] ?? '');
      const outputs: ProviderOutput[] = await Promise.all(
        payloads.map((payload, index) => persist(spec, payload, kind, index)),
      );

      return {
        outputs,
        providerMeta: { provider: spec.id, model: ctx.model, latencyMs: Date.now() - t0 },
      };
    },
  };
}

// ─── Request variables ───────────────────────────────────────────────────────

/**
 * Everything a spec's templates can reference. Named for what a spec author would guess rather than
 * for the `ProviderRequest` field it came from — `{{duration}}`, not `{{durationSeconds}}`.
 */
async function buildVars(
  spec: BridgeSpec,
  req: ProviderRequest,
  apiKey: string,
  model: string,
): Promise<Record<string, unknown>> {
  const { width, height } = dimensionsFor(req.aspectRatio);
  const images = await prepareImages(spec, req);

  return {
    apiKey,
    model,
    prompt: req.prompt,
    negativePrompt: req.negativePrompt,
    /** The first reference image — what a single-image API wants. */
    imageUrl: images[0],
    /** Every reference image, for APIs that accept a list. Absent (not `[]`) when there are none. */
    imageUrls: images.length ? images : undefined,
    duration: req.durationSeconds,
    aspectRatio: req.aspectRatio,
    resolution: req.resolution,
    width,
    height,
    seed: req.seed,
    /** Escape hatch: anything the caller put in `ProviderRequest.input`, as `{{input.whatever}}`. */
    input: req.input ?? {},
  };
}

/**
 * Reference images in the form this vendor accepts.
 *
 * `url` passes the local storage link through untouched, which only works for an API that can reach
 * this app. The default deployment cannot be reached — `LOCAL_STORAGE_PUBLIC_BASE_URL` is localhost —
 * so a hosted vendor needs `data-uri` or `base64`, and those read the bytes off disk rather than
 * through an HTTP round trip to ourselves.
 */
async function prepareImages(spec: BridgeSpec, req: ProviderRequest): Promise<string[]> {
  const urls = (req.referenceImages ?? [])
    .map((ref) => ref.refUrl)
    .filter((url): url is string => Boolean(url));

  if (spec.imageInput === 'url' || urls.length === 0) return urls;

  return Promise.all(
    urls.map(async (url) => {
      const bytes = await readAssetBytes(url);
      const base64 = bytes.toString('base64');
      if (spec.imageInput === 'base64') return base64;
      return `data:${mimeForExt(extFromUrl(url, 'png'))};base64,${base64}`;
    }),
  );
}

// ─── HTTP ────────────────────────────────────────────────────────────────────

type SpecRequest = BridgeSpec['submit'] | NonNullable<BridgeSpec['poll']>;

async function request(
  spec: BridgeSpec,
  config: SpecRequest,
  vars: Record<string, unknown>,
  signal: AbortSignal | undefined,
  phase: 'submit' | 'poll',
): Promise<unknown> {
  const url = new URL(renderString(config.url, vars));
  const headers: Record<string, string> = renderHeaders(config.headers, vars);

  if (spec.auth.in === 'header') {
    headers[spec.auth.name] = renderString(spec.auth.format, vars);
  } else if (spec.auth.in === 'query') {
    url.searchParams.set(spec.auth.name, String(vars['apiKey'] ?? ''));
  }

  const hasBody = 'body' in config && config.body !== undefined && config.method !== 'GET';
  if (hasBody) headers['Content-Type'] ??= 'application/json';

  const res = await fetch(url, {
    method: config.method,
    headers,
    body: hasBody ? JSON.stringify(renderValue((config as { body?: unknown }).body, vars)) : undefined,
    signal,
  });

  if (!res.ok) {
    // The vendor's own words beat "request failed" — a bridge is written against docs, and the
    // first run of a wrong spec is exactly when the 400 body is the whole diagnosis.
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new ProviderError(
      `${spec.id}: ${phase} failed (${res.status})${detail ? ` — ${detail}` : ''}`,
      { provider: spec.id, retryable: isRetryableStatus(res.status) },
    );
  }

  return res.json();
}

function matchesStatus(json: unknown, statusPath: string, values: readonly string[]): boolean {
  const status = asText(getPath(json, statusPath));
  if (status === undefined) return false;
  return values.some((value) => value.toLowerCase() === status.toLowerCase());
}

function asText(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

// ─── Outputs ─────────────────────────────────────────────────────────────────

/** Normalizes "one value", "array of strings" and "array of objects" into a flat list of payloads. */
function collectOutputPayloads(spec: BridgeSpec, source: unknown): string[] {
  const raw = getPath(source, spec.outputs.path);
  const items = Array.isArray(raw) ? raw : [raw];

  return items
    .map((item) => {
      const value = spec.outputs.urlPath ? getPath(item, spec.outputs.urlPath) : item;
      return typeof value === 'string' && value.length > 0 ? value : undefined;
    })
    .filter((value): value is string => value !== undefined);
}

function resolveKind(spec: BridgeSpec, req: ProviderRequest, sample: string): 'image' | 'video' {
  if (spec.outputs.kind !== 'auto') return spec.outputs.kind;

  const ext = extFromUrl(sample, '');
  if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'image';
  if (sample.startsWith('data:video/')) return 'video';
  if (sample.startsWith('data:image/')) return 'image';

  // Extensionless signed URLs are common; the capability is the reliable fallback.
  return req.capability === 'text-to-video' || req.capability === 'image-to-video' ? 'video' : 'image';
}

/** Persists one output — outputs must be local storage URLs, never a vendor link or raw bytes. */
async function persist(
  spec: BridgeSpec,
  payload: string,
  kind: 'image' | 'video',
  index: number,
): Promise<ProviderOutput> {
  const defaultExt = kind === 'image' ? 'png' : 'mp4';
  const isUrl = /^https?:\/\//i.test(payload);
  const treatAsUrl = spec.outputs.encoding === 'url' || (spec.outputs.encoding === 'auto' && isUrl);

  if (treatAsUrl) {
    if (!isUrl) {
      throw new ProviderError(`${spec.id}: output is not a URL — set outputs.encoding to "base64"`, {
        provider: spec.id,
        retryable: false,
      });
    }
    const ext = extFromUrl(payload, defaultExt);
    const stored = await downloadToStorage(payload, outputKey(spec.id, `${index}.${ext}`));
    return { url: stored.url, kind };
  }

  const dataUri = /^data:([^;,]+)?(?:;base64)?,([\s\S]*)$/.exec(payload);
  const base64 = dataUri?.[2] ?? payload;
  const ext = dataUri?.[1]?.split('/')[1] ?? defaultExt;
  const stored = await putObject(outputKey(spec.id, `${index}.${ext}`), Buffer.from(base64, 'base64'));
  return { url: stored.url, kind };
}
