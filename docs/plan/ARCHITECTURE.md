# Architecture — AI Stack

How LangGraph, MCP, the provider registry, and the asset-mention system fit together. Read [VIDEO_PLATFORM_MVP.md](./VIDEO_PLATFORM_MVP.md) first.

---

## 1. The three AI layers

```
┌───────────────────────────────────────────────────────────────────────┐
│  LAYER 1 — ORCHESTRATION  (LangChain / LangGraph.js)                    │
│  The "brain". A stateful graph per episode.                            │
│  • Nodes = pipeline stages (IDEA → SCRIPT → SCENES → VOICE → MUSIC → RENDER) │
│  • interrupt() after each stage → waits for user Approve / Regenerate  │
│  • Prompt templates, model routing, Zod-structured output              │
│  • Postgres checkpointer persists graph state between interrupts        │
└───────────────────────────────────────────────────────────────────────┘
            │ calls tools (during a node's LLM step)      ▲ resume(approval)
            ▼                                             │
┌───────────────────────────────────────────────────────────────────────┐
│  LAYER 2 — TOOLING / DATA  (MCP servers, loaded as LangChain tools)    │
│  Standardized, reusable tool surface the LLM can call:                  │
│  • asset:    list_assets, get_asset, resolve_mention                   │
│  • context:  get_character_bible, get_continuity_state                 │
│  • gen:      generate_image, generate_video, generate_voice, generate_music │
│              (thin wrappers over Layer 3 — lets a node be agentic)     │
│  • research: web_search, fetch_page (local Chrome via CDP, no API key) │
└───────────────────────────────────────────────────────────────────────┘
            │ deterministic generation calls
            ▼
┌───────────────────────────────────────────────────────────────────────┐
│  LAYER 3 — GENERATION  (Provider Registry + Adapters)                  │
│  One interface per capability, many vendors/models behind it.          │
│  capability → policy picks provider → adapter maps to vendor API       │
│  text-to-image · image-to-image · text-to-video · image-to-video ·    │
│  tts · music · video-assembly · llm-text                              │
│  Vendors: fal.ai / Replicate (aggregators) · ElevenLabs · Anthropic … │
└───────────────────────────────────────────────────────────────────────┘
            │ saves results                      │ reads keys
            ▼                                     ▼
   Object Storage (local `storage/`)       Encrypted ApiKey (DB)
```

**Why both MCP and LangChain?** LangChain/LangGraph is the *control flow* (which stage, which prompt, which model, when to pause). MCP is the *capability surface* — a versioned, swappable, externally-connectable set of tools the LLM inside a node can call. Layer 3 stays a plain, deterministic registry the pipeline calls directly; MCP just also exposes it so a node can be agentic when needed. Clean separation: swap a model without touching the graph; add a tool without touching a provider.

---

## 2. Episode pipeline as a LangGraph state graph

Each stage is a node. After a node produces output it **interrupts**; the UI shows the result with Approve / Regenerate; the user's choice resumes or re-runs the node. State (all stage outputs, continuity, cost) is checkpointed in Postgres keyed by `episodeId`.

```
        ┌────────┐  interrupt   ┌──────────┐  interrupt   ┌────────┐
 start ─►  IDEA  ├────────────► │  SCRIPT  ├────────────► │ SCENES ├─► …
        └────────┘  approve     └──────────┘  approve     └────┬───┘
             ▲ regenerate            ▲ regenerate              │ fan-out per scene
             └───────────────────────┘                         ▼
                                                    ┌─────────────────────┐
                                                    │ generate each scene  │ (parallel)
                                                    └─────────────────────┘
   … → VOICE → MUSIC → RENDER → update ContinuityState → status READY_FOR_REVIEW
```

- **SCRIPT** node uses `llm.withStructuredOutput(sceneBreakdownSchema)` → typed JSON. Scene count derived from Video Config: `round(targetTotalDuration / avgSceneDuration)`.
- **SCENES** node fans out: one generation call per scene (parallel, bounded concurrency). Each scene prompt is composed from `character_bible + style_config + resolved @mentions + research context`.
- Human-in-the-loop = LangGraph `interrupt()`; durability + retries = Inngest wrapping the graph invocation (see [T07](./tasks/T07-pipeline-engine.md)).

**Research is not a node.** Before fanning out, SCENES calls the research agent once for the whole episode — an agentic `createReactAgent` loop (goal/target/baseline in, source-backed `ResearchDossier` out) that drives `web_search`/`fetch_page` over a local Chrome via CDP. No approve/regenerate row, no new `StageKind` — it's an input to scene-compose, not a reviewable output, and degrades gracefully (no Chrome running → scenes still compose, just ungrounded). See [T11](./tasks/T11-research-agent.md).

---

## 3. Asset-mention flow (the "auto-send reference to the AI server" bit)

