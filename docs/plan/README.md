# Plan — AI Video Generation Platform

Index for the full build plan. Read in this order.

| # | File | What it covers |
|---|---|---|
| — | [VIDEO_PLATFORM_MVP.md](./VIDEO_PLATFORM_MVP.md) | Product concept: 6 pages, video config, per-episode flow. **Read first for the "what".** |
| — | [ARCHITECTURE.md](./ARCHITECTURE.md) | The "how": 3-layer AI stack (LangGraph orchestration · MCP tooling · Provider registry) + asset-mention flow. **Read second.** |
| T01 | [tasks/T01-dependencies-and-env.md](./tasks/T01-dependencies-and-env.md) | Packages, env vars, config files to add |
| T02 | [tasks/T02-database-schema.md](./tasks/T02-database-schema.md) | Prisma models (field-level) |
| T03 | [tasks/T03-provider-registry.md](./tasks/T03-provider-registry.md) | Multi image/video/voice/music/LLM providers behind one interface |
| T04 | [tasks/T04-langchain-orchestration.md](./tasks/T04-langchain-orchestration.md) | LangChain/LangGraph chains, routing, prompting, structured output, continuity |
| T05 | [tasks/T05-mcp-integration.md](./tasks/T05-mcp-integration.md) | MCP servers + client; expose tools to LangChain |
| T06 | [tasks/T06-asset-mention-system.md](./tasks/T06-asset-mention-system.md) | `@mention` an asset → auto-attach reference to the generation call |
| T07 | [tasks/T07-pipeline-engine.md](./tasks/T07-pipeline-engine.md) | Durable job engine, stage state machine, approve/regenerate |
| T08 | [tasks/T08-services-and-api.md](./tasks/T08-services-and-api.md) | Services, Server Actions, API routes, TanStack Query hooks |
| T09 | [tasks/T09-frontend-pages.md](./tasks/T09-frontend-pages.md) | The 6 pages + components |
| T10 | [tasks/T10-build-phases.md](./tasks/T10-build-phases.md) | Phase-by-phase checklist wiring every task together |
| T11 | [tasks/T11-research-agent.md](./tasks/T11-research-agent.md) | Agentic (ReAct) research loop over a local-Chrome/CDP web search — consumed by SCENES, not a pipeline stage |
| T12 | [tasks/T12-episode-flow-refinements.md](./tasks/T12-episode-flow-refinements.md) | **Implemented and migrated 2026-07-28.** Episode naming, a pre-IDEA `RESEARCH` stage (human/AI-reasoning/AI-CDP modes), and per-scene regenerate via a new `Scene` model |
| T13 | [tasks/T13-provider-bridge.md](./tasks/T13-provider-bridge.md) | **Implemented 2026-08-07.** Declarative bridge: plug any image/video HTTP API in as a full provider from one object in `src/config/bridges.ts` — no adapter file. Also moves WaveSpeed onto its official SDK. |
| T14 | [tasks/T14-video-assembly-hardening.md](./tasks/T14-video-assembly-hardening.md) | **Implemented and migrated 2026-08-07.** ffmpeg normalize-before-concat, preflight, RENDER reads `Scene` rows, `skipAudio` flag. Video-only — music/voice deferred |
| T15 | [tasks/T15-pipeline-spine.md](./tasks/T15-pipeline-spine.md) | **Implemented and migrated 2026-08-07.** One `STAGE_ORDER`, `BREAKDOWN` enum + pass-through stub, new state channels, routing seam, `graphVersion`. Behaviour-neutral scaffolding that unblocks T17–T19 |
| T16 | [tasks/T16-asset-mention-validator.md](./tasks/T16-asset-mention-validator.md) | Pure validator making "the script must tag its assets" enforced rather than merely prompted |
| T17 | [tasks/T17-script-breakdown-split.md](./tasks/T17-script-breakdown-split.md) | SCRIPT writes a screenplay (with roster); BREAKDOWN cuts it into scenes (without roster) |
| T18 | [tasks/T18-idea-refine-mode.md](./tasks/T18-idea-refine-mode.md) | Four distinct Idea actions: Edit / Refine / Regenerate / Re-research |
| T19 | [tasks/T19-idea-critic-loop.md](./tasks/T19-idea-critic-loop.md) | Critic node + conditional RESEARCH ↔ IDEA loop, iteration/budget guardrails, auto-pilot score gate |

