/**
 * Matches `@handle` with a word boundary before `@` so `user@example.com` never matches.
 *
 * The scan accepts uppercase even though a stored handle is always lowercase, and that asymmetry is
 * the point: **scanning and resolving answer different questions.** Resolution stays case-sensitive
 * (`assetResolver` queries `handle: { in: [...] }`, `validateMentions` compares exactly), so
 * `@Hitomi` still resolves to nothing — but it now *scans* as a handle, which is what lets the
 * validator say "did you mean @hitomi?" and lets `MentionText` mark it as unresolved. While the scan
 * was lowercase-only, a capitalised handle was invisible to every layer at once: no link, no
 * warning, and a silent literal "@Hitomi" delivered to the video model.
 */
const MENTION_RE = /(?<![\w@.])@([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)/g;

/** Pure text scan for `@handle` mentions. Returns handles in order of first appearance, deduped. */
export function extractMentions(text: string): string[] {
  const seen = new Set<string>();
  for (const match of text.matchAll(MENTION_RE)) {
    const handle = match[1];
    if (handle) seen.add(handle);
  }
  return [...seen];
}

export type MentionSegment =
  | { kind: 'text'; text: string }
  | { kind: 'mention'; text: string; handle: string };

/**
 * The same scan as `extractMentions`, but keeping the prose around the matches — what a renderer
 * needs to turn `@luna` into a link without losing a character of the writing it sits in.
 *
 * Every mention is returned, including repeats: `extractMentions` answers "which assets does this
 * text use", this one answers "what does this text look like", and the second question needs the
 * second `@luna` too. Concatenating every segment's `text` reproduces the input exactly.
 */
export function splitMentions(text: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(MENTION_RE)) {
    const handle = match[1];
    if (handle === undefined || match.index === undefined) continue;
    if (match.index > cursor) segments.push({ kind: 'text', text: text.slice(cursor, match.index) });
    segments.push({ kind: 'mention', text: match[0], handle });
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) });
  return segments;
}
