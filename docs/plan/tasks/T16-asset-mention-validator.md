# T16 — Asset Mention Validator

> **Status (2026-08-07): DONE.** `src/assets/validate.ts` + 18 tests in `src/assets/validate.test.ts`, exported from the `src/assets` barrel. Lint clean. Nothing imports it yet — T17 owns the wiring (§5).
>
> **One deviation from §2, deliberate:** handles are matched **case-sensitively**, not case-insensitively. `assetResolver` looks them up with a case-sensitive `handle: { in: [...] }` query, so a case-insensitive pass here would clear a prompt that then fails downstream — the one direction a validator must never be lenient in. A case mismatch lands in `unknown`, where the nearest-handle suggestion is one edit from naming the correct casing, so the message stays as useful as §2 intended. A second, narrower change: the "empty roster" rule is gated on the **writable** roster (VOICE excluded), because a VOICE-only project shows the writer the same `NO_ASSETS_ROSTER` an empty one does.

Goal: make "the script **must** tag its assets" an enforced rule instead of a sentence in a prompt. Pure functions plus tests — no graph, no schema, no UI, no LLM call.

**Depends on:** nothing (builds on T06's `extractMentions` / `assetResolver`, both long since shipped). **Blocks:** T17. Runs in parallel with T14 and T15.

**Owns these files:**

- `src/assets/validate.ts` *(new)*
- `src/assets/validate.test.ts` *(new)*
- `src/assets/index.ts` — the barrel export only

Explicitly **not** owned: `resolver.ts` and `mention.ts` stay untouched. This task adds a layer above them.

---

## 1. Why this is its own task

`scriptPrompt` already tells the model to write `@handle` verbatim and invent none, and `buildAssetRoster` already gives it the vocabulary. Nothing checks the result. The only existing check is downstream and advisory:

```ts
// scene-generation.ts:69
if (unknown.length > 0) console.warn(`[scenes] scene ${…}: unknown asset handles left in prompt: …`);
```

A `console.warn` in a background Inngest run is invisible. A hallucinated `@lunna` then survives all the way into the video model's prompt, which renders the literal characters "@lunna" into the frame — after the generation has been paid for.

Keeping this as pure functions matters for a second reason: it is the only part of the whole plan that can be tested exhaustively without a provider, a database, or a dollar.

---

## 2. Phase 1 — the validator

```ts
export interface MentionValidation {
  mentioned: string[];   // known handles actually used, deduped, in order of first appearance
  unknown: string[];     // handles written that no asset owns
  missing: string[];     // roster handles never mentioned (informational, never fatal)
  coverage: number;      // mentioned.length / rosterSize, 0 when the roster is empty
}

export function validateMentions(text: string, roster: AssetVO[]): MentionValidation;
```

Rules, chosen to match how `buildAssetRoster` already behaves:

- Compare handles **case-insensitively**, but report them as the asset stores them.
- Exclude `VOICE` assets from `missing` and from `coverage` — the roster builder already excludes them from what a writer may mention (`roster.ts`, `WRITABLE_TYPES`), so counting them would make full coverage unreachable.
- An empty roster means `unknown` must be empty too: with no assets, any `@word` is ordinary prose, not a broken handle. This is the case that makes a naive implementation fail loudly on a project that simply has no asset library yet.

---

## 3. Phase 2 — the policy

Separate from detection, so the thresholds are visible and testable on their own:

```ts
export type MentionPolicy = 'strict' | 'lenient';

export function checkMentionPolicy(
  v: MentionValidation,
  opts: { policy: MentionPolicy; rosterSize: number },
): { ok: true } | { ok: false; reason: string; feedback: string };
```

- `unknown.length > 0` → always a failure, in both policies. This is the real bug class: a handle that looks right and resolves to nothing.
- `strict` (used by SCRIPT): additionally fails when `rosterSize > 0 && mentioned.length === 0` — a script that ignored the entire asset library did not follow the instruction.
- `lenient` (used by BREAKDOWN): unknown handles only. A scene beat legitimately may not feature any asset.
- `feedback` is written **for a model to read**, and is where most of the value is. Not "invalid handle" but: `Unknown handle "@lunna". The closest existing handle is "@luna". Valid handles: @luna, @rainy-alley, @hero-city.` Nearest match by Levenshtein distance ≤ 2, since typo-adjacent hallucination is the common case.

---

## 4. Phase 3 — tests

`src/assets/validate.test.ts`, no mocks needed:

- unknown handle detected; known handle not flagged
- **empty roster + `@something` in the text → no unknown** (the false-positive trap)
- case-insensitive match, canonical casing reported
- duplicate mentions counted once
- VOICE assets excluded from `missing` and `coverage`
- email address in text is not parsed as a mention (`mention.ts` already guards this — assert the guard survives this layer)
- `strict` fails on zero mentions with a non-empty roster; `lenient` passes
- `feedback` names the nearest handle for a one-character typo
- `feedback` lists valid handles when there is no near match

---

## 5. Handoff to T17

T17 consumes this and owns all the wiring:

- `scriptNode` → `strict`, one retry passing `feedback` back into the prompt, then fail the stage with `feedback` as `EpisodeStage.error`
- `breakdownNode` → `lenient`, plus its own rule that a handle may only appear if it appears in the screenplay
- `scene-generation.ts:69` → the `console.warn` is replaced by this validator

None of that is in scope here. This task ships functions and their tests, and nothing imports them yet.
