# T14 — Video Assembly Hardening (video-only)

> **Status (2026-08-07): DONE.** All five phases implemented and migrated. Four things differ from the plan below and are recorded inline where they apply: the resolution label was redefined as the **short side** (§3), clips are given a **silent audio track** rather than none so concat has uniform streams (§3), the `-shortest` truncation was **fixed rather than left dormant** (§5), and `skipAudio` needed a **new `Project.pipelineConfig` column** (§5). One implementation trap worth carrying: fluent-ffmpeg validates every input's `-f` against `ffmpeg -formats`, where **lavfi does not appear** — synthesized sources must be filtergraph sources, not inputs.

Goal: make the RENDER stage produce a **correct** video every time, from clips that came from different providers. Audio (voice + music) is explicitly out of scope — see §5.

**Depends on:** nothing. **Blocks:** nothing. Runs fully in parallel with T15 and T16.

**Owns these files** (no other task in this wave writes to them):

- `src/providers/adapters/ffmpeg-assembly.adapter.ts`
- `src/ai/graph/nodes/render.node.ts`
- `src/ai/graph/nodes/voice.node.ts`, `src/ai/graph/nodes/music.node.ts` (Phase 4 only)
- `src/lib/ffmpeg.ts` *(new)*
- `src/config/pipeline-config.ts` *(new — the `skipAudio` flag; note T15 creates `src/config/pipeline.ts` for STAGE_ORDER, deliberately a different file)*

---

## 1. Why

`ffmpegAssemblyAdapter` concatenates with the **concat demuxer plus `-c copy`**:

```ts
cmd.input(concatListPath).inputOptions(['-f concat', '-safe 0']).outputOptions(['-c copy'])
```

Stream copy requires every input to share codec, profile, resolution, pixel format, frame rate and time base. Our clips do not: a project can route `text-to-video` to Veo and `image-to-video` to Seedance or a fal model, and even one model returns different dimensions per aspect ratio. The failure is not a clean error — ffmpeg emits a file whose later segments are frozen, garbled, or timestamp-desynced. It only shows up when a human watches the render.

Two more defects sit next to it: nothing verifies an ffmpeg binary exists until the very last stage (after every scene has been paid for), and `renderNode` stitches from `state.scenes` — a LangGraph checkpoint channel — rather than the `Scene` rows that are the actual record of what was generated.

---

## 2. Phase 1 — ffmpeg preflight

New `src/lib/ffmpeg.ts`:

- `resolveFfmpegPath(): string` — honours `FFMPEG_PATH` env, else falls back to `ffmpeg` on `PATH`.
- `assertFfmpegAvailable(): Promise<void>` — runs `ffmpeg -version` once per process, memoized like `getCheckpointer()` does. Throws a message naming the resolved path and the env var to set.
- Same pair for `ffprobe` (Phase 2 needs it).

Call `assertFfmpegAvailable()` at the **top of `renderNode`, before `withStage`** — so a missing binary fails the stage instantly with a readable error instead of after materializing every clip.

Add `FFMPEG_PATH` (optional) to `.env.example`.

**Done when:** renaming the ffmpeg binary produces a RENDER failure whose message says what is missing and how to fix it.

---

## 3. Phase 2 — normalize before concat

Replace the demuxer + `-c copy` path with an explicit two-step:

1. **Probe** each clip with `ffprobe` → width, height, fps, pixel format, whether it has an audio stream.
2. **Normalize** each clip to one target profile in its own pass:
   - scale + pad to the target dimensions derived from `req.aspectRatio` / `req.resolution` (pad, never crop — a stretched face is worse than letterboxing), plus `setsar=1`, since a non-square pixel aspect ratio surviving the concat plays back stretched,
   - `-r 30` (constant), `-pix_fmt yuv420p`, `-video_track_timescale 90000`,
   - `-c:v libx264 -preset veryfast -crf 18` — near-visually-lossless, since this is an intermediate.
3. **Concat** the normalized files. Now `-c copy` is genuinely safe, because we produced every input ourselves.

Two decisions taken while implementing, both of which change output rather than only fixing it:

- **The resolution label names the short side.** The old code read it as the height in every aspect ratio, so a 1080p 9:16 project — the default — rendered 608×1080, well under what it asked for. It is now 1080×1920 for 9:16, 1920×1080 for 16:9, 1080×1080 for 1:1. Every derived side is rounded to even, because libx264 rejects odd dimensions under yuv420p.
- **Clips without audio get synthesized silence**, not no audio stream. Concat needs every input to expose the same streams, and mixed audio/no-audio inputs is exactly the mismatch this phase exists to remove. Dropping audio everywhere would have been the other uniform answer, but several video models now emit native audio and throwing it away is a real loss. The silence must be a **filtergraph source** (`anullsrc=…[a]` inside `-filter_complex`), not a second `-f lavfi` input: fluent-ffmpeg checks each input's `-f` against `ffmpeg -formats`, and lavfi is registered as a *device*, so it rejects the command before ffmpeg ever runs. `-shortest` is correct here — `anullsrc` is infinite, so the video decides the length.

