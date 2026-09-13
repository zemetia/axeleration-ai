# T03 — Provider Registry (multi image/video/voice/music/LLM)

> **Superseded in part by [T13](./T13-provider-bridge.md) (2026-08-07).** Adding an image/video vendor no longer needs an adapter file: a declarative `BridgeSpec` in `src/config/bridges.ts` becomes a full `ProviderAdapter` — catalog entry, key verification, pricing and readiness included. Write a hand-written adapter only when the vendor needs an SDK or a request shape templates cannot express. T13 also moved `wavespeed.adapter.ts` onto the official `wavespeed` npm SDK, which fixed a live bug: reference images were being shipped as unreachable `localhost` URLs.

> **Status (2026-07-27): DONE.** `src/providers/{types,errors,util,registry,catalog}.ts` + `adapters/` written. Capabilities are split per the user's request — Chat (`llm-text`: anthropic, openai, google), Image (`text-to-image`/`image-to-image`: fal, replicate, wavespeed, higgsfield, google), Video (`text-to-video`/`image-to-video`: fal, replicate, wavespeed, higgsfield, seedance, google), Voice (`tts`: elevenlabs), Music (`music`: replicate), Assembly (`video-assembly`: local ffmpeg, not an AI model). Every generation provider is a hosted API — no local model runtime. `src/providers/catalog.ts` exposes the full provider/model list per capability for the future Settings UI (T09 `ProviderModelSelect`) so the user can pick a model per capability, per project. Unit tests in `registry.test.ts` (selection precedence, fallback, reference-image mapping) pass; `npm run lint` on `src/providers/` and `src/config/ai.ts` exits 0.
>
> **Naming collision found + fixed:** `src/providers/` already existed in this template for React context providers (`PostHogProvider`, `QueryProvider`, `index.tsx`). The registry's own barrel is `src/providers/register.ts` (not `index.ts`) to avoid a duplicate-module collision — see [LEARN.md](../../knowledge/LEARN.md) 2026-07-27.
>
> **Higgsfield / Seedance are direct adapters, not aliases of WaveSpeed:** `higgsfield.adapter.ts` calls Higgsfield's own API (`platform.higgsfield.ai`, Bearer key) and `seedance.adapter.ts` calls ByteDance's Seedance directly via BytePlus ModelArk (`ark.ap-southeast.bytepluses.com`, Bearer key) — each has its own `ApiKey.provider` row, separate from the `wavespeed` adapter (which also happens to expose Higgsfield/Seedance models in its own aggregator catalog as a fallback path). Endpoint shapes were verified against public docs as of 2026-07-27, not against a live call with real credentials — re-verify request/response fields against the vendor's dashboard docs before the first real generation.
>
> **Google adapter covers three capabilities from one SDK:** `@google/genai` (`generateContent` for chat, `generateImages`/`generateContent` image parts for Imagen/Gemini image, `generateVideos` + operation polling for Veo). Newly added dependency, not in T01's original package list — added 2026-07-27.

Goal: one interface over many generation vendors/models, selected per capability, with fallback and cost capture. This is what makes "multiple video & image generation models" a config change, not a new integration.

**Depends on:** T01, T02. **Blocks:** T04, T05 (generation MCP server), T07.

Lives in `src/providers/`.

---

## 1. Core types (`src/providers/types.ts`)

```ts
export type Capability =
  | 'text-to-image' | 'image-to-image'
  | 'text-to-video' | 'image-to-video'
  | 'tts' | 'music' | 'video-assembly' | 'llm-text';

export interface AssetRef {
  handle: string;
  type: 'CHARACTER' | 'PERSON' | 'STYLE' | 'LOCATION' | 'MAP' | 'PROP' | 'VOICE';
  refUrl?: string;      // reference image/audio in local storage — shipped to the vendor
  voiceId?: string;     // for TTS
  description?: string;
}

export interface ProviderRequest {
  capability: Capability;
  prompt?: string;                  // already mention-rewritten (see T06)
  negativePrompt?: string;
  referenceImages?: AssetRef[];     // ← auto-attached from @mentions
  voiceId?: string;                 // TTS
  durationSeconds?: number;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  resolution?: '720p' | '1080p' | '4K';
  seed?: number;
  input?: Record<string, unknown>;  // capability-specific extras / assembly manifest
}

export interface ProviderResult {
  outputs: { url: string; kind: 'image' | 'video' | 'audio' | 'text'; meta?: Record<string, unknown> }[];
  costEstimate?: number;            // USD
  providerMeta: { provider: string; model: string; latencyMs: number };
}

export interface ProviderAdapter {
  readonly id: string;                      // "fal" | "replicate" | ...
  readonly capabilities: Capability[];
  supports(model: string): boolean;
  run(req: ProviderRequest, ctx: ProviderContext): Promise<ProviderResult>;
}

export interface ProviderContext {
  apiKey: string;                   // decrypted from ApiKey (T02) at call time
  model: string;                    // resolved model id
  signal?: AbortSignal;
}
```

