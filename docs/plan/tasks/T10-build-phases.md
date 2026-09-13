# T10 — Build Phases & Master Checklist

The order to build in, the dependency graph, and per-phase "definition of done". Each phase ends with `npm run lint` (exit 0) + `npm run build`.

---

## Dependency graph

```
T01 deps/env
  └─► T02 schema
        ├─► T03 provider registry ──┐
        │        └─► T05 MCP        │
        ├─► T06 asset-mention ──────┤
        │                            ▼
        └─────────────────► T04 LangGraph orchestration
                                     │
                                     ▼
                              T07 pipeline engine
                                     │
                                     ▼
                              T08 services/API
                                     │
                                     ▼
                              T09 frontend
```

---

## Phase 0 — Foundation ✅ DONE (2026-07-27)
**Tasks:** T01, T02.
- [x] Packages installed + pinned; `.env.example` complete; `src/config/ai.ts`, `src/lib/storage.ts`, `src/lib/crypto.ts` compile and are smoke-tested.
- [x] Prisma models written, formatted, validated, `db:generate` clean.
- [x] Prisma models **migrated** — local Postgres via `docker-compose.yml` (port `5436`), migration `init_video_platform` applied.
- **DoD:** `npm run build`, `lint`, `type-check` all pass with schema + config in place, no features yet.

> Next up: Phase 1 (T08 project/asset/apiKey services + actions, T09 pages 1/2/3/5/6).

## Phase 1 — Project CRUD (no real generation)
**Tasks:** T08 ✅ (project/asset/apiKey/episode/generation services + all 8 actions + stages route + query hooks — 2026-07-27), T09 ✅ (pages 1, 2, 3, 5, 6 — 2026-07-27, HeroUI).
- [x] Create/edit project incl. Video Config + live scene-count warning. (`/projects/new`, `/projects/[id]/edit`)
- [x] Dashboard lists projects; Project Detail lists episodes (empty ok). (`/dashboard`, `/projects/[id]`)
- [x] Asset Library + Settings pages work (assets saved to local storage; keys encrypted). (`/projects/[id]/assets`, `/settings`)
- [x] `project/bible.generate` is **real, not stubbed** (2026-07-28, T07): `generate-bible` runs the identity-lock chain and flips the row to `ready`/`failed`. Needs an LLM key to actually resolve.
- **DoD:** a user can create a project, add assets, save keys — end to end. Pages are wired to the real T08 hooks (no mock data). **Not yet smoke-tested in a running browser** — `npm run build`'s Turbopack/CSS compile step passes, but the repo-wide TypeScript `type-check` currently fails on unrelated in-progress T04 code (`src/ai/graph/nodes/scenes.node.ts`), so a clean `npm run build` end-to-end is blocked on that, not on T09.
- Bonus (not in original 6-page scope): added `/sign-in` + `/register`, since neither existed and nothing was reachable without them.

## Phase 2 — Provider layer + asset mentions
**Tasks:** T03, T06.
- [x] Provider registry with fal + replicate + wavespeed + higgsfield + seedance + google + anthropic + openai + elevenlabs + ffmpeg-assembly adapters; selection + fallback + cost. (2026-07-27, see [T03](./T03-provider-registry.md))
- [x] Mention parser + resolver; unit/integration tests (CHARACTER → referenceImages; VOICE → voiceId). (2026-07-27, see [T06](./T06-asset-mention-system.md))
- **DoD:** given a prompt with `@mentions`, a single `providerRegistry.run(...)` produces a real asset in local storage with the reference attached. *(Resolver + registry each work standalone and are unit-tested; wiring mention resolution into a live pipeline stage still lands with T04/T07.)*

## Phase 3 — Orchestration + MCP ✅ DONE (2026-07-28)
**Tasks:** T04, T05.
- [x] Model router + stage prompt templates + structured script output.
- [x] LangGraph state graph compiles with Postgres checkpointer + per-stage interrupts.
- [x] Continuity summary chain bounded (`CONTINUITY_MAX_CHARS`, truncation test).
- [x] 3 MCP servers + LangChain bridge, every tool project-scoped. **Nodes deliberately do not bind the tools** — the pipeline path stays deterministic; see [T05](./T05-mcp-integration.md) status.
- **DoD:** the graph is wired and invokable (T07 drives it), but "runs IDEA→SCRIPT with real persisted output" has **not been observed** — that needs a provider API key and a running `inngest-cli dev`.

## Phase 4 — Durable pipeline + review UI
**Tasks:** T07, T08 (episode/stage actions + polling), T09 (page 4).
- [x] Inngest functions: generate-episode, resume-stage, regenerate-stage, generate-bible (2026-07-28 — all four registered at `/api/inngest`, per-project/per-episode concurrency capped).
- [ ] Full pipeline IDEA→RENDER with approve/regenerate resuming the graph. *(Code path complete end to end; never executed against real providers — no API keys, no `inngest-cli dev` run yet. This box needs a real run, not a review.)*
- [x] Episode Review page: stage panels, previews, polling, Approve/Regenerate. *(UI built ahead of the pipeline — `StageTimeline`/`StagePanel` poll `useEpisodeStages` and call Approve/Regenerate correctly, but there is nothing on the backend yet to populate stage data, so it only renders empty `PENDING` stages until T07 lands.)*
- [x] Continuity updated on finalize (`inngest/finalize.ts`, on RENDER approval); n8n webhook fired on every terminal state (env-level config + HMAC signature — see [T07](./T07-pipeline-engine.md)); real character bible generation replaces the Phase-1 stub.
- **DoD:** generate a full episode, approve each stage, get a final video in local storage, continuity advances, next episode's IDEA reflects it. **Still unmet** — everything is wired, nothing has been run for real.

## Phase 5 — Hardening
- [ ] Cost surfaced per episode/stage; regenerate caps enforced. *(Cost is persisted per stage and rolled up to `Episode.totalCost` by `syncEpisodeStatus`; the regenerate cap is enforced twice — in `regenerateStageAction` and again in the `regenerate-stage` function. What's left is showing the numbers in the UI.)*
- [ ] Idempotency on retried steps (no double-bill). *(T07 rethrows graph failures as `NonRetriableError` so billed work is never auto-replayed, and the LangGraph checkpointer skips completed nodes. Still open: per-scene dedupe **inside** a failed SCENES fan-out.)*
- [ ] Failure states + recovery via regenerate; provider fallback verified.
- [ ] Storybook + tests for all new components; `npm run lint` exit 0.
- **DoD:** run 2–3 projects through multiple episodes; character stays consistent; costs visible.

---

## Global gates (every phase)
- [ ] `requireAuth()` + ownership on every protected action/route.
- [ ] No secret in plaintext, URL, or client bundle.
- [ ] No vendor SDK outside `src/providers/adapters/`.
- [ ] No graph execution inside a Server Action request cycle.
- [ ] Server data in UI via TanStack Query only; navigation via `@/i18n/navigation`; colors via tokens.
- [ ] `npm run lint` exits 0; `npm run build` passes.

---

## Deferred (not in MVP — see concept doc §2)
Analytics, publishing scheduler, multi-user/team, billing. Revisit only after the pipeline is stable across several projects.

---

## Update discipline
When a decision changes during the build, update the relevant task file **and** [../README.md](../README.md) "Default stack decisions". Log corrections to [docs/knowledge/LEARN.md](../../knowledge/LEARN.md); new patterns to [docs/knowledge/THIS.md](../../knowledge/THIS.md).
