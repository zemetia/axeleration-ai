import { z } from 'zod';

import type { Capability } from '../types';

/**
 * A declarative description of *any* image/video HTTP API, so adding a vendor is data, not code.
 *
 * The premise of `T03-provider-registry.md` was that a new model should be "a config change, not a
 * new integration" — but that only held for vendors already wrapped in an adapter file. Every genuinely
 * new API still meant a new `*.adapter.ts`, a `register()` line, a catalog entry, a cost entry and a
 * verify probe. A bridge spec collapses all five into one object: `createBridgeAdapter(spec)` turns it
 * into a real `ProviderAdapter`, and the catalog / cost table / key verification read the same object.
 *
 * The shape covers the two request styles essentially every generation API uses:
 *   - **sync** — POST returns the finished outputs (omit `poll`)
 *   - **submit-then-poll** — POST returns a task id, a GET polls it until terminal (set `poll`)
 *
 * Field values are *templates*: `{{prompt}}`, `{{imageUrl}}`, `{{duration}}`, `{{input.cfg}}`, and so
 * on — see `template.ts` for the variable list and the substitution rules. The one rule worth knowing
 * up front: a body key whose template resolves to `undefined` is **dropped**, never sent as `null`,
 * because most vendors reject an explicit null where they happily accept an absent key.
 *
 * `id` doubles as the `ApiKey.provider` value and the `ProviderAdapter.id`, so each bridged API gets
 * its own saved credential and behaves exactly like a first-class provider everywhere else.
 */

/** Bridges cover visual generation only — text, speech and music keep their hand-written adapters. */
export const BRIDGE_CAPABILITIES = [
  'text-to-image',
  'image-to-image',
  'text-to-video',
  'image-to-video',
] as const satisfies readonly Capability[];

export type BridgeCapability = (typeof BRIDGE_CAPABILITIES)[number];

const modelOptionSchema = z.object({
  /** Sent to the vendor as `{{model}}` and stored in `Project.modelConfig`. */
  id: z.string().min(1),
  /** What the Settings dropdown shows. */
  label: z.string().min(1),
});

const priceSchema = z.object({
  per: z.enum(['image', 'second', 'call']),
  usd: z.number().nonnegative(),
});

/**
 * How the saved `ApiKey` is attached. `header` covers `Authorization: Bearer …`, `X-Api-Key: …` and
 * anything else header-shaped; `query` covers `?key=…`; `none` is for a self-hosted endpoint with no
 * credential (it also opts the provider out of the readiness block, since there is nothing to miss).
 */
const authSchema = z.discriminatedUnion('in', [
  z.object({ in: z.literal('none') }),
  z.object({
    in: z.literal('header'),
    name: z.string().min(1).default('Authorization'),
    /** Templated with `{{apiKey}}` — use a bare `{{apiKey}}` for headers that take the raw key. */
    format: z.string().min(1).default('Bearer {{apiKey}}'),
  }),
  z.object({ in: z.literal('query'), name: z.string().min(1) }),
]);

const requestSchema = z.object({
  url: z.string().min(1),
  method: z.enum(['POST', 'GET', 'PUT', 'PATCH']).default('POST'),
  headers: z.record(z.string(), z.string()).default({}),
  /** Any JSON tree; every string inside it is a template. Omit for a GET. */
  body: z.unknown().optional(),
});

const pollSchema = z.object({
  /** Templated. Beyond the request variables it may use `{{taskId}}` and `{{submit.<path>}}`. */
  url: z.string().min(1),
  method: z.enum(['GET', 'POST']).default('GET'),
  headers: z.record(z.string(), z.string()).default({}),
  /** Where the task id lives in the submit response — feeds `{{taskId}}`. */
  taskIdPath: z.string().min(1).default('id'),
  /** Where the status string lives in the poll response. */
  statusPath: z.string().min(1),
  /** Status values that mean "finished, read the outputs". Compared case-insensitively. */
  doneWhen: z.array(z.string().min(1)).min(1),
  /** Status values that mean "give up". Anything not in either list is treated as still running. */
  failWhen: z.array(z.string().min(1)).default([]),
  /** Where the vendor's error message lives in the poll response, for the thrown error. */
  errorPath: z.string().min(1).optional(),
  intervalMs: z.number().int().positive().default(3000),
  timeoutMs: z.number().int().positive().default(600_000),
});

