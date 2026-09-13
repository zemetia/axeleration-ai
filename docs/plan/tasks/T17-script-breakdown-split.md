# T17 — SCRIPT → BREAKDOWN Split

Goal: SCRIPT writes a **full screenplay** a human can read and edit, with assets tagged `@handle`. BREAKDOWN then cuts that screenplay into per-scene prompts, working **purely from the screenplay** — it never sees the asset roster.

**Depends on:** T15 (enum, `screenplay` channel, BREAKDOWN node registered, graph wired) and T16 (validator). Runs in parallel with T18.

**Owns these files:**

- `src/ai/prompts/script.prompt.ts`, `script.schema.ts`, `breakdown.prompt.ts` *(new)*, `breakdown.schema.ts` *(new)*
- `src/ai/graph/nodes/script.node.ts`, `src/ai/graph/nodes/breakdown.node.ts` (replacing T15's stub)
- `src/ai/graph/scene-generation.ts` — the unknown-handle warning only
- `src/services/episode.service.ts` — everything **except** `STAGE_ORDER` (T15 owns that line, and lands first)
- `src/app/(protected)/projects/[id]/episodes/[epId]/_components/ScriptPanel.tsx`, `BreakdownPanel.tsx` *(new)*, `rooms.ts`

**Does not touch** `graph.ts` or `state.ts` — T15 already shaped both.

---

## 1. Why

`sceneBreakdownSchema` is `{ logline, scenes[] }`, produced by one call. The model is asked to invent the story *and* cut it into shots in a single pass, and there is never an artefact in between that a person can read as a script. Editing means editing beat cards; the narrative as a whole is not a thing that exists in the system.

Splitting it also puts the asset roster where it belongs. Only the writing step needs the vocabulary; the cutting step should be a faithful transformation of text that already contains the handles. That is what "tidak perlu baca daftar asset lagi" means in practice — and it is only safe because T16 guarantees the screenplay's handles are all real before BREAKDOWN ever runs.

---

## 2. Phase 1 — SCRIPT emits a screenplay

`script.schema.ts` gains a second schema (the existing `sceneBreakdownSchema` stays exactly as it is — BREAKDOWN produces it now):

```ts
export const screenplaySchema = z.object({
  logline: z.string(),
  screenplay: z.string(),          // full prose/screenplay, @handles inline
  characters: z.array(z.string()), // handles the writer intends to feature
});
```

`script.prompt.ts` keeps the roster and its handle rule, and adds: write continuous scene-headed prose, not a JSON list of beats; the cut comes later.

`scriptNode` writes `{ logline, screenplay, characters }` as the stage output and returns `{ screenplay }` on the channel.

⚠️ `episodeService.script(episodeId)` currently reads the **SCRIPT** stage row and parses it as a `SceneBreakdown`. It is called by `scenesNode`, `regenerateEpisodeScene`, `manual-authoring.ts` and the scene-editing writers. Repoint it at the **BREAKDOWN** row in this phase, in one commit with the schema change — a half-applied rename here is the exact shape of bug that yields an episode with zero scenes and no error. Add `episodeService.screenplay(episodeId)` for the new SCRIPT row.

---

## 3. Phase 2 — validator on SCRIPT

Using T16:

1. `validateMentions(screenplay, roster)` → `checkMentionPolicy(v, { policy: 'strict', rosterSize })`
2. On failure: **one** retry, passing `feedback` into the prompt's `revisionNote` slot (already threaded for regenerate notes — no new plumbing).
3. Still failing: fail the stage with `feedback` as `EpisodeStage.error`, so the Script room shows exactly which handle was wrong and what the valid ones are.

One retry, not a loop. A model that gets the roster wrong twice in a row is not going to converge on the third try, and each attempt is billed.

---

## 4. Phase 3 — BREAKDOWN cuts the screenplay

`breakdown.prompt.ts` — inputs are `screenplay`, `targetScenes`, `targetTotalSeconds`, `aspectRatio`, `revisionNote`. **No `assetRoster`.** The instruction is explicit: copy `@handles` from the screenplay verbatim, and introduce none that do not appear there.

`breakdownNode` replaces T15's pass-through stub:

- reads the screenplay from the SCRIPT stage row (DB before channel — the established precedence, so a hand-edited screenplay actually reaches the prompt),
- keeps `estimateScenes()` for the target count, unchanged,
- validates each beat with `policy: 'lenient'` **plus** the containment rule: every handle in the beat must appear in the screenplay. Same one-retry-then-fail as Phase 2,
- writes `sceneBreakdownSchema` as its output — the identical shape `scenesNode` already consumes.

Then `scene-generation.ts:69`: the `console.warn` about unknown handles becomes a thrown error. By this point three layers have already guaranteed the handles are valid, so reaching it means an invariant broke and generating anyway would burn money on a prompt with literal `@text` baked into the frame.

---

## 5. Phase 4 — UI

- Script room shows the screenplay: read, edit as text, regenerate, refine. Manual editing routes through the existing `nextStatusAfterManualWrite` + `alignCheckpointAfterManualWrite` path.
- New `BreakdownPanel` — the beat cards that live in `ScriptPanel` today move here essentially unchanged (`updateSceneSpec`, add, delete, reorder).
- `rooms.ts` gains the Breakdown room; `ControlRail` picks it up automatically.
- Handle chips in the screenplay: render `@handle` as a chip linking to the asset, and mark an unknown one in `--color-destructive-text` **before** the user hits generate. This is the cheapest possible place to catch the error — client-side, free, instant.

---

## 6. Phase 5 — tests

- `screenplaySchema` round-trip; `sceneBreakdownSchema` unchanged (regression guard on downstream readers)
- `scriptNode` retries once with feedback on an unknown handle, fails on the second
- `scriptNode` fails a screenplay with zero mentions against a non-empty roster
- `breakdownNode` rejects a beat carrying a handle absent from the screenplay
- `breakdownNode`'s prompt input object has no `assetRoster` key (locks the design decision — a future edit that "helpfully" adds it back breaks a test instead of silently changing the contract)
- `episodeService.script()` reads BREAKDOWN, `screenplay()` reads SCRIPT