Run the normalize passes through the existing `mapWithConcurrency` helper (`src/ai/graph/concurrency.ts`) rather than serially — this is CPU-bound work over N clips, and `D:` is a spinning disk (see `docs/knowledge/THIS.md`), so serial re-encode is the slowest possible shape.

Keep every intermediate inside the existing `mkdtemp` workdir so the `finally { rm }` still cleans up.

**Done when:** a manifest of three clips with deliberately different resolutions and frame rates concatenates into one file whose total duration equals the sum of its parts (±0.1s) and which plays through without artefacts.

---

## 4. Phase 3 — RENDER reads the database

`renderNode` currently does:

```ts
if (!state.scenes?.length) throw new Error('renderNode requires state.scenes …');
```

`state.scenes` is a checkpoint channel. It is written by `scenesNode`, and patched out-of-band by `regenerateEpisodeScene` — which, by design, **skips the patch entirely** when the batch has not run (see the long comment in `graph.ts:157`). So a user who generated every beat one card at a time has correct `Scene` rows and an empty channel.

Change it to read `prisma.scene.findMany({ where: { episodeId, status: 'READY' }, orderBy: { index: 'asc' } })`, and fail with a specific message when a beat in the episode's breakdown has no READY row — naming the missing indices, so the user knows which cards to generate rather than being told "no scenes".

Leave `state.scenes` in the annotation. Other code reads it and removing a channel is a separate change; this task only stops RENDER from trusting it.

**Done when:** an episode whose scenes were all generated one-at-a-time (never through the batch) renders correctly.

---

## 5. Phase 4 — `skipAudio` flag

Out of scope for this task: music generation and per-scene voice alignment.

**The `-shortest` bug was fixed rather than left dormant.** The plan was to document it and move on, since with no audio inputs it cannot fire — but the fix turned out to be one filter: `apad` on the mixed track before `-shortest`, so audio shorter than the video pads with silence instead of ending the film early. Leaving a known truncation in place to save one token was not worth it. Per-scene voice *alignment* is still deferred: the voice track is laid across the whole episode, not per beat.

So that iterating on video does not keep paying for audio:

- `pipelineConfig.skipAudio: boolean` on `Project`. The plan said to reuse an existing JSON column; there isn't a suitable one — `styleConfig` is how a shot looks and `modelConfig` is which vendor runs a capability, and overloading either would make both harder to read. A new `pipelineConfig` column was added instead (`migration 20260807140000`), parsed through `src/config/pipeline-config.ts` and never cast inline. T19 assumes this column exists too, so it earns its keep twice.
- `voiceNode` and `musicNode`: when the flag is set, `completeStage` immediately with empty output, `costEstimate: 0`, and **no provider call**. Do not delete or unwire the nodes — the flag is a switch, not a removal.
- Project settings → Pipeline page gets the toggle.

**Done when:** with the flag on, an approve-through-to-render run makes zero ElevenLabs/music provider calls and RENDER still produces a video.

---

## 6. Phase 5 — tests + backlog

Tests in `src/providers/adapters/ffmpeg-assembly.test.ts`, using tiny generated clips (`ffmpeg -f lavfi -i testsrc`) so no fixture binaries enter the repo. The fixtures shell out to ffmpeg directly, for the lavfi reason in §3. `describe.skipIf` skips the integration half when no binary is present, so CI on a bare image reports skipped rather than red.

The three clips are deliberately mismatched (640×360@24 without audio, 1080×1920@30 with audio, 480×480@15 without) — that combination *is* the bug this task fixes.

- `targetDimensions` for all three aspect ratios × three resolutions, including the never-odd invariant
- mixed-resolution, mixed-frame-rate concat yields the summed duration (the old `-c copy` path does not)
- output conforms to one profile: target dimensions, 30fps
- 16:9 renders correctly from vertical sources
- the cut carries a uniform audio track even though only one source clip had one
- empty manifest is rejected
- `assertFfmpegAvailable` names both the binary and the env var when it cannot run

Plus `src/ai/graph/nodes/render.node.test.ts` (rows over channel; missing indices named; ffmpeg checked before any other work) and `src/config/pipeline-config.test.ts` (null/junk/foreign keys all fall back to defaults).

**Backlog written down, not built:** music assembly, per-scene voice alignment, an end-to-end pipeline test against fake providers.
