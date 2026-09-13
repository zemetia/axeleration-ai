import type { AssetVO } from '@/types/value-objects';

import { extractMentions } from './mention';

/**
 * Checks that a piece of writing actually used the project's `@handle` vocabulary, and used it
 * correctly. `scriptPrompt` and `sceneComposePrompt` both *instruct* the model to reference assets
 * by handle and invent none; until now nothing verified the result, and the only check that existed
 * (`scene-generation.ts`) was a `console.warn` inside a background Inngest run — invisible, and
 * raised after the generation had already been paid for. A hallucinated `@lunna` then reaches the
 * video model, which draws the literal characters "@lunna" into the frame.
 *
 * Pure functions over text plus a roster: no database, no provider, no LLM. Detection
 * (`validateMentions`) is deliberately separate from judgement (`checkMentionPolicy`) so the
 * thresholds are visible and testable on their own.
 */

export interface MentionValidation {
  /** Known handles actually used, deduped, in order of first appearance, in the asset's own casing. */
  mentioned: string[];
  /** Handles written that no asset resolves to — including case mismatches (see `resolvableBy`). */
  unknown: string[];
  /** Writable roster handles never mentioned. Informational only, never fatal. */
  missing: string[];
  /** `mentioned.length / writableRosterSize`; 0 when the roster has nothing writable. */
  coverage: number;
}

/**
 * VOICE assets attach to TTS in `voice.node`, not to prose — `buildAssetRoster` already withholds
 * them from what a writer may mention, so counting them in `missing`/`coverage` would make full
 * coverage unreachable. They stay *resolvable* though: a text that mentions one is odd, not broken.
 */
const isWritable = (asset: AssetVO) => asset.type !== 'VOICE';

export function validateMentions(text: string, roster: AssetVO[]): MentionValidation {
  const handles = extractMentions(text);
  const writable = roster.filter(isWritable);

  // With nothing writable in the roster, `@anything` is ordinary prose and must not be reported as
  // a broken handle: `buildAssetRoster` returned NO_ASSETS_ROSTER, telling the model outright that
  // no handle exists, so there is nothing here it could have got wrong. Gated on `writable`, not on
  // `roster`, because a project holding only VOICE assets shows the writer that same empty roster.
  if (writable.length === 0) {
    return { mentioned: [], unknown: [], missing: [], coverage: 0 };
  }

  // Matched exactly, not case-insensitively, even though the roster is what the model was shown.
  // `assetResolver` looks handles up with a case-sensitive `handle: { in: [...] }` query, so a
  // handle that differs only in case does not resolve — passing it here would let a prompt through
  // that fails downstream, which is the one direction a validator must never be lenient in. Such a
  // handle lands in `unknown`, where `nearestHandle` is one edit away from naming the right casing.
  const byHandle = new Map(roster.map((asset) => [asset.handle, asset]));
  const mentioned: string[] = [];
  const unknown: string[] = [];

  for (const handle of handles) {
    const asset = byHandle.get(handle);
    if (asset) mentioned.push(asset.handle);
    else unknown.push(handle);
  }

  const used = new Set(mentioned);
  const writableHandles = writable.map((asset) => asset.handle);
  const missing = writableHandles.filter((handle) => !used.has(handle));
  // Counted over writable handles only: a mentioned VOICE asset resolves fine but was never part of
  // the roster the writer was offered, so letting it score would push coverage past 1.
  const usedWritable = writableHandles.filter((handle) => used.has(handle)).length;
  const coverage = writable.length === 0 ? 0 : usedWritable / writable.length;

  return { mentioned, unknown, missing, coverage: Number(coverage.toFixed(4)) };
}

/**
 * The same finding as `checkMentionPolicy`, phrased for a person instead of a model.
 *
 * The two audiences want opposite things: the model needs the whole valid vocabulary restated so it
 * can rewrite, a person typing `@hitmoi` into a beat needs one short sentence naming the handle they
 * probably meant. Returns `null` when every handle resolved — the caller can pass it straight
 * through as an optional warning.
 */