---

## Parallel execution (T14–T19)

Each task owns a disjoint set of files, listed at the top of its own doc. Tasks in the same wave can be worked simultaneously by separate sessions without conflict.

| Wave | Tasks | Why they are safe together |
|---|---|---|
| **1** | **T14** · **T15** · **T16** | Zero file overlap. T14 is the assembly adapter + render node; T15 is schema/graph scaffolding; T16 is a pure module with no importers yet |
| **2** | **T17** · **T18** | Both need T15's scaffolding. T17 owns the script/breakdown prompts, nodes and rooms; T18 owns the idea prompt, node and Idea room. The only shared file is `graph.ts`, and T18 touches it for exactly one added export |
| **3** | **T19** | Needs T18's refine mode as its repair action, and T15's routing seam |

The wave-1/wave-2 boundary is the design's load-bearing decision: **T15 lands the enum, the state channels, the node registrations and the routing seam up front, with stub bodies and unchanged behaviour.** T17, T18 and T19 then fill in nodes and prompts inside files they each own alone. Without that, all three would be editing `graph.ts` and `state.ts` at once — and this repo is routinely worked by several sessions in parallel (`docs/knowledge/THIS.md`, 2026-07-28).

**Explicitly deferred, not forgotten:** music assembly, per-scene voice alignment, the dormant `-shortest` truncation bug, and an end-to-end pipeline test against fake providers.

---

## What this plan adds on top of the concept

The concept doc describes the product. This plan makes it buildable with a concrete AI architecture:

1. **LangChain + LangGraph** — orchestration brain. Each episode is a **stateful graph** where every pipeline stage (`IDEA → SCRIPT → SCENES → VOICE → MUSIC → RENDER`) is a node. The graph **interrupts** after each stage and waits for the user's Approve/Regenerate — that maps 1:1 to the Episode Detail page. LangChain also owns prompt templates, structured (Zod) output, and **model routing**.
2. **MCP (Model Context Protocol)** — the standardized **tool/data layer** the LLM calls during orchestration: resolve an asset mention, read the character bible, read continuity state, invoke a generation provider. Built with the MCP TS SDK, loaded into LangChain via the MCP adapters.
3. **Provider registry** — one interface over **multiple image & video (and voice/music/LLM) models**. Adapters map a capability request to a specific vendor/model, so a project can mix models and fall back on failure.
4. **Asset-mention system** — write `@luna` in any prompt; the resolver rewrites the text with the canonical description **and attaches that asset's reference image/audio to the provider call automatically**. This is the "mention an asset → auto-sent to the AI server" requirement.
5. **Research agent** — an on-demand (not a pipeline stage) agentic loop that researches a goal/target/baseline over the live web via a local Chrome (CDP), and hands the SCENES node a source-backed dossier to ground its prompts in. See [T11](./tasks/T11-research-agent.md).

---

## Default stack decisions (v1)

These resolve the open questions from the concept doc so the plan is executable. Every one is swappable — that is the point of the registry/adapter layers.