```
Prompt text: "close-up of @luna standing in @rainy-alley, cinematic"
      │
      ▼  (1) parse mentions
   ['@luna', '@rainy-alley']
      │
      ▼  (2) resolve via MCP resolve_mention / AssetResolver
   [ {handle:'@luna', type:CHARACTER, refUrl:'r2://…/luna.png', desc:'…'},
     {handle:'@rainy-alley', type:LOCATION, refUrl:'r2://…/alley.png', desc:'…'} ]
      │
      ▼  (3) rewrite prompt text (replace @handle with canonical description)
   "close-up of Luna (silver hair, red scarf…) standing in a rainy neon alley…"
      │
      ▼  (4) build ProviderRequest
   { prompt: <rewritten>, referenceImages: ['r2://…/luna.png','r2://…/alley.png'], … }
      │
      ▼  (5) adapter maps referenceImages → vendor's shape
        fal/Replicate → image_url[] / ip_adapter; ElevenLabs → voice_id; etc.
      │
      ▼  (6) provider generates → result saved to local storage → Asset/scene output row
```

Key point: **the mention carries a stored reference file**, and every `ProviderAdapter` accepts `referenceImages` (and, for voice, a `voiceId`). So mentioning an asset automatically ships its reference to the generation vendor — no manual upload per prompt. Details in [T06](./tasks/T06-asset-mention-system.md).

---

## 4. Where it lives (repo folder additions)

Follows [docs/blueprint/STRUCTURE.md](../blueprint/STRUCTURE.md). New top-level areas under `src/`:

```
src/
  ai/
    graph/            # LangGraph state graph: nodes, edges, checkpointer, state type
      nodes/          #   idea.node.ts, script.node.ts, scenes.node.ts, voice.node.ts, music.node.ts, render.node.ts
      graph.ts        #   builds + compiles the graph
      state.ts        #   EpisodeGraphState type + channels
    prompts/          # PromptTemplate per stage (idea, script, scene-compose, voice, music)
    router/           # model/provider routing policy
    continuity/       # rolling-summary chain
    research/         # research-agent.ts — on-demand ReAct loop, not a graph node (see T11)
  providers/
    registry.ts       # capability → providers, selection policy, fallback
    types.ts          # Capability, ProviderAdapter, ProviderRequest/Response
    adapters/         # fal.adapter.ts, replicate.adapter.ts, elevenlabs.adapter.ts, anthropic.adapter.ts, ffmpeg-assembly.adapter.ts
  mcp/
    servers/          # asset.server.ts, context.server.ts, generation.server.ts, research.server.ts
    client.ts         # connects to servers, exposes tools to LangChain (mcp-adapters)
    tools.ts          # tool schemas (zod) shared by servers
  assets/
    mention.ts        # parser: extract @handles
    resolver.ts       # handle → Asset → prompt rewrite + referenceImages
  inngest/
    client.ts
    functions/        # generate-episode.ts, run-stage.ts, resume-stage.ts
  lib/
    storage.ts        # local filesystem read/write (fs/promises) — swappable for S3/R2 later
    crypto.ts         # AES-256-GCM encrypt/decrypt for ApiKey
    browser-cdp.ts     # connects to a local Chrome over CDP for the research agent's web tools
  services/           # project/episode/asset/apiKey/generation services (existing pattern)
  stores/             # UI-only state (wizard step, stage panel) — NOT server data
prisma/schema/        # project.prisma, episode.prisma, asset.prisma, apikey.prisma …
```

**Boundary rules (from blueprint):** components never call providers/MCP/prisma directly — they call **services**; services or Server Actions call the pipeline/registry; server data in the UI is **TanStack Query only**. `'use client'` only where a hook/event/browser API is required.

---

## 5. End-to-end request lifecycle (generate one episode)

```
Project Detail page ──"Generate Episode"──► Server Action
   └─ requireAuth(); create Episode(DRAFT) + 6 EpisodeStage(PENDING); send Inngest event
Inngest `episode/generate` ──► invoke LangGraph(episodeId)
   ├─ IDEA node   → (LLM via router, context via MCP) → save stage output → interrupt
   │     UI polls stage via TanStack Query; shows result; user Approves
   │     Server Action `approveStage` → Inngest `episode/stage.approve` → graph.resume
   ├─ SCRIPT node → structured scene breakdown (scene count from Video Config) → interrupt
   ├─ SCENES node → fan-out per scene: resolve @mentions → provider(text/image→video) → local storage → interrupt
   ├─ VOICE node  → tts(voiceId) per dialogue line → local storage → interrupt
   ├─ MUSIC node  → music/preset → local storage → interrupt
   ├─ RENDER node → assembly(scenes+voice+music, aspectRatio/resolution) → final.mp4 → local storage
   └─ update ContinuityState (rolling summary) → Episode READY_FOR_REVIEW → n8n webhook notify
```

Every provider call appends a cost row/estimate to its `EpisodeStage` (see [T02](./tasks/T02-database-schema.md) `EpisodeStage.attempt` + `costEstimate`). Regenerate bumps `attempt` and re-runs only that node.
