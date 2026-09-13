# T15 — Pipeline Spine & Graph Scaffolding

> **Status (2026-08-07): DONE and migrated.** All six phases shipped. `tsc --noEmit`, `npm run lint` and 241 tests clean; the compiled graph was smoke-tested against the live checkpointer and reports the intended shape. Four things differed from the plan below, all recorded in §7.

Goal: land **every structural change** the SCRIPT/BREAKDOWN split and the Idea loop need — enum, channels, node registration, routing seam, checkpoint versioning — while leaving pipeline behaviour byte-for-byte identical. After this task the graph has the new shape but does the old work, so T17/T18/T19 can be written **in parallel without any of them touching `graph.ts` or `state.ts`**.

**Depends on:** nothing. **Blocks:** T17, T18, T19. Runs in parallel with T14 and T16.

**Owns these files:**

- `prisma/schema/enums.prisma`, `prisma/schema/episode.prisma`, `prisma/schema/migrations/*`
- `src/config/pipeline.ts` *(new)*
- `src/ai/graph/graph.ts`, `src/ai/graph/state.ts`, `src/ai/graph/routing.ts` *(new)*
- `src/ai/graph/nodes/breakdown.node.ts` *(new, stub)*, `src/ai/graph/nodes/idea-critic.node.ts` *(new, stub)*
- `src/services/episode.service.ts` — **the `STAGE_ORDER` export only**
- `src/inngest/autopilot-decision.ts`, `src/ai/graph/manual-authoring.ts`

---

## 1. Phase 1 — one `STAGE_ORDER`

The stage order is declared twice, and the two are independent literals:

- `src/ai/graph/graph.ts:22` — feeds `interruptAfter`
- `src/services/episode.service.ts:24` — feeds stage-row seeding, `advance.ts`, `manual-authoring.ts`, the UI rail

Inserting a stage into one and not the other yields a pipeline that interrupts at different points than the UI believes. Before adding anything, move the array to `src/config/pipeline.ts` and have both import it.