| Concern | v1 default | Swappable via |
|---|---|---|
| Orchestration | **LangGraph.js** state graph + Postgres checkpointer | `src/ai/graph/` |
| Durable execution / queue | **Inngest** (steps, retries, `waitForEvent` for approvals) | `src/inngest/` |
| Tooling protocol | **MCP** (`@modelcontextprotocol/sdk`) + `@langchain/mcp-adapters` | `src/mcp/` |
| Reasoning LLM | **Claude (`@langchain/anthropic`)**, default `claude-sonnet-5`; OpenAI + Google Gemini also registered | provider registry |
| Image / video models | **fal.ai** and **Replicate** (aggregators) + **WaveSpeed AI** (aggregator) + **Higgsfield** (direct, DoP/Soul) + **Seedance** (ByteDance direct, via BytePlus ModelArk) + **Google** (Imagen + Veo) — chat/image/video/voice/music are separate capabilities, each configurable per project (see [T03](./tasks/T03-provider-registry.md), `src/providers/catalog.ts`) | provider registry |
| Text-to-speech | **ElevenLabs** (voice IDs stored as assets) | provider registry |
| Music | aggregator model (fal/Replicate) or preset library | provider registry |
| Video assembly | **ffmpeg** (`fluent-ffmpeg`) for MVP; Remotion as richer option | assembly adapter |
| Object storage | **Local filesystem** (`storage/` dir, served via a Next.js route) — runs on localhost for now | `src/lib/storage.ts` |
| Research web access | **Local Chrome over CDP** (`playwright-core.connectOverCDP`) — no search-API key, matches local-first | `src/lib/browser-cdp.ts` |
| API-key storage | AES-256-GCM encrypted at rest (`src/lib/crypto.ts`) | — |
| UI components | **HeroUI v3** (`@heroui/react`), replacing the earlier hand-rolled shadcn-style `ui/` set (2026-07-27) — see [DESIGN_SYSTEM.md](../blueprint/DESIGN_SYSTEM.md) → HeroUI Theme Bridge | `src/app/globals.css`, [COMPONENTS.md](../blueprint/COMPONENTS.md) |

> Using an **aggregator gateway (fal.ai / Replicate)** is the key move that makes "multiple video & image generation models" cheap to support: many models behind one HTTP shape, so adding a model is a config entry, not a new integration.

> **Local-first note (2026-07-26):** this runs on the developer's machine for now, so object storage is the **local filesystem** (`storage/` at repo root, gitignored), not Cloudflare R2. `src/lib/storage.ts` exposes the same `putObject/getUrl` shape either way — swapping to R2/S3 later is a one-file change (see [T01](./tasks/T01-dependencies-and-env.md)).

---

## How to execute (for the coding agent)

- Follow tasks **T01 → T10 in order**; T10 is the master checklist and names cross-file dependencies.
- Obey every repo non-negotiable: read [CLAUDE.md](../../CLAUDE.md), [docs/blueprint/INDEX.md](../blueprint/INDEX.md), [docs/knowledge/THIS.md](../knowledge/THIS.md), [docs/knowledge/LEARN.md](../knowledge/LEARN.md) before touching code.
- **Correction that overrides INDEX.md**: this repo uses `src/middleware.ts` (`export function middleware`) + `src/proxy/` modules. Never create root `proxy.ts` (see [LEARN.md](../knowledge/LEARN.md) 2026-06-09).
- Verify exact package versions at install time (LangChain/LangGraph/MCP move fast); pin after `npm install`.
- `npm run lint` must exit 0 after every task.

---

## Glossary

| Term | Meaning |
|---|---|
| **Character Bible** | Locked identity (visual traits + reference image) reused in every prompt so a character doesn't drift across episodes |
| **Continuity State** | Rolling narrative summary ("what has happened") fed to the idea engine of the next episode |
| **Stage** | One node in the episode pipeline: `IDEA / SCRIPT / SCENES / VOICE / MUSIC / RENDER` |
| **Capability** | A generation ability: `text-to-image`, `image-to-video`, `tts`, etc. Providers register per capability |
| **Asset** | A reusable, `@mention`-able reference (character/person/style/location/prop/voice) with a stored reference file |
| **Mention** | `@handle` token in a prompt that resolves to an Asset and injects its reference into the provider call |