const outputsSchema = z.object({
  /** Which response to read: the poll result (default) or the submit response of a sync API. */
  from: z.enum(['poll', 'submit']).default('poll'),
  /** Path to the outputs. May point at a single value or an array of values. */
  path: z.string().min(1),
  /** Set when the array holds objects rather than strings — the path *within* each item. */
  urlPath: z.string().min(1).optional(),
  /**
   * `auto` reads the file extension, falling back to the capability (`*-to-video` → video).
   * Set it explicitly for vendors that serve extensionless URLs.
   */
  kind: z.enum(['image', 'video', 'auto']).default('auto'),
  /**
   * `auto` handles an `http(s)://` URL, a `data:` URI, or a bare base64 payload. Force `base64`
   * for a vendor whose payload could be mistaken for a URL.
   */
  encoding: z.enum(['auto', 'url', 'base64']).default('auto'),
});

export const bridgeSpecSchema = z.object({
  /** Lowercase slug. Becomes `ProviderAdapter.id` **and** the `ApiKey.provider` this API's key is saved under. */
  id: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'Bridge id must be a lowercase slug (letters, digits, dashes)'),
  label: z.string().min(1),

  /**
   * Which capabilities this API serves, and the models offered for each. The keys present here are
   * the adapter's `capabilities` — there is no separate list to keep in sync. The first model of a
   * capability is what `defaultModelFor()` picks when the registry falls back to this provider.
   */
  models: z
    .object({
      'text-to-image': z.array(modelOptionSchema).min(1).optional(),
      'image-to-image': z.array(modelOptionSchema).min(1).optional(),
      'text-to-video': z.array(modelOptionSchema).min(1).optional(),
      'image-to-video': z.array(modelOptionSchema).min(1).optional(),
    })
    .refine((models) => Object.values(models).some((list) => list?.length), {
      message: 'A bridge must offer at least one model for at least one capability',
    }),

  auth: authSchema.default({ in: 'header', name: 'Authorization', format: 'Bearer {{apiKey}}' }),

  /**
   * How a reference image reaches the vendor. `url` ships the link as-is and only works for an API
   * that can reach this app — outputs live at `LOCAL_STORAGE_PUBLIC_BASE_URL`, which is localhost in
   * development, so a hosted vendor needs `data-uri` or `base64` instead.
   */
  imageInput: z.enum(['url', 'data-uri', 'base64']).default('url'),

  submit: requestSchema,
  /** Omit for a synchronous API that returns its outputs from the submit call. */
  poll: pollSchema.optional(),
  outputs: outputsSchema,

  /**
   * Per-model pricing, merged into `aiConfig.costTable` under this bridge's `id`. Without it every
   * forecast line for this provider reads "unpriced", which also stops auto-pilot from advancing.
   */
  cost: z.record(z.string(), priceSchema).default({}),

  /**
   * The cheapest authenticated read this API offers (a balance or model list — never a generation).
   * Wired into `verifyApiKey()`, so saving a key for this bridge is tested live like any other.
   */
  verify: z
    .object({ url: z.string().min(1), method: z.enum(['GET', 'POST']).default('GET') })
    .optional(),
});

/** Fully-defaulted spec — what `createBridgeAdapter` consumes. */
export type BridgeSpec = z.output<typeof bridgeSpecSchema>;

/** What a human writes in `src/config/bridges.ts`, before defaults are applied. */
export type BridgeSpecInput = z.input<typeof bridgeSpecSchema>;

/** The capabilities a spec serves, derived from the models it declares. */
export function capabilitiesOf(spec: Pick<BridgeSpec, 'models'>): BridgeCapability[] {
  return BRIDGE_CAPABILITIES.filter((capability) => spec.models[capability]?.length);
}

/**
 * Parses and defaults a list of specs, failing loudly with the offending id.
 *
 * Called at registration rather than at import: a malformed spec must not take down a page that
 * merely renders the model dropdown, but it absolutely must stop a pipeline run from starting.
 */
export function parseBridgeSpecs(specs: readonly BridgeSpecInput[]): BridgeSpec[] {
  const parsed = specs.map((spec, index) => {
    const result = bridgeSpecSchema.safeParse(spec);
    if (!result.success) {
      const name = typeof spec.id === 'string' ? spec.id : `#${index}`;
      throw new Error(`Invalid bridge spec "${name}": ${z.prettifyError(result.error)}`);
    }
    return result.data;
  });

  const seen = new Set<string>();
  for (const spec of parsed) {
    if (seen.has(spec.id)) throw new Error(`Duplicate bridge spec id "${spec.id}"`);
    seen.add(spec.id);
  }
  return parsed;
}