`src/config/pipeline.ts` must not import from `@/ai/*`, `@/inngest/*` or `@/providers/*` — client components read the stage list, and a stray import there drags LangChain through the bundler (see `docs/knowledge/THIS.md`, Don'ts).

**Done when:** `grep -rn "STAGE_ORDER.*=.*\[" src/` returns exactly one declaration.

---

## 2. Phase 2 — `BREAKDOWN` stage, behaviour-neutral

- `StageKind` gains `BREAKDOWN`, placed **between** `SCRIPT` and `SCENES`. Prisma migration.
- `STAGE_ORDER` becomes `RESEARCH, IDEA, SCRIPT, BREAKDOWN, SCENES, VOICE, MUSIC, RENDER`. `episodeService.create` now seeds 8 rows.
- `graph.ts`: register `BREAKDOWN`, rewire `SCRIPT → BREAKDOWN → SCENES`, add it to `interruptAfter`.
- `nodes/breakdown.node.ts` — **stub, and deliberately so**: read the SCRIPT stage's stored `SceneBreakdown`, write it unchanged as the BREAKDOWN stage's output, return `{ script }`. Zero LLM calls, zero cost.

This is the point of the phase. SCRIPT still emits a full `SceneBreakdown` (T17 changes that later), BREAKDOWN passes it through, and every downstream reader — `scenesNode`, `regenerateEpisodeScene`, `updateSceneSpec` — keeps working untouched. The pipeline gains a stage without changing what it produces.

Also update, in the same phase, so nothing is left believing in 7 stages:

- `manual-authoring.ts` — `ManualStageKind` and the `alignCheckpointAfterManualWrite` switch
- `autopilot-decision.ts` — the new stage joins the approve sequence
- `_components/rooms.ts` + `ControlRail` — BREAKDOWN shown inside the existing Script room for now; T17 gives it its own panel
- `src/lib/cost-forecast.ts` — forecast 0 for BREAKDOWN while it is a stub

**Done when:** a fresh episode runs RESEARCH → RENDER end to end and produces the same output it did before this task, with an extra BREAKDOWN row sitting at cost 0.

---

## 3. Phase 3 — channels for both downstream tasks

Add to `EpisodeGraphAnnotation` (`state.ts`) now, so T17 and T18 never open this file:

| Channel | Type | Reducer | For |
|---|---|---|---|
| `screenplay` | `string \| undefined` | replace | T17 — SCRIPT's prose output |
| `ideaMode` | `'fresh' \| 'refine'` | replace, default `'fresh'` | T18 — consumed and reset by `ideaNode`, same contract as `regenerateNote` |
| `ideaCritique` | `IdeaCritique \| undefined` | replace | T19 |
| `ideaIteration` | `number` | `prev + next`, default 0 | T19 — the loop counter guardrail |

`IdeaCritique` is declared in `src/ai/prompts/idea-critic.schema.ts` (created here as a type-only stub, filled in by T19).

Keep the `script` channel as-is, holding `SceneBreakdown`. It changes owner (SCRIPT → BREAKDOWN writes it) but not shape, so nothing downstream needs to know.

**Done when:** `tsc --noEmit` is clean and no node reads the new channels yet.

---

## 4. Phase 4 — the routing seam

T19 needs a conditional edge after IDEA. Rather than have it edit `graph.ts` (which T17 also has claims on), land the seam now:

- `nodes/idea-critic.node.ts` — stub that writes a fixed passing critique, no LLM call, no cost.
- `src/ai/graph/routing.ts` — `export function routeAfterIdeaCritic(state): 'RESEARCH' | 'IDEA' | 'SCRIPT'`, whose implementation in this task is `return 'SCRIPT'` unconditionally.
- `graph.ts` — `IDEA → IDEA_CRITIC`, then `addConditionalEdges('IDEA_CRITIC', routeAfterIdeaCritic)`.

T19's whole job then becomes: fill in the critic node, fill in `routing.ts`, add the prompt. `graph.ts` stays closed.

⚠️ `IDEA_CRITIC` is a graph node but **not** a `StageKind` — no stage row, no approve gate, no rail entry. Same call T11 made for the research agent (see `docs/knowledge/THIS.md`, 2026-07-28): it is machinery inside a stage, not a deliverable the user reviews.

**Done when:** the graph compiles with the conditional edge and behaviour is unchanged.

---

## 5. Phase 5 — `graphVersion` + drop stale checkpoints

A LangGraph checkpoint stores the channel values **and `next`** — the node to run on resume — keyed by `thread_id` (`= episodeId`). Phase 2 deleted the `SCRIPT → SCENES` edge, so a thread parked at `next: ['SCENES']` will resume straight into SCENES and skip BREAKDOWN entirely. It does not crash; it silently produces an episode with no scenes.

Measured 2026-08-07 before deciding: 6 projects, 3 episodes (1 FAILED, 2 DRAFT, **none DONE**), 21 stage rows, 2 scene rows, 18 checkpoint rows. Nothing finished exists, so a backfill would be written for two throwaway threads. **Decision: drop them.**

- Migration: `delete from checkpoints / checkpoint_blobs / checkpoint_writes` (the tables `PostgresSaver.setup()` creates), and set every non-`DONE` episode to `FAILED` with a stop reason naming the pipeline change.
- `Episode.graphVersion Int @default(1)`; bump the constant in `src/config/pipeline.ts` whenever the graph's node/edge shape changes.
- `resumeEpisodeGraph` / `regenerateEpisodeStage` reject a mismatch with a readable error rather than resuming into a shape that no longer exists.

That last bullet is the durable part. The graph changes again in T17 and T19; this is what stops the same silent failure recurring each time.

**Done when:** an episode row with a stale `graphVersion` refuses to resume, with a message that says why.

---

## 6. Phase 6 — tests

- `STAGE_ORDER` has one declaration and 8 entries in the documented order
- `episodeService.create` seeds 8 stage rows
- the BREAKDOWN stub round-trips a `SceneBreakdown` from SCRIPT unchanged
- `routeAfterIdeaCritic` returns `'SCRIPT'` for every input (locks the neutral behaviour, so T19's change is visible in the diff)
- a version mismatch throws instead of resuming

---

## 7. What differed from the plan (as built, 2026-08-07)

**1. The stage order was declared six times, not twice.** §1 named `graph.ts` and `episode.service.ts`. Tracing every consumer found four more: `autopilot-summary.ts` (`READY_ORDER`, duplicated on purpose to stay client-safe), `provider-readiness.ts` (`READINESS_STAGE_ORDER`), and two literals inside `cost-forecast.ts` (`forecastEpisode`'s `kinds` and `nextStageAfter`'s `order`). Two more lived as Zod enums in `src/inngest/events.ts` and `src/mcp/tools.ts`. All eight now derive from `src/config/pipeline.ts`.

Making the Zod enums derive needed one deliberate choice: `STAGE_ORDER` is declared `as const satisfies readonly StageKind[]` rather than annotated `: readonly StageKind[]`. An annotation widens the tuple to an array of the union and `z.enum()` cannot consume that, so the two schemas would have had to retype the list — which is the exact failure this task exists to remove. `satisfies` keeps the literal tuple and still fails the build on a value that is not a real `StageKind`.

`nextStageAfter` moved from `cost-forecast.ts` to `src/config/pipeline.ts` (it is pipeline shape, not pricing). Its two tests moved with it into `src/config/pipeline.test.ts`.

**2. `IDEA` had to come out of `interruptAfter`.** §4 registered `IDEA → IDEA_CRITIC` without saying where the graph parks. Leaving `interruptAfter` as `STAGE_ORDER` would have parked *before* the critic ran, so the critique would arrive one resume after the user reviewed the idea — useless, since the critique exists to inform that review. Parking after both would cost an extra Approve click for a node that renders nothing.

So `INTERRUPT_AFTER` is `STAGE_ORDER` minus `IDEA`, plus `IDEA_CRITIC` — one park per stage, with IDEA's moved to the end of its critic. It lives in `src/config/pipeline.ts` beside the order it is derived from, which also makes the park points unit-testable without importing LangChain.

**3. A hand-written idea needed re-attributing.** `alignCheckpointAfterManualWrite` calls `updateState(..., asNode: kind)`, and `asNode` rewinds `next` to that node's *successor*. With the critic spliced in, IDEA's successor is `IDEA_CRITIC`, so writing an idea by hand would have left the thread pointing at the critic and cost the user a second Approve to reach SCRIPT — a behaviour change in a task that claims to make none. A small `ALIGN_AS_NODE` map attributes IDEA's manual write to `'IDEA_CRITIC'` instead, landing `next` on SCRIPT exactly as before. RESEARCH and SCRIPT are unchanged.

**4. Two migrations, and a backfill §5 did not mention.** `ALTER TYPE ... ADD VALUE` may not be followed in the same transaction by statements using the new value, so the enum is alone in `20260807180000_stage_kind_breakdown` and everything else is in `20260807180100_pipeline_v2_reset`.

The backfill matters more than the split: `startStage` reads its row with `findUniqueOrThrow`, so an episode with no `BREAKDOWN` row would have thrown the moment the stage ran. Every existing episode gets one, retired ones included, so the control rail renders eight stages everywhere.

Episode retirement was also narrowed. §5 said "every non-`DONE` episode"; as written it only retires episodes that *started* — one whose stages are all still `PENDING` never had a thread, so the rewiring cannot have hurt it and it stays a `DRAFT` the user can run. Verified after applying: `StageKind` reads in pipeline order, `graphVersion` present, 3 `BREAKDOWN` rows backfilled, 0 checkpoints, 3 episodes `FAILED`.

**Left for T17, as planned:** `BREAKDOWN` is not in `ManualStageKind`. Nothing writes to that stage by hand yet — the beat cards still edit SCRIPT's output — and adding an unreachable enum member now would be dead code. T17 adds it when the Breakdown panel exists.
