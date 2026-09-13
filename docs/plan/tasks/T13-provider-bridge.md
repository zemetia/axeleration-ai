# T13 — Generation Bridge (plug in any image/video API without writing an adapter)

> **Status (2026-08-07): DONE.** `src/providers/bridge/{types,template,adapter}.ts` + `src/config/bridges.ts`. Unit tests in `src/providers/bridge/{template,adapter}.test.ts` (21 cases) pass; `npm run lint` and `npm run type-check` are clean for everything this task touched.

**Depends on:** T03. **Related:** T07 (SCENES calls this), T09 (Settings → AI Providers reads the catalog).

---

## The problem

T03 promised that a new model would be "a config change, not a new integration". That held only for vendors already wrapped in an adapter file. A genuinely new API still meant five edits in five places:

| What | Where |
|---|---|
| The HTTP calls | a new `src/providers/adapters/*.adapter.ts` |
| Registration | `src/providers/register.ts` |
| Model dropdown | `src/providers/catalog.ts` |
| Forecast pricing | `aiConfig.costTable` |
| Key verification | `src/providers/verify.ts` |

A bridge spec collapses all five into one object.

```
API 1 ─┐
API 2 ─┼─→  BridgeSpec  ─→  createBridgeAdapter()  ─→  ProviderAdapter  ─→  SCENES / asset lab
API 3 ─┘   (declarative)      (one per spec)          (registry, unchanged)
```

Input: `text`, `image`. Output: `image`, `video`. Same `ProviderRequest` / `ProviderResult` contract every hand-written adapter already speaks — nothing downstream knows a provider was bridged.

---

## Adding an API

Append to `bridgeSpecs` in [`src/config/bridges.ts`](../../../src/config/bridges.ts). Two complete, unit-tested starting points live in the same file as `EXAMPLE_BRIDGE_SPECS` — one synchronous API, one submit-then-poll API. That is the whole procedure; there is no code to write and no registration step.

```ts
{
  id: 'my-vendor',                      // ← also the ApiKey.provider this vendor's key is saved under
  label: 'My Vendor',
  models: {                             // ← the keys present here ARE the adapter's capabilities
    'text-to-video': [{ id: 'motion-v1', label: 'Motion v1' }],
  },
  auth: { in: 'header', name: 'Authorization', format: 'Bearer {{apiKey}}' },
  imageInput: 'data-uri',
  submit: {
    url: 'https://api.my-vendor.com/v1/{{model}}',
    body: { prompt: '{{prompt}}', init_image: '{{imageUrl}}', seconds: '{{duration}}' },
  },
  poll: {
    url: 'https://api.my-vendor.com/v1/tasks/{{taskId}}',
    taskIdPath: 'data.id', statusPath: 'data.status',
    doneWhen: ['completed'], failWhen: ['failed', 'cancelled'], errorPath: 'data.error',
  },
  outputs: { path: 'data.outputs', kind: 'video' },
  cost: { 'motion-v1': { per: 'second', usd: 0.25 } },
  verify: { url: 'https://api.my-vendor.com/v1/balance' },
}
```

What that one object buys, with no further edits:

- appears in **Settings → AI Providers** for every capability it declares (`providerCatalog` is `[...builtIn, ...bridgeCatalogEntries()]`)
- accepts its own API key, **live-verified on save** through the `verify` probe (`verifyApiKey` falls through to `bridgeProbe`)
- is **priced** in the run/approve dialog (`spec.cost` is spread into `aiConfig.costTable`), so auto-pilot will advance past it instead of stopping on an unpriced line
- passes/blocks the **readiness preflight** like any other provider, because readiness keys on `ApiKey.provider === adapter.id`
- is selectable per project per capability via `Project.modelConfig`, and is a **fallback candidate** in `providerRegistry.run()`

---

## Template rules

Every string in a spec is a template. Variables: `apiKey`, `model`, `prompt`, `negativePrompt`, `imageUrl`, `imageUrls`, `duration`, `aspectRatio`, `resolution`, `width`, `height`, `seed`, `input.*`. Inside `poll`, also `taskId` and `submit.*`.

Three rules, all enforced in `template.ts` and covered by tests:

1. **A string that is only a placeholder keeps its type.** `"{{duration}}"` sends the number `8`; `"{{width}}x{{height}}"` interpolates to the string `"1024x576"`.
2. **An object key whose value resolves to `undefined` is dropped.** A spec lists every parameter the vendor supports; the ones this request did not fill are absent, never `null` — most vendors 400 on an explicit null.
3. **An unresolved inline placeholder renders empty**, so a bad spec fails as a 404 rather than as a literal `.../undefined/result`.

---

## Things that bite

- **`id` is the credential.** It is both `ProviderAdapter.id` and `ApiKey.provider`. Renaming a bridge orphans its saved key.
- **`imageInput: 'url'` does not work with a hosted vendor.** Reference images live at `LOCAL_STORAGE_PUBLIC_BASE_URL`, which is `http://localhost:3000/media` in development — no external API can fetch it. Use `data-uri` (the default in both examples), which reads the bytes off disk rather than through an HTTP round trip to ourselves. This was a live bug in the WaveSpeed adapter before T13; see below.
- **Specs are parsed at registration, not at import.** A malformed spec throws from `registerProviders()` (naming the offending `id`), so it stops a pipeline run but not the page that merely renders the model dropdown.
- **Bridges are registered last**, so they are only ever considered as fallbacks *after* the hand-written adapters.
- Bridges cover the four visual capabilities only (`text-to-image`, `image-to-image`, `text-to-video`, `image-to-video`). Text, speech and music keep their hand-written adapters — an LLM adapter is a streaming/tool-calling surface, not a submit-then-poll one.

---

## WaveSpeed moved onto the official SDK

Same pass: `wavespeed.adapter.ts` now uses the vendor's own `wavespeed` npm package (official, MIT, zero dependencies, ships its own types) instead of hand-rolled `fetch`.

The reason was **`client.upload()`**, not tidiness. The old adapter passed `referenceImages[].refUrl` straight through, which is a `http://localhost:3000/media/...` link — every @mention silently shipped a URL the vendor could not fetch. Local URLs are now uploaded and swapped for the returned CDN link; already-public URLs pass through.

Two SDK properties to know:

- **No `AbortSignal`.** `run()` owns its polling loop. `ctx.signal` is honoured by racing it so the caller unblocks, but **the vendor-side task keeps running and keeps billing**. A real cancel needs a vendor cancel endpoint. (Nothing in the UI can cancel a run today either — see THIS.md 2026-07-29.)
- **It reads `WAVESPEED_API_KEY` at import.** Never relied on: the key always comes from the user's encrypted `ApiKey` row and is passed to the constructor.

`runNoThrow` is used instead of `run` so the task id is available on failure and lands in `providerMeta` / output `meta`.

---

## Acceptance criteria

- [x] A new image/video API is usable end-to-end from one object in `src/config/bridges.ts` — no new file, no registration line.
- [x] Both request styles work: synchronous (`outputs.from: 'submit'`) and submit-then-poll.
- [x] Reference images reach the vendor as a URL, a data URI, or raw base64, chosen per spec.
- [x] Outputs are persisted to local storage — never a vendor URL, never raw bytes — whether the vendor returned a link, a data URI, or base64.
- [x] A bridged provider is verified, priced, preflighted and selectable exactly like a hand-written one.
- [x] A malformed spec fails at registration, naming the spec.