**Reference-image contract:** every image/video adapter must map `referenceImages[].refUrl` to that vendor's reference/init-image param (fal `image_url`, Replicate model input, IP-Adapter, etc.). TTS adapters map `voiceId`. This is the single line that fulfills "asset mention → sent to AI server."

---

## 2. Registry + selection policy (`src/providers/registry.ts`)

```ts
interface Selection { adapter: ProviderAdapter; provider: string; model: string; }

export const providerRegistry = {
  register(adapter: ProviderAdapter): void { /* push into map by capability */ },

  // Pick a provider for a capability. Order of precedence:
  // 1) explicit override in ProjectRequest, 2) project.modelConfig, 3) aiConfig.defaults
  select(capability: Capability, opts: { project?: ProjectModelConfig; override?: { provider: string; model: string } }): Selection { /* … */ },

  // Run with automatic fallback to the next registered provider on retryable failure.
  async run(capability: Capability, req: ProviderRequest, ctx: SelectCtx): Promise<ProviderResult> { /* try → fallback → throw */ },
};
```

Selection resolves an **ApiKey** (T02) for the chosen provider, decrypts it via `src/lib/crypto.ts`, and passes it in `ProviderContext`. On a retryable error (429/5xx/timeout) it falls back to the next registered provider for that capability; on exhaustion it throws a typed `ProviderError` the pipeline records on the stage.

Every `run` appends `{ provider, model, latencyMs, costEstimate }` so the pipeline can write `EpisodeStage.costEstimate` / `providerMeta`.

---

## 3. Adapters (`src/providers/adapters/`)

Build these v1 adapters. Each is a plain object implementing `ProviderAdapter`. Keep vendor SDK calls isolated here — nothing else imports vendor SDKs.

| File | Provider | Capabilities | Notes |
|---|---|---|---|
| `fal.adapter.ts` | fal.ai | `text-to-image`, `image-to-image`, `text-to-video`, `image-to-video` | Aggregator → many models via `model` id (FLUX, Kling…). Map `referenceImages` → `image_url`. |
| `replicate.adapter.ts` | Replicate | `text-to-image`, `image-to-video`, `music` | Aggregator. `model` = `owner/name:version`. |
| `elevenlabs.adapter.ts` | ElevenLabs | `tts` | `voiceId` required; returns audio → saved to local storage. |
| `anthropic.adapter.ts` | Anthropic | `llm-text` | Wrapped by LangChain in T04; adapter used where raw text gen is needed outside a chain. |
| `ffmpeg-assembly.adapter.ts` | local ffmpeg | `video-assembly` | Input manifest (ordered scene clips + voice + music + aspect/res) → single mp4 → local storage. |

Adapter skeleton:

```ts
// src/providers/adapters/fal.adapter.ts
import { fal } from '@fal-ai/client';
import type { ProviderAdapter } from '../types';

export const falAdapter: ProviderAdapter = {
  id: 'fal',
  capabilities: ['text-to-image', 'image-to-image', 'text-to-video', 'image-to-video'],
  supports: (model) => model.startsWith('fal-ai/'),
  async run(req, ctx) {
    fal.config({ credentials: ctx.apiKey });
    const input = {
      prompt: req.prompt,
      image_url: req.referenceImages?.map((r) => r.refUrl).filter(Boolean),  // ← mention refs
      ...mapAspect(req.aspectRatio),
      ...(req.input ?? {}),
    };
    const t0 = Date.now();
    const out = await fal.subscribe(ctx.model, { input });
    const outputs = normalizeFalOutputs(out); // → save to local storage, return {url, kind}
    return { outputs, providerMeta: { provider: 'fal', model: ctx.model, latencyMs: Date.now() - t0 } };
  },
};
```

Register all adapters once in `src/providers/index.ts` (call `providerRegistry.register(...)`).

---

## 4. Cost table

`src/config/ai.ts` holds a coarse `costTable[provider][model] → { per: 'image'|'second'|'1kchars'|'call', usd }`. `registry.run` computes `costEstimate` from result size. MVP accuracy target: order-of-magnitude, enough for the "why is my bill this size" view.

---

## Acceptance criteria

- [ ] `providerRegistry.select('text-to-image', …)` honors override → project config → default precedence.
- [ ] Each adapter maps `referenceImages` / `voiceId` to its vendor param (verified by unit test with a fake SDK).
- [ ] Fallback: a forced failure on the primary provider routes to the next registered one.
- [ ] Every result carries `providerMeta` + `costEstimate`; outputs are local storage paths/urls, not raw bytes.
- [ ] No vendor SDK imported outside `src/providers/adapters/`.
