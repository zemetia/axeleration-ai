# T19 — Idea Critic Loop (hybrid)

Goal: loop RESEARCH ↔ IDEA automatically until the idea is good enough, then stop and hand it to the user. Hybrid by design — the critic drives the iterations, the human keeps the final say, and auto-pilot may only pass the gate on a score, never on exhaustion.

**Depends on:** T15 (critic node registered, `routing.ts` seam, `ideaCritique`/`ideaIteration` channels) and T18 (refine is the loop's repair action). Last of the six.

**Owns these files:**

- `src/ai/prompts/idea-critic.prompt.ts` *(new)*, `idea-critic.schema.ts` (T15 left a type stub)
- `src/ai/graph/nodes/idea-critic.node.ts` (replacing T15's stub)
- `src/ai/graph/routing.ts` (replacing T15's constant return)
- `src/inngest/autopilot-decision.ts`, `src/config/ai.ts`
- `src/app/(protected)/projects/[id]/episodes/[epId]/_components/IdeaCritiquePanel.tsx` *(new)*

**Does not touch** `graph.ts` or `state.ts` — T15 closed both.

---

## 1. Shape

```
RESEARCH → IDEA → IDEA_CRITIC ─┬─ score ≥ threshold ────────→ SCRIPT (parks at the interrupt)
                   ↑  ↑        ├─ open questions ───────────→ RESEARCH
                   │  └────────┤  weak but answerable ──────→ IDEA (mode: refine + critique)
                   └───────────┴─ iterations/budget spent ──→ SCRIPT (parks, flagged "stopped at limit")
```

`IDEA_CRITIC` is a graph node, **not** a `StageKind` — no stage row, no approve gate, no rail entry. Same call T11 made for the research agent: it is machinery inside a stage, not something the user approves. Its output is persisted inside the IDEA stage's `output.critique`.

---

## 2. Phase 1 — rubric and schema

```ts
export const ideaCritiqueSchema = z.object({
  scores: z.object({
    premiseFit: z.number().min(0).max(25),      // does it serve Project.premise
    conflictClarity: z.number().min(0).max(25), // is there a stake and a turn
    freshness: z.number().min(0).max(25),       // vs continuity.summary — not a repeat of prior episodes
    visualFeasibility: z.number().min(0).max(25), // shootable as N short generated clips
  }),
  score: z.number().min(0).max(100),
  weaknesses: z.array(z.object({
    axis: z.enum(['premiseFit', 'conflictClarity', 'freshness', 'visualFeasibility']),
    detail: z.string(),
    fixable: z.enum(['refine', 'research']),   // ← this is what routes the loop
  })),
  openQuestions: z.array(z.string()),          // facts the idea needs but does not have
});
```

`fixable` is the load-bearing field. A weakness a rewrite can fix routes to IDEA; one that needs facts the model does not have routes to RESEARCH. Without it the loop can only do one thing, and "loop until good" degenerates into "regenerate N times".

`visualFeasibility` exists because this is a *video* pipeline: an idea whose best scene is a ten-minute conversation scores well on story and produces nothing worth generating.

Recompute `score` as the sum server-side rather than trusting the model's own arithmetic.

---

## 3. Phase 2 — the critic node

- One structured-output call via `getChatModel('idea-critic', …)`; add the role to the model router so it can be pointed at a cheaper model than the writer.
- Inputs: current idea, premise, continuity summary, research context, project brief.
- Returns `{ ideaCritique, ideaIteration: 1 }` — the `prev + next` reducer T15 set up makes that an increment.
- **Failure is not fatal.** If the critic call fails or returns unparseable output, log it and emit a passing critique with `verdict: 'critic-unavailable'`. The loop's job is to improve an idea, not to become a new way for the pipeline to die. Same reasoning as `gatherResearch`'s try/catch in `scenes.node.ts:46`.

---

## 4. Phase 3 — routing and guardrails

`routing.ts` replaces T15's `return 'SCRIPT'`:

```
if (iteration ≥ maxIterations)        → 'SCRIPT'   // flagged: stopped at limit
if (costTotal ≥ ideaLoopBudget)       → 'SCRIPT'   // flagged: stopped at budget
if (score ≥ threshold)                → 'SCRIPT'
if (any weakness.fixable === 'research' || openQuestions.length ≥ 2) → 'RESEARCH'
                                      → 'IDEA'     // refine, carrying the critique
```

Guardrails are the whole safety story of this task — an unbounded loop over paid calls is the one thing here that can quietly cost real money:

| Setting | Default | Where |
|---|---|---|
| `maxIdeaIterations` | 3 | `Project.pipelineConfig` |
| `ideaLoopBudgetUsd` | 0.50 | `Project.pipelineConfig` |
| `ideaScoreThreshold` | 75 | `Project.pipelineConfig` |

Order matters: **limits are checked before the score.** A critic that never returns a passing score must still terminate.

Routing to RESEARCH sets the open questions as the research goal, and to IDEA sets `ideaMode: 'refine'` with the critique attached — both channels exist because T18 and T15 put them there.

Every iteration appends to `EpisodeStage.output.iterations[]`: score, weaknesses, which way it routed, cost. That history is what lets you see whether the idea is improving or the loop is circling, which is the only way to tune the thresholds honestly.

---

## 5. Phase 4 — auto-pilot gate

`autopilot-decision.ts`: auto-pilot may approve IDEA → SCRIPT **only** when `score ≥ threshold`. If the loop stopped on iterations or budget with a score below the line, auto-pilot stops and writes the reason to `autoPilotStopReason` (`Episode` already has the column).

This is what makes the mode hybrid rather than merely automatic: the machine can proceed on a good idea, but never on a *tired* one. Silently spending a full pipeline run on an idea the critic rejected is the failure this prevents.

---

## 6. Phase 5 — UI

`IdeaCritiquePanel` under the idea: score with its four-axis breakdown, weaknesses, open questions, and the iteration history as a compact list (score → route taken → cost). While the loop runs, `RunStatus` already shows elapsed time — extend its label with `iteration 2 / 3` so a multi-minute loop is legible instead of an unexplained wait (`docs/knowledge/LEARN.md`, 2026-07-29: a long-running stage must say what it is doing).

Buttons: **Accept anyway** (skip the gate, go to SCRIPT) and **Keep looping** (one more iteration past the limit, priced in a `RunDialog` like everything else that spends).

---

## 7. Phase 6 — tests

`routing.ts` is a pure function of state — test it exhaustively, no LLM:

- score above threshold → SCRIPT
- iteration at max, score below threshold → SCRIPT, flagged at-limit
- budget spent → SCRIPT even at iteration 1
- **limits beat score** — at max iterations *and* above threshold, still terminates (the ordering guard)
- `fixable: 'research'` → RESEARCH; `fixable: 'refine'` → IDEA
- 2+ open questions → RESEARCH
- critic failure → passing critique, loop exits, pipeline continues
- auto-pilot stops with a reason when the loop ends under threshold
- `score` is recomputed from the axes, not taken from the model