export function mentionWarning(v: MentionValidation): string | null {
  if (v.unknown.length === 0) return null;

  const valid = [...new Set([...v.mentioned, ...v.missing])];
  const parts = v.unknown.map((handle) => {
    const nearest = nearestHandle(handle, valid);
    return nearest ? `@${handle} (did you mean @${nearest}?)` : `@${handle}`;
  });
  const subject = parts.length === 1 ? 'handle' : 'handles';
  return `Saved — but no asset matches ${parts.join(', ')}. Unmatched ${subject} stay as plain text and are never pinned to a reference.`;
}

export type MentionPolicy = 'strict' | 'lenient';

export type MentionPolicyResult = { ok: true } | { ok: false; reason: MentionPolicyFailure; feedback: string };

/** `unknown-handle` is the real bug class; `no-mentions` means the writer ignored the roster entirely. */
export type MentionPolicyFailure = 'unknown-handle' | 'no-mentions';

export interface MentionPolicyOptions {
  /** `strict` for SCRIPT (the roster must be used at all), `lenient` for BREAKDOWN (a beat may feature no asset). */
  policy: MentionPolicy;
  /** How many writable assets the writer was offered — the caller knows this without re-deriving it. */
  rosterSize: number;
}

/** Past this a list of handles stops being a reminder and starts crowding out the instruction. */
const FEEDBACK_HANDLE_LIMIT = 20;

export function checkMentionPolicy(v: MentionValidation, opts: MentionPolicyOptions): MentionPolicyResult {
  const valid = [...new Set([...v.mentioned, ...v.missing])];

  if (v.unknown.length > 0) {
    return { ok: false, reason: 'unknown-handle', feedback: unknownHandleFeedback(v.unknown, valid) };
  }

  if (opts.policy === 'strict' && opts.rosterSize > 0 && v.mentioned.length === 0) {
    return { ok: false, reason: 'no-mentions', feedback: noMentionsFeedback(opts.rosterSize, valid) };
  }

  return { ok: true };
}

/**
 * Written to be read by a model, not by a log reader — this string goes straight back into the
 * prompt's revision-note slot, so it has to say what is wrong *and* what to write instead. Naming
 * the nearest handle matters because typo-adjacent hallucination (`@lunna` for `@luna`) is the
 * common failure, and a bare "invalid handle" leaves the model to guess again.
 */
function unknownHandleFeedback(unknown: string[], valid: string[]): string {
  const lines = unknown.map((handle) => {
    const nearest = nearestHandle(handle, valid);
    return nearest
      ? `Unknown handle "@${handle}". The closest existing handle is "@${nearest}".`
      : `Unknown handle "@${handle}". No asset in this project uses it.`;
  });
  return [...lines, validHandlesSentence(valid)].join(' ');
}

function noMentionsFeedback(rosterSize: number, valid: string[]): string {
  const assets = rosterSize === 1 ? '1 asset' : `${rosterSize} assets`;
  return (
    `This text mentions none of the project's ${assets}. ` +
    'Reference an established asset by writing its "@handle" verbatim rather than describing it in your own words. ' +
    validHandlesSentence(valid)
  );
}

/** Never reached with an empty list: `validateMentions` returns early when nothing is writable, so
 *  past that point `mentioned ∪ missing` covers the whole writable roster. */
function validHandlesSentence(valid: string[]): string {
  const shown = valid.slice(0, FEEDBACK_HANDLE_LIMIT).map((handle) => `@${handle}`);
  const overflow = valid.length - shown.length;
  const suffix = overflow > 0 ? ` (+${overflow} more)` : '';
  return `Valid handles: ${shown.join(', ')}${suffix}.`;
}

/** Typos land within an edit or two; beyond that a "suggestion" is just a different handle. */
const MAX_SUGGESTION_DISTANCE = 2;

function nearestHandle(handle: string, valid: string[]): string | null {
  let best: string | null = null;
  let bestDistance = Infinity;

  for (const candidate of valid) {
    const distance = levenshtein(handle, candidate);
    // The second clause keeps short handles honest: "@a" is not a typo of "@b" just because they
    // are one edit apart — at that length every handle is a near match of every other.
    if (distance <= MAX_SUGGESTION_DISTANCE && distance < handle.length && distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitution = (prev[j - 1] as number) + (a[i - 1] === b[j - 1] ? 0 : 1);
      const insertion = (row[j - 1] as number) + 1;
      const deletion = (prev[j] as number) + 1;
      row[j] = Math.min(substitution, insertion, deletion);
    }
    prev = row;
  }

  return prev[b.length] as number;
}
