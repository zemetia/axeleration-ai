import { BRIDGE_CAPABILITIES } from '@/providers/bridge/types';
import type { BridgeSpecInput } from '@/providers/bridge/types';
import type { ProviderCatalogEntry } from '@/providers/catalog';

/**
 * Bridged image/video APIs — the "plug in a vendor without integrating it" list.
 *
 * Add an entry here and that API becomes a first-class provider everywhere: it appears in
 * Settings → AI Providers, it accepts and live-verifies its own API key, it is priced in the
 * forecast, it passes the readiness preflight, and the SCENES / asset-lab stages can call it. No
 * adapter file, no `register()` line, no SDK.
 *
 * The spec format and every template variable are documented on `BridgeSpec` in
 * `src/providers/bridge/types.ts`. `EXAMPLE_BRIDGE_SPECS` below is a working pair — one synchronous
 * API, one submit-then-poll API — kept out of `bridgeSpecs` on purpose: a spec in the live list shows
 * up in the model dropdown, and a placeholder endpoint there would be an entry the user can select
 * and then watch fail. Copy one, point it at a real host, drop it in `bridgeSpecs`.
 *
 * Two things that are not obvious the first time:
 *
 * - **`id` is the credential.** It becomes both `ProviderAdapter.id` and the `ApiKey.provider` the
 *   key is saved under, so renaming a bridge orphans its saved key.
 * - **`imageInput: 'url'` will not work with a hosted vendor.** Reference images live at
 *   `LOCAL_STORAGE_PUBLIC_BASE_URL`, which is localhost in development — no external API can fetch
 *   it. Use `data-uri` (or `base64`) unless the vendor is on this machine too.
 */
export const bridgeSpecs: BridgeSpecInput[] = [];

/**
 * Copy-paste starting points. Exported (and unit-tested) rather than left in a comment so they stay
 * valid as the schema evolves — a spec that no longer parses fails the test suite instead of quietly
 * becoming misleading documentation.
 */
export const EXAMPLE_BRIDGE_SPECS: BridgeSpecInput[] = [
  {
    // ── Shape A: synchronous. POST returns the finished image. ──
    id: 'example-sync-image',
    label: 'Example vendor (sync image API)',
    models: {
      'text-to-image': [{ id: 'fast-diffusion-v2', label: 'Fast Diffusion v2' }],
      'image-to-image': [{ id: 'fast-diffusion-v2-edit', label: 'Fast Diffusion v2 (edit)' }],
    },
    auth: { in: 'header', name: 'Authorization', format: 'Bearer {{apiKey}}' },
    imageInput: 'data-uri',
    submit: {
      url: 'https://api.example-vendor.com/v1/images/generations',
      method: 'POST',
      body: {
        model: '{{model}}',
        prompt: '{{prompt}}',
        // Absent from the request whenever the caller left them unset — see rule 2 in template.ts.
        negative_prompt: '{{negativePrompt}}',
        image: '{{imageUrl}}',
        seed: '{{seed}}',
        // Interpolation, so this one is a string: "1024x576".
        size: '{{width}}x{{height}}',
      },
    },
    outputs: { from: 'submit', path: 'data', urlPath: 'url' },
    cost: { 'fast-diffusion-v2': { per: 'image', usd: 0.02 }, 'fast-diffusion-v2-edit': { per: 'image', usd: 0.02 } },
    verify: { url: 'https://api.example-vendor.com/v1/models' },
  },
  {
    // ── Shape B: submit-then-poll. POST returns a task id, GET polls it. ──
    id: 'example-async-video',
    label: 'Example vendor (async video API)',
    models: {
      'text-to-video': [{ id: 'motion-xl', label: 'Motion XL' }],
      'image-to-video': [{ id: 'motion-xl-i2v', label: 'Motion XL (image-to-video)' }],
    },
    auth: { in: 'header', name: 'X-Api-Key', format: '{{apiKey}}' },
    imageInput: 'data-uri',
    submit: {
      url: 'https://api.example-vendor.com/v2/{{model}}/submit',
      method: 'POST',
      body: {
        prompt: '{{prompt}}',
        init_image: '{{imageUrl}}',
        // Whole-placeholder, so this stays a JSON number.
        duration_seconds: '{{duration}}',
        aspect_ratio: '{{aspectRatio}}',
      },
    },
    poll: {
      url: 'https://api.example-vendor.com/v2/tasks/{{taskId}}',
      taskIdPath: 'data.task_id',
      statusPath: 'data.state',
      doneWhen: ['succeeded'],
      failWhen: ['failed', 'cancelled', 'timeout'],
      errorPath: 'data.error.message',
      intervalMs: 5000,
    },
    outputs: { path: 'data.assets', urlPath: 'video_url', kind: 'video' },
    cost: { 'motion-xl': { per: 'second', usd: 0.25 }, 'motion-xl-i2v': { per: 'second', usd: 0.25 } },
    verify: { url: 'https://api.example-vendor.com/v2/account' },
  },
];

// ─── Derived views, consumed by the catalog / cost table / key verification ───

/** Catalog entries for every bridged API, appended to `providerCatalog`. */
export function bridgeCatalogEntries(): ProviderCatalogEntry[] {
  return bridgeSpecs.map((spec) => {
    const models: ProviderCatalogEntry['models'] = {};
    for (const capability of BRIDGE_CAPABILITIES) {
      const options = spec.models[capability];
      if (options?.length) models[capability] = [...options];
    }
    return { provider: spec.id, label: spec.label, models };
  });
}

export type BridgePrice = { per: 'image' | 'second' | 'call'; usd: number };

/** `costTable` slice for every bridged API, merged into `aiConfig.costTable`. */
export function bridgeCostTable(): Record<string, Record<string, BridgePrice>> {
  const table: Record<string, Record<string, BridgePrice>> = {};
  for (const spec of bridgeSpecs) {
    if (spec.cost && Object.keys(spec.cost).length) table[spec.id] = { ...spec.cost };
  }
  return table;
}

export interface BridgeProbe {
  url: string;
  header: string;
  /** Templated with `{{apiKey}}`, matching `BridgeSpec.auth.format`. */
  format: string;
}

/** Auth probe per bridged API that declared one — the `verify.ts` half of "does this key work". */
export function bridgeVerifyProbes(): Record<string, BridgeProbe> {
  const probes: Record<string, BridgeProbe> = {};
  for (const spec of bridgeSpecs) {
    const auth = spec.auth ?? { in: 'header' as const };
    // A `query`/`none` bridge has nothing header-shaped to probe with; saving its key stays `unknown`.
    if (!spec.verify || auth.in !== 'header') continue;
    probes[spec.id] = {
      url: spec.verify.url,
      header: auth.name ?? 'Authorization',
      format: auth.format ?? 'Bearer {{apiKey}}',
    };
  }
  return probes;
}
