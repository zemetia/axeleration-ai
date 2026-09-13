# T18 — Idea Refine Mode

> **Status (2026-08-07): DONE.** All five phases implemented; `npm run lint` exits 0, `tsc --noEmit` clean, 257 tests pass (13 new in `src/ai/graph/nodes/idea.node.test.ts`, 3 in `src/lib/cost-forecast.test.ts`).
>
> **Files touched beyond the ownership list**, all additive and none claimed by T17:
> - `src/inngest/events.ts` — `ideaRefine`, `ideaRerunResearch`
> - `src/inngest/functions/refine-idea.ts`, `rerun-research.ts`, `index.ts`
> - `src/lib/cost-forecast.ts` — `combineForecasts`, so Re-research quotes RESEARCH + IDEA as one number
>
> **Browser verification not performed:** the Idea room is behind auth and signing in is out of scope for an agent. The behaviour is covered by unit tests at the node and forecast level; the panel itself is reviewed, not exercised.

Goal: give the Idea room four distinct actions with four distinct meanings — **Edit**, **Refine**, **Regenerate**, **Re-research** — instead of one "Regenerate" button that always discards the idea and writes a new one from scratch.

**Depends on:** T15 (the `ideaMode` channel). **Blocks:** T19 (the loop's repair action *is* refine). Runs in parallel with T17.

**Owns these files:**

- `src/ai/prompts/refine-idea.prompt.ts` *(new)*
- `src/ai/graph/nodes/idea.node.ts`
- `src/ai/graph/graph.ts` — **one exported function only**, `refineEpisodeIdea` (T15 has landed and closed; T17/T19 do not open this file)
- `src/app/(protected)/projects/[id]/episodes/actions.ts`, `src/hooks/queries/*`
- `src/app/(protected)/projects/[id]/episodes/[epId]/_components/IdeaPanel.tsx`

---

## 1. Why

Today "Regenerate + note" on IDEA calls `regenerateEpisodeStage('IDEA', note)`, which re-enters `ideaNode` and runs `ideaPrompt`. That prompt's inputs are premise, project type, brief, continuity, roster, research context, episode number, and `revisionNote` — **the current idea is not among them**. So the note steers a fresh write; it cannot improve the paragraph on screen.

That is the right behaviour for "give me a different idea". It is the wrong behaviour, and the only behaviour available, for "keep this, just make the ending land harder".

| Action | Means | Status |
|---|---|---|
| **Edit** | You type it | ✅ `writeIdea` + `alignCheckpointAfterManualWrite` |
| **Refine** (+ optional note) | Improve **this** idea | ❌ built here |
| **Regenerate** | New idea, same research | ✅ `regenerateEpisodeStage('IDEA')` |
| **Re-research** | New research, then new idea | ⚠️ per-stage only, chained here |

---

## 2. Phase 1 — the refine prompt

`refine-idea.prompt.ts`, inputs: `currentIdea`, `researchContext`, `userNote`, `critique` (`'(none)'` until T19 supplies one), plus the same premise/continuity/roster context `ideaPrompt` already assembles.

The system message must be blunt about what refine is not: preserve the core premise, the characters and the ending unless the note says otherwise; change what the note and critique point at; return the whole revised idea, never a diff or a list of changes. Without that last clause models drift into commentary about their edits, and the text gets stored as the idea.

---

## 3. Phase 2 — `ideaMode` in the node

`ideaNode` reads the `ideaMode` channel T15 added, and consumes-and-resets it exactly like `regenerateNote` and `sceneScope` do — the mode attached to one run must not leak into the next:

```ts
const mode = state.ideaMode;              // 'fresh' | 'refine'
// … choose ideaPrompt or refineIdeaPrompt …
return { idea, ideaMode: 'fresh', regenerateNote: '' };
```

For `'refine'`, the current idea comes from `episodeService.idea(episodeId)` first and the channel second — the same DB-before-channel precedence the rest of the graph uses, so a hand-edited idea is what gets refined. No stored idea and mode is `'refine'` → fall back to `'fresh'` rather than throwing; the user pressed a button that made no sense in context, which is a UI state to recover from, not a pipeline failure.

Title backfill (`setTitleIfEmpty`) stays as-is: a refine must not rename an episode the user already named.

---

## 4. Phase 3 — actions

- `refineEpisodeIdea(episodeId, projectId, note?)` in `graph.ts` — `Command({ goto: 'IDEA', update: { ideaMode: 'refine', regenerateNote: note ?? '' } })`. Same shape as `regenerateEpisodeStage`; it differs only in the channel it sets.
- `refineIdeaAction` in `episodes/actions.ts`. Keep the `await import()` discipline for `@/ai/*` — a static import here pulls LangChain into the dashboard bundle (`docs/knowledge/THIS.md`, Don'ts).
- **Re-research** is a composite, not a new node: regenerate RESEARCH, then on success regenerate IDEA. Run it as one Inngest function so a crash between the two does not park the episode with fresh research and a stale idea.

---

## 5. Phase 4 — UI

`IdeaPanel` gains three buttons next to the existing Edit. Each spends money, so each goes through `RunDialog` with its forecast — the rule from `docs/knowledge/LEARN.md` (2026-07-29): the number is shown *before* the click, never after.

The labels have to make the difference obvious, because the actions are one click apart and two of them are destructive of work you may want:

- **Refine** — "Improve this idea. Keeps the premise and characters." Note field: optional, and visible *before* the button is pressed.
- **Regenerate** — "Write a different idea from the same research." Warns that the current idea is replaced.
- **Re-research** — "Search again, then write a new idea." Most expensive; say so.

No relabelling-on-click confirmations anywhere (same LEARN entry — a button that changes its own label is a hidden mode, not a confirmation).

---

## 6. Phase 5 — tests

- refine passes the current idea into the prompt; regenerate does not
- `ideaMode` is reset to `'fresh'` after a refine run — assert on a second consecutive run, which is where a leaked channel actually shows up
- refine with no stored idea falls back to fresh instead of throwing
- refine does not overwrite an existing episode title
- `refineIdeaAction` does not statically import `@/ai/*` (the ESLint `no-restricted-imports` rule already covers this — the test documents *why* for the next reader)
