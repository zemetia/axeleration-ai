# T01 — Dependencies & Environment

> **Status (2026-07-26): DONE.** Packages installed, `.env.example` updated, `storage/` created + gitignored, `src/lib/storage.ts` / `src/lib/crypto.ts` / `src/config/ai.ts` / `src/inngest/client.ts` + serve route / `src/app/api/media/[...path]/route.ts` all written and smoke-tested. `npm run lint`, `type-check`, and `build` all pass. One accepted, non-blocking build warning: Next's file tracer flags `src/lib/storage.ts` for dynamic `fs`/`path` calls in the media route — expected, since that route legitimately serves a caller-supplied path; does not affect `dev`/`start`/exit code.

Goal: install every package the AI stack needs and declare all config/env. No feature code yet.

**Depends on:** nothing. **Blocks:** all other tasks.

---

## 1. Packages

Verify latest versions at install time (LangChain/LangGraph/MCP move fast), then pin. Group installs so a failure is easy to locate.

```bash
# LangChain core + LangGraph orchestration
npm i langchain @langchain/core @langchain/langgraph @langchain/anthropic @langchain/openai
npm i @langchain/langgraph-checkpoint-postgres
```

```bash
# MCP (server + client) and the LangChain bridge
npm i @modelcontextprotocol/sdk @langchain/mcp-adapters
```

```bash
# Generation provider SDKs (aggregators + direct vendors)
npm i @fal-ai/client replicate @elevenlabs/elevenlabs-js
```

> The `elevenlabs` package is deprecated in favor of `@elevenlabs/elevenlabs-js` — use the latter (installed 2026-07-26).

```bash
# Durable execution / queue
npm i inngest
```

```bash
# Media assembly (object storage is local filesystem — no SDK needed, see §2/§3)
npm i fluent-ffmpeg
npm i -D @types/fluent-ffmpeg
```

> `ffmpeg` binary must exist on the host/deploy image (or use `ffmpeg-static`). Note this in the deploy checklist; on Windows dev, install ffmpeg and ensure it's on `PATH`.

Already present (do not reinstall): `@tanstack/react-query`, `zustand`, `zod`, `prisma`, `@prisma/client`, `next-auth`, `bcryptjs`, `sonner`, `@sentry/nextjs`.

---

## 2. Environment variables

Add to `.env.example` (and document in [STRUCTURE.md](../../blueprint/STRUCTURE.md) env section). **Provider API keys that a user configures in the Settings page live encrypted in the DB, not here** — the env keys below are platform-level only.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes (exists) | Postgres — also used by LangGraph checkpointer |
| `AUTH_SECRET` | yes (exists) | NextAuth |
| `APP_ENCRYPTION_KEY` | yes | 32-byte base64 key for AES-256-GCM in `src/lib/crypto.ts` (encrypts stored provider keys). `openssl rand -base64 32` |
| `INNGEST_EVENT_KEY` | prod | Inngest event ingestion (local dev uses the Inngest Dev Server, no key needed) |
| `INNGEST_SIGNING_KEY` | prod | Inngest request signing |
| `LOCAL_STORAGE_DIR` | yes | Absolute or repo-relative path where generated assets/renders are written, e.g. `./storage` |
| `LOCAL_STORAGE_PUBLIC_BASE_URL` | yes | Base path the app serves those files from, e.g. `http://localhost:3000/media` (see §3 serving route) |
| `PLATFORM_ANTHROPIC_API_KEY` | optional | Fallback LLM key if a project has none configured |
| `MCP_TRANSPORT` | optional | `stdio` (default, in-process) or `http` |

> Never put any of these in URL params or client bundles. Provider keys entered by users are read from the DB and decrypted server-side only.
>
> **Local-only storage caveat:** `storage/` lives on disk next to the app — fine for a single-machine dev setup, but it means generated assets are not backed up and won't survive a deploy to a stateless host. Add `storage/` to `.gitignore`. Migrating to Cloudflare R2/S3 later only requires rewriting `src/lib/storage.ts` (§3) — nothing else in the codebase should know where files physically live.

