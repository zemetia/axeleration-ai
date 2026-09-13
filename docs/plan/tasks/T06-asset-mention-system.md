# T06 — Asset-Mention System

> **Status (2026-07-27): DONE.** `src/assets/mention.ts` (`extractMentions`) + `src/assets/resolver.ts` (`assetResolver.resolve`, `splitRefsForRequest`) implemented against the already-built `assetService.byHandles` (T08) and `AssetRef`/`ProviderRequest` types (T03, `src/providers/types.ts`). 12 unit/integration tests in `src/assets/mention.test.ts` + `src/assets/resolver.test.ts` cover start/end/punctuation/dedupe/email-false-positive, CHARACTER → `referenceImages`, VOICE → `voiceId`, and unknown-handle pass-through. `npm run lint` and `tsc --noEmit` clean. Not yet wired into T04's SCENES/VOICE nodes or T05's `resolve_mention` MCP tool — those tasks haven't started, so integration there is still open.

Goal: write `@luna` in any prompt → the system resolves it to a stored Asset, rewrites the text with the canonical description, **and attaches that asset's reference file to the generation call automatically**. This is the "mention an asset → auto-sent to the AI server" requirement.

**Depends on:** T02 (Asset model), T03 (`AssetRef`/`ProviderRequest`). **Blocks:** T04 SCENES node, T05 asset server.

Lives in `src/assets/`.

---

## 1. Mention syntax

- Token: `@` + handle, where handle matches `Asset.handle` (unique per project). Handle charset: `[a-z0-9-]` (lowercase, kebab). Example: `@luna`, `@rainy-alley`, `@hero-city`.
- A mention can appear anywhere in a prompt string (idea, scene description, scene-compose output).
- Unknown handle → left as literal text + a warning surfaced to the UI (non-blocking).

---

## 2. Parser (`src/assets/mention.ts`)

```ts
const MENTION_RE = /@([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)/g;

export function extractMentions(text: string): string[] {
  return [...text.matchAll(MENTION_RE)].map((m) => m[1]);  // dedupe by caller
}
```

Pure, no I/O. Keep it dead simple and unit-tested (handles at start/end, adjacent punctuation, duplicates, no false-positive on emails — restrict to word boundary before `@`).

---

## 3. Resolver (`src/assets/resolver.ts`)

The heart of the feature. Turns raw text into `{ rewritten, refs }`.

```ts
export interface ResolveResult {
  rewritten: string;         // @handles replaced by canonical descriptions
  refs: AssetRef[];          // dedupe'd assets to attach to the provider call
  unknown: string[];         // handles with no matching asset (→ UI warning)
}

export const assetResolver = {
  async resolve(projectId: string, text: string): Promise<ResolveResult> {
    const handles = unique(extractMentions(text));
    const assets = await assetService.byHandles(projectId, handles);   // one query, indexed by (projectId, handle)
    const map = new Map(assets.map((a) => [a.handle, a]));

    let rewritten = text;
    const refs: AssetRef[] = [];
    const unknown: string[] = [];

    for (const h of handles) {
      const a = map.get(h);
      if (!a) { unknown.push(h); continue; }
      // (a) rewrite text: @luna → "Luna (silver hair, red scarf)"
      rewritten = rewritten.replaceAll(`@${h}`, a.description ?? a.name);
      // (b) collect reference to ship to the vendor
      refs.push({ handle: h, type: a.type, refUrl: a.refUrl ?? undefined, voiceId: a.voiceId ?? undefined, description: a.description ?? undefined });
    }
    return { rewritten, refs, unknown };
  },
};
```

**How the reference reaches the AI server:** the resolver output feeds `ProviderRequest`:

```ts
const { rewritten, refs } = await assetResolver.resolve(projectId, sceneText);
await providerRegistry.run('image-to-video', {
  capability: 'image-to-video',
  prompt: rewritten,
  referenceImages: refs.filter((r) => r.type !== 'VOICE'),   // image/video refs
  voiceId: refs.find((r) => r.type === 'VOICE')?.voiceId,    // for a voice mention
  aspectRatio, resolution,
});
```

Each adapter (T03) already maps `referenceImages[].refUrl` → the vendor's reference param. So a mention deterministically ships its stored file to the model. No manual per-prompt upload.

---

## 4. Type-aware behavior

| Asset type | On mention, contributes… |
|---|---|
| `CHARACTER` / `PERSON` | reference image → identity/face ref (IP-Adapter / init image); description → prompt |
| `STYLE` | reference image → style ref; description → style tags |
| `LOCATION` / `MAP` / `PROP` | reference image → scene/object ref; description → prompt |
| `VOICE` | `voiceId` → TTS voice; not sent to image/video calls |

The resolver splits refs by capability at call sites (image/video vs tts), as shown above.

---

## 5. Integration points

1. **SCENES node (T04):** resolve each scene's composed prompt before the provider call.
2. **VOICE node (T04):** if a dialogue line names a `@voice-*` asset (or the character maps to a voice asset), resolve to `voiceId`.
3. **MCP `resolve_mention` (T05):** same resolver, so the LLM can call it while composing prompts and insert correct mentions itself.
4. **UI mention input (T09):** `@`-autocomplete in prompt fields sourced from `list_assets`.

---

## 6. UI: mention autocomplete (spec for T09)

`AssetMentionInput` (client component): on `@`, show a dropdown of the project's assets (from a TanStack Query to `assetService.list`), insert `@handle` on select, render inserted mentions as chips. Purely client-side text assist; resolution still happens server-side at generation time (never trust client-rewritten text).

---

## Acceptance criteria

- [ ] `extractMentions` unit tests cover start/end/adjacent-punct/duplicates and does **not** match inside an email.
- [ ] `assetResolver.resolve` rewrites known handles, returns deduped `refs`, and lists `unknown`.
- [ ] A CHARACTER mention results in `referenceImages` containing that asset's `refUrl` in the outgoing `ProviderRequest` (integration test with a fake adapter asserting the vendor received the ref).
- [ ] A VOICE mention routes to `voiceId`, not `referenceImages`.
- [ ] Unknown handles never crash generation — they pass through as literal text + a surfaced warning.
