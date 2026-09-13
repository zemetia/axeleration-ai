# T07 — Pipeline Engine (durable execution)

> **Status (2026-07-28): DONE.** All four functions written and registered — `src/inngest/functions/{generate-episode,resume-stage,regenerate-stage,generate-bible}.ts`, plus `episode-status.ts` (status/cost/finalVideoUrl rollup), `finalize.ts` (continuity advance) and `src/lib/n8n.ts` (signed webhook). `/api/inngest` now serves 4 functions instead of `[]`; verified at runtime, not just by types. 12 tests in `episode-status.test.ts` + `n8n.test.ts`.
>
> **Inngest v4 API differs from this doc's sketch.** `EventSchemas`/`fromRecord` no longer exist and `createFunction` takes **two** arguments, not three: the trigger moved into the options object (`triggers: [{ event }]`). Events are now `eventType(name, { schema })` objects backed by Standard Schema (zod v4 works directly) — see `src/inngest/events.ts`. They are both the function's trigger and the typed constructor for `inngest.send(eventName.create({...}))`, so every emit site is now type-checked against the schema.
>
> **`episode/generate` now carries `projectId`** (T08's `generateEpisodeAction` was updated). Inngest's concurrency key is an expression over the event payload, so per-project capping is impossible without it. Approve/regenerate cap per **episode** instead, which needs no payload change.
>
> **Retry policy, chosen against §5's "step retries handle transient errors":** any failure inside a graph invocation is rethrown as `NonRetriableError`. Provider work is billed the moment it runs and LangGraph checkpoints at node granularity, so an automatic retry of a half-finished SCENES fan-out would re-bill scenes that already succeeded. DB-only steps still retry normally. Regenerate is the recovery path, exactly as §5 says. This is the honest answer to the "never double-charge" acceptance criterion — the checkpointer prevents replaying *completed* nodes, and we simply never auto-replay a failed one.
>
> **Approving twice is a no-op.** `mark-approved` only advances the graph when the stage is actually `READY`, so a double click or a replayed event cannot skip a stage.
>
> **n8n webhook is environment-level, not per-project** (`N8N_WEBHOOK_URL` / `N8N_WEBHOOK_SECRET`, HMAC-SHA256 in `x-signature-256`). The Project model has no webhook columns and T09's `N8nWebhookForm` was never built, so per-project config would have been two unreachable Prisma fields. `src/lib/n8n.ts` is the only file that changes when it moves per-project.
>
> **Regenerate notes now reach the model.** The `note` in `episode/stage.regenerate` is carried through the graph as a `regenerateNote` channel (T04 `state.ts`) and rendered into the IDEA / SCRIPT / SCENES prompts as "Note from the user on what to change this time". Every node clears the channel after running so a note can't leak into the next stage. VOICE/MUSIC/RENDER ignore it — they are mechanical.
>
> **Found while wiring:** `registerProviders()` was never called anywhere, so any `providerRegistry.run(...)` from a T04 node would have thrown "No provider adapter registered". Every Inngest function now calls it before invoking the graph.
>
> **Not verified end-to-end.** No provider API keys and no `inngest-cli dev` run has happened, so no real episode has been generated. What is verified: functions register with the right ids, the module graph loads, lint/type-check/tests pass.

Goal: run the episode graph durably in the background, drive the per-stage state machine, and handle Approve/Regenerate by resuming the LangGraph thread. Generation is long-running — this must NOT run inside a Server Action's request cycle.

**Depends on:** T02, T03, T04. **Blocks:** T08 (actions send events), T09 (UI reflects stage status).

Lives in `src/inngest/`.

---

## 1. Why Inngest

- Steps + automatic retries + `waitForEvent` = a durable host for the graph, without standing up Redis/BullMQ.
- Maps cleanly: "generate episode" = one Inngest function that invokes the graph; each stage's human pause = the graph's `interrupt()`, resumed by an approval event.
- Serverless-friendly (works with Next.js on Vercel/Node).

Alternative if you must self-host queueing: BullMQ + Redis worker calling the same graph. Keep the graph invocation identical so the queue is swappable.

---

## 2. Events

| Event | Payload | Emitted by |
|---|---|---|
| `episode/generate` | `{ episodeId }` | `generateEpisode` action (T08) |
| `episode/stage.approve` | `{ episodeId, stage }` | `approveStage` action |
| `episode/stage.regenerate` | `{ episodeId, stage, note? }` | `regenerateStage` action |
| `project/bible.generate` | `{ projectId }` | project create action |

---

## 3. Functions (`src/inngest/functions/`)

### `generate-episode.ts`
```
on 'episode/generate':
  step "start": set Episode.status = GENERATING
  step "run-graph": episodeGraph.invoke(initialState, { thread_id: episodeId })
     → graph runs IDEA, then interrupt() → function returns (durably parked)
  (each node writes its EpisodeStage row: GENERATING → READY, output, cost)
```

### `resume-stage.ts`
```
on 'episode/stage.approve':
  step "mark-approved": EpisodeStage(kind=stage).status = APPROVED
  step "resume": episodeGraph.invoke(null, { thread_id: episodeId, resume: {approve: stage} })
     → next node runs, then interrupt(); if stage was RENDER → finalize
  step "finalize?": if stage == RENDER: update ContinuityState, Episode.status = READY_FOR_REVIEW→DONE, notify n8n
```

### `regenerate-stage.ts`
```
on 'episode/stage.regenerate':
  step "bump": EpisodeStage(kind=stage).attempt += 1, status = GENERATING
  step "resume": episodeGraph.invoke(null, { thread_id: episodeId, resume: {regenerate: stage, note} })
     → re-runs only that node (guard: attempt <= aiConfig.limits.maxRegenPerStage)
```

### `generate-bible.ts`
```
on 'project/bible.generate':
  step: CharacterBible.status = generating
  step: run identity-lock chain (T04) from seed image + premise → lockedTraits
  step: CharacterBible.status = ready
```

Concurrency: cap `generate-episode` per project (e.g. Inngest `concurrency: { key: 'event.data.projectId', limit: 1 }`) so a project doesn't run two episodes at once. Scene fan-out concurrency is inside the SCENES node (T04).

---

## 4. Stage state machine (source of truth for the UI)

`EpisodeStage.status` transitions, per `kind`:

```
PENDING ──(node starts)──► GENERATING ──(node ok)──► READY ──(user approve)──► APPROVED
                                   │                    │
                                   └──(node error)──► FAILED   └──(user regenerate)──► GENERATING
```

- Episode rollup: `GENERATING` while any stage runs; `READY_FOR_REVIEW` when RENDER is READY; `DONE` when RENDER APPROVED; `FAILED` if a node errors past retries.
- The UI never computes flow — it reads stage rows and shows Approve/Regenerate on `READY`.

---

## 5. Failure, retries, notifications

- Node errors: registry already retried/fell back across providers (T03). Remaining error → `EpisodeStage.status = FAILED`, `error` message, Episode `FAILED`. Regenerate is the recovery path.
- Inngest step retries handle transient infra errors; keep provider calls idempotent per `(episodeId, kind, attempt)` so a retried step doesn't double-bill (dedupe on that key before charging/uploading).
- On terminal state (READY_FOR_REVIEW / FAILED), POST to the project's n8n webhook (from Settings) with `{ episodeId, status }`. Webhook config + secret stored per project; sign the payload.

---

## Acceptance criteria

- [ ] `episode/generate` runs IDEA then parks; `EpisodeStage(IDEA)` ends `READY` with output + cost.
- [ ] `stage.approve` advances exactly one stage; approving RENDER finalizes + updates continuity + notifies n8n.
- [ ] `stage.regenerate` re-runs only the targeted stage, bumps `attempt`, and is capped by `maxRegenPerStage`.
- [ ] Per-project episode concurrency = 1.
- [ ] A retried Inngest step never double-charges/double-uploads (idempotency key on `episodeId+kind+attempt`).
- [ ] No graph execution happens inside a Server Action request.