---

## 3. Config files to create

| File | Purpose | Task |
|---|---|---|
| `src/lib/storage.ts` | Local filesystem storage: `putObject`, `getUrl`, `readObject` | T03/T07/T08 use it |
| `src/app/api/media/[...path]/route.ts` | Serves files out of `LOCAL_STORAGE_DIR` at `LOCAL_STORAGE_PUBLIC_BASE_URL` | T07/T08/T09 |
| `src/lib/crypto.ts` | `encryptSecret` / `decryptSecret` (AES-256-GCM, key from `APP_ENCRYPTION_KEY`) | T02/T08 |
| `src/inngest/client.ts` | `export const inngest = new Inngest({ id: 'axeleration-ai' })` | T07 |
| `src/app/api/inngest/route.ts` | Inngest serve handler (`GET/POST/PUT`) | T07 |
| `src/config/ai.ts` | Static AI config: default model ids per capability, concurrency limits, scene fan-out cap, cost table | T03/T04 |
| `prisma.config.ts` | already exists — no change | — |

`src/lib/storage.ts` shape (local filesystem implementation, same interface a future R2/S3 adapter would implement):

```ts
// src/lib/storage.ts
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.env.LOCAL_STORAGE_DIR ?? './storage');
const PUBLIC_BASE = process.env.LOCAL_STORAGE_PUBLIC_BASE_URL ?? 'http://localhost:3000/media';

export async function putObject(key: string, data: Buffer): Promise<{ key: string; url: string }> {
  const filePath = path.join(ROOT, key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, data);
  return { key, url: `${PUBLIC_BASE}/${key}` };
}

export function getUrl(key: string): string {
  return `${PUBLIC_BASE}/${key}`;
}

export async function readObject(key: string): Promise<Buffer> {
  return readFile(path.join(ROOT, key));
}
```

Key convention (mirrors what would become an S3 key later): `projects/<projectId>/assets/<assetId>.<ext>`, `projects/<projectId>/episodes/<episodeId>/<stageKind>/<n>.<ext>`.

`src/app/api/media/[...path]/route.ts` is a thin Route Handler (`GET`) that resolves the requested path under `LOCAL_STORAGE_DIR` via `readObject`, sets the right `Content-Type`, and streams it back — this is what lets `<img>`/`<video>`/`<audio>` tags in the UI (T09) point at `LOCAL_STORAGE_PUBLIC_BASE_URL` and just work. Reject any path containing `..` before resolving (path-traversal guard).

`src/config/ai.ts` shape:

```ts
export const aiConfig = {
  defaults: {
    llmText: { provider: 'anthropic', model: 'claude-sonnet-5' },
    textToImage: { provider: 'fal', model: 'fal-ai/flux/dev' },
    imageToVideo: { provider: 'fal', model: 'fal-ai/kling-video/v1/standard' },
    tts: { provider: 'elevenlabs', model: 'eleven_multilingual_v2' },
    music: { provider: 'replicate', model: 'meta/musicgen' },
  },
  limits: { sceneConcurrency: 3, maxScenesPerEpisode: 60, maxRegenPerStage: 10 },
} as const;
```

---

## Acceptance criteria

- [ ] All packages install; `npm run lint` and `npm run build` still pass (no imports yet is fine).
- [ ] `.env.example` updated with every variable above.
- [ ] `storage/` created at repo root and added to `.gitignore`.
- [ ] `src/config/ai.ts`, `src/lib/storage.ts`, `src/lib/crypto.ts` work end-to-end (storage: write then read back a test buffer; crypto: round-trip encrypt/decrypt).
- [ ] `src/app/api/media/[...path]/route.ts` serves a file written via `putObject` and rejects a `..` path with 400/404.
- [ ] `ffmpeg -version` works on the dev machine.
