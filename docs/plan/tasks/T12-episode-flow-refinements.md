# T12 — Episode Flow Refinements (Naming, Pre-Idea Research, Per-Scene Regenerate)

Goal: close the gaps found when comparing the **actual implemented pipeline** (T04/T07/T11 as built, not as originally speced) against the authoring flow the product owner actually wants. This doc is a gap analysis + proposed design — **no code has been changed yet**. Open decisions in §4 need an answer before any of §3 gets built.

**Depends on:** T02 (schema), T04 (graph/nodes), T07 (pipeline engine), T11 (research agent — §3.2 extends it, does not replace it).

---

## 1. Method

Read directly from source (not from `VIDEO_PLATFORM_MVP.md`, which describes intent, not current state): `src/ai/graph/graph.ts`, `state.ts`, `nodes/*.ts`, `src/inngest/functions/*.ts`, `src/services/episode.service.ts`, `src/assets/resolver.ts`, `src/ai/research/research-agent.ts`, `src/app/[locale]/(protected)/projects/**/actions.ts`, `StagePanel.tsx`, `VideoConfigFields.tsx`, `script.schema.ts`, `scene-estimate.ts`.

Compared against the authoring flow supplied 2026-07-28:

1. Create project
2. Configure project (aspect ratio, target total length, default per-generate scene length, etc.)
3. Create assets (character, map/location, etc.) — mentioned via `@handle` in script & scenes
4. Create Episode (name it — can be filled by AI if left blank)
5. Optional Research step: Human-provided info / AI reasoning / AI research via CDP → feeds Ideation
6. Script and Scenes as separate sub-steps; scenes carry a time/duration per scene
7. Generate per scene (default per-generate length); user can view and regenerate one specific scene
8. Render (assemble everything)

---

## 2. Gap summary

| # | Desired | Current implementation | Gap | Severity |
|---|---|---|---|---|
| 1 | Create project | `createProjectAction` | None — matches | — |
| 2 | Single default "per-generate" scene length (e.g. 10s) | `Project.sceneDurationMin` / `sceneDurationMax` (default 4–8s), average used by `estimateScenes()` to derive scene count; LLM picks each scene's actual `durationSeconds` within that range | Semantic mismatch only, not broken | Low |
| 3 | Assets mentioned in script & scenes | `Asset` model + `@mention` resolver, wired into `scenesNode` | None — matches | — |
| 4 | Episode has a name; AI can fill it | `Episode.title` column exists in schema but **nothing ever writes to it** — `episodeService.create(projectId)` takes no name param | Missing wiring, not a design problem | Low |
| 5 | Optional Research step (3 modes) feeding **Ideation** | `runResearchAgent()` exists but is only called inside `scenesNode`, **after** SCRIPT — it enriches scene prompts, never influences the IDEA stage. Always best-effort-attempted, not user-selectable, no "human-provided notes" or "AI reasoning only" mode | Architectural — needs a new stage before IDEA | High |
| 6 | Script and Scenes as separate generate steps, scenes carry duration | `SCRIPT` and `SCENES` are already separate `StageKind`s; `SceneBreakdown.scenes[].durationSeconds` already exists | None — matches | — |
| 7 | Regenerate **one specific scene** | `SCENES` is a single stage — `withStage(episodeId, 'SCENES', ...)` generates **all** scenes in one batch (`mapWithConcurrency`, concurrency 3) as one JSON blob in `EpisodeStage.output.scenes`. Regenerate is stage-level only (`regenerateStageAction` → `Command({goto:'SCENES'})`), so it reruns research + every scene, not one index. `StagePanel` shows a thumbnail grid but has no per-thumbnail regenerate control | Architectural — scenes have no individual identity/status/cost | High |
| 8 | Render assembles everything | `renderNode` | None — matches | — |

---

## 3. Proposed changes

### 3.1 Episode naming — low effort

- `episodeService.create(projectId: string, title?: string)` — pass through from the action.
- `generateEpisodeAction(projectId, title?: string)` — UI adds an optional text field to the "+ Generate Episode" flow.
- If left blank: leave `title: null` at creation. After `ideaNode` completes, backfill once — `prisma.episode.update({ where: { id }, data: { title } })` — **only when `title` is still null**, so a user-given name is never overwritten. Title derived from the first ~8 words of the generated idea/logline.

### 3.2 `RESEARCH` as its own optional stage — high effort

- New `StageKind.RESEARCH` (Prisma enum migration), inserted **before** `IDEA` in `STAGE_ORDER`. `episodeService.create` seeds 7 stage rows instead of 6.
- New node `src/ai/graph/nodes/research.node.ts` reads a `researchMode` and branches:
  - `HUMAN` — free text the user pastes before/at generation time; stored as stage output verbatim, no LLM call, no cost.
  - `AI_REASONING` — one plain LLM call (no tools), brainstorms angles from `premise` + `continuity summary` only. Cheap, no web access.
  - `AI_CDP` — calls the **existing** `runResearchAgent()` (T11), just invoked here instead of/in addition to inside `scenesNode`.
  - `SKIP` — stage auto-completes with empty output immediately (kept as a row for consistency and so `STAGE_ORDER`/UI don't special-case it).
- `ideaNode` gains a `researchContext` input, read from the new `RESEARCH` stage's output — same pattern `scriptNode` already uses for `characterBible`.
- `scenesNode`'s own `runResearchAgent()` call is **left as-is** — it grounds scene-level visual detail and is complementary, not redundant, to the pre-idea research. No change to `scenes.node.ts` in this task.
- Where `researchMode` is chosen is an open decision — see §4.2.

### 3.3 Per-scene regenerate — high effort, two options

**Option A — light (JSON patch, no migration).**
Keep `scenes` as the `EpisodeStage.output` JSON array. Add `regenerateSceneAction(episodeId, sceneIndex, note?)` → new Inngest function `regenerate-scene.ts` that reruns generation for exactly one scene index (reusing the last run's stored research/character-bible context, untouched for other indices), then patches only that array entry via `prisma.episodeStage.update`.
Downside: no per-scene cost/attempt history; "which scene failed" requires scanning JSON instead of querying a row.

**Option B — solid (promote `Scene` to its own model).**
Add a `Scene` Prisma model (`id, episodeId, index, status, attempt, costEstimate, videoUrl, prompt, error`) FK'd to `Episode`. `scenesNode` fans out into creating/updating `Scene` rows instead of one JSON blob (mirrors the existing `EpisodeStage` GENERATING→READY/FAILED/attempt pattern via a new `withSceneRow` helper, parallel to `withStage`). Regenerate targets `Scene.id` directly. `StagePanel`'s scene thumbnail grid gets a real per-thumbnail regenerate button wired to a row it can poll independently.

**Recommendation:** Option B — it reuses the exact lifecycle pattern `EpisodeStage` already established instead of inventing ad-hoc JSON patching, and it directly supports the earlier cost-tracking/budget-guard recommendation (per-scene cost only exists if scenes are rows).

---

## 4. Decisions taken (2026-07-28) — implemented

1. **Video config semantics (§2 row 2):** kept as-is — `sceneDurationMin`/`sceneDurationMax` stays a range. No functional issue, not worth the churn.
2. **Where `researchMode` lives:** both — `Project.defaultResearchMode` (new field, default `AI_CDP`) seeds `Episode.researchMode` at creation time; the "+ Generate episode" form lets the user override it per episode, plus a `researchNotes` field shown only for `HUMAN` mode.
3. **Per-scene regenerate:** Option B — added a `Scene` Prisma model with its own `status`/`attempt`/`costEstimate`/`videoUrl`, mirroring `EpisodeStage`'s lifecycle via a new `withSceneRow` helper (`src/ai/graph/scene-io.ts`).

---

## 5. What was built

- **3.1 Episode naming:** `episodeService.create()` accepts an optional `title`; `deriveEpisodeTitle()` backfills it from the IDEA stage's output only when still `null` (`src/ai/graph/nodes/idea.node.ts`).
- **3.2 RESEARCH stage:** new `StageKind.RESEARCH`, first in `STAGE_ORDER`, ahead of `IDEA`. `src/ai/graph/nodes/research.node.ts` branches on `Episode.researchMode`: `HUMAN` (stored notes, no LLM call), `AI_REASONING` (plain brainstorm, no tools — `src/ai/prompts/idea-research.prompt.ts`), `AI_CDP` (reuses `runResearchAgent`, aimed at seeding the idea rather than grounding scenes), `SKIP` (empty output, IDEA behaves exactly as before this stage existed). `ideaNode` now reads `state.researchContext`.
- **3.3 Per-scene regenerate:** `src/ai/graph/scene-generation.ts` extracts the per-scene compose+generate call shared by the SCENES batch fan-out and a single targeted regenerate. `regenerateEpisodeScene()` (`graph.ts`) reruns one scene, reuses the original SCENES run's stored research dossier (no re-research), and patches the LangGraph checkpoint's `scenes` channel via `graph.updateState(..., 'SCENES')` so a later RENDER approve picks up the new video instead of the stale one. `addStageCost()` keeps `EpisodeStage(SCENES).costEstimate` in sync with the sum of `Scene.costEstimate` rows. New event `episode/scene.regenerate` + Inngest function `regenerate-scene.ts` + `regenerateSceneAction`. UI: `SceneGrid.tsx` renders live per-scene status with its own regenerate button inside `StagePanel`.

## 6. QA performed

- `npm run type-check` — clean.
- `npm run lint` — clean (`--max-warnings 0`).
- `npx vitest run` — 60/60 passing, including 4 new tests for `deriveEpisodeTitle` (`src/services/episode.service.test.ts`).
- `npm run build` — production build succeeds; `/api/episodes/[id]/scenes` route present.
- **Migration — now verified (2026-07-28):** Docker Desktop's engine was unreachable when this doc was first written; it's since been restarted and a shared Postgres container set up (`D:\Kerja\shared-postgres`, one instance for every project on this machine — this project's database inside it is `axeleration_ai`). `npx prisma migrate deploy` applied all three migrations cleanly, and `\d scenes` / `\d episodes` / the `StageKind` enum were inspected directly in `psql` to confirm the hand-written SQL matches the schema exactly (correct columns, FK, unique index, enum order with `RESEARCH` first). The project's old standalone `docker-compose.yml` (its own single-project Postgres on port 5436) was removed since it's superseded by the shared instance.
- **Still not verified:** full pipeline runtime (an actual IDEA→RENDER episode generation with real provider API keys) — the database is real now, but no provider keys are configured in this environment, so a live generation run hasn't been exercised end-to-end.
