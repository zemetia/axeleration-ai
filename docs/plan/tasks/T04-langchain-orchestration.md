# T04 — LangChain / LangGraph Orchestration

> **Status (2026-07-28): DONE.** Model router, all six prompt templates + `script.schema.ts`, the continuity chain (with test), and the full episode graph — `graph/{state,graph,checkpointer,stage-io,concurrency}.ts` + `graph/nodes/*.ts` — are written. The graph compiles with the Postgres checkpointer and `interruptAfter` every stage; `runEpisodeGraph` / `resumeEpisodeGraph` / `regenerateEpisodeStage` are what T07's Inngest functions call.
>
> **Added by T07 (2026-07-28):** a `regenerateNote` state channel that carries the user's Regenerate note into the IDEA / SCRIPT / SCENES prompts (`{revisionNote}`); every node clears it after running so it can't leak into the next stage. Also `character-bible` as a new `LlmTask` and the identity-lock chain in `ai/bible/bible-chain.ts` + `prompts/bible.prompt.ts`, which T07's `generate-bible` function needs.
>
> **Nodes do not use MCP tools** — see [T05](./T05-mcp-integration.md) status for why the pipeline stays deterministic.

Goal: the "brain". Prompt templates, model routing, Zod-structured output, continuity memory, and the episode **state graph** with per-stage human-in-the-loop interrupts.

**Depends on:** T01, T02, T03. **Blocks:** T05 (tools plug into chains), T07 (engine invokes the graph).

Lives in `src/ai/`.

---

## 1. Model router (`src/ai/router/`)

Picks the LLM (and params) per task type; keeps chains vendor-agnostic. Wrap the provider registry so LangChain gets a `Runnable`/`ChatModel`.

```ts
// src/ai/router/model-router.ts
export type LlmTask = 'idea' | 'script' | 'scene-compose' | 'summarize-continuity';

export function getChatModel(task: LlmTask, project?: ProjectModelConfig): BaseChatModel {
  // resolve provider+model via providerRegistry.select('llm-text', …)
  // return new ChatAnthropic({ model, apiKey }) | ChatOpenAI({...})
  // task-specific temperature: idea 0.9, script 0.4, scene-compose 0.6, summarize 0.2
}
```

Routing rule of thumb: creative stages (idea) run hotter; structural stages (script → JSON, continuity summary) run cold. Allow a project-level model override to flow through (`project.modelConfig`).

---

## 2. Prompt templates (`src/ai/prompts/`)

One `ChatPromptTemplate` per stage. All prompts pull identity from the **character bible** and history from **continuity state** (fetched via MCP tools in T05, or injected directly by the node).

| File | Input | Output |
|---|---|---|
| `idea.prompt.ts` | premise, continuity summary, project type | short beat/idea for the next episode |
| `script.prompt.ts` | idea, character bible, video config (scene count) | **structured** scene breakdown (Zod) |
| `scene-compose.prompt.ts` | one scene + character bible + style config | a single image/video prompt string with `@mentions` |
| `voice.prompt.ts` | script dialogue/narration lines | per-line TTS scripts (speaker → text) |
| `music.prompt.ts` | episode mood/tone | a music-generation brief |
| `continuity.prompt.ts` | prev summary + this episode's events | new rolling summary (bounded length) |

---

## 3. Structured output (script breakdown)

The SCRIPT stage must return typed JSON, not prose. Use `withStructuredOutput`.

```ts
// src/ai/prompts/script.schema.ts
export const sceneBreakdownSchema = z.object({
  logline: z.string(),
  scenes: z.array(z.object({
    index: z.number(),
    durationSeconds: z.number(),
    description: z.string(),         // may contain @mentions
    dialogue: z.array(z.object({ speaker: z.string(), line: z.string() })).default([]),
    mood: z.string().optional(),
  })).min(1),
});
export type SceneBreakdown = z.infer<typeof sceneBreakdownSchema>;
```

Scene count is derived, then enforced in the prompt: `targetScenes = round(targetTotalSeconds / avg(sceneDurationMin, sceneDurationMax))`, clamped to `aiConfig.limits.maxScenesPerEpisode`. Pass `targetScenes` into `script.prompt.ts` so the model produces roughly that many scenes summing to `targetTotalSeconds`.

```ts
const model = getChatModel('script', project).withStructuredOutput(sceneBreakdownSchema);
const breakdown = await scriptPrompt.pipe(model).invoke({ idea, bible, targetScenes, videoConfig });
```

---

## 4. Continuity memory (`src/ai/continuity/`)

Do **not** append raw history — re-summarize. After an episode's RENDER approves, run the continuity chain: `(previousSummary, thisEpisodeEvents) → newSummary` (cold model, length-bounded). Persist to `ContinuityState.summary`. This keeps the IDEA prompt cheap and in-token regardless of episode count.

---

## 5. Episode state graph (`src/ai/graph/`)

The core. A `StateGraph` whose nodes are the six stages. After each node, `interrupt()` yields to the human; the UI's Approve resumes, Regenerate re-runs the node. State is checkpointed in Postgres, thread-keyed by `episodeId`.

```ts
// src/ai/graph/state.ts
export interface EpisodeGraphState {
  episodeId: string;
  projectId: string;
  idea?: string;
  script?: SceneBreakdown;
  scenes?: { index: number; videoUrl: string }[];
  voiceUrls?: string[];
  musicUrl?: string;
  finalVideoUrl?: string;
  costTotal: number;
}
```

```ts
// src/ai/graph/graph.ts (shape)
const g = new StateGraph<EpisodeGraphState>({ channels });
g.addNode('IDEA',   ideaNode);
g.addNode('SCRIPT', scriptNode);
g.addNode('SCENES', scenesNode);   // fans out per scene (bounded concurrency)
g.addNode('VOICE',  voiceNode);
g.addNode('MUSIC',  musicNode);
g.addNode('RENDER', renderNode);
g.addEdge(START, 'IDEA');
g.addEdge('IDEA','SCRIPT'); g.addEdge('SCRIPT','SCENES'); g.addEdge('SCENES','VOICE');
g.addEdge('VOICE','MUSIC');  g.addEdge('MUSIC','RENDER');  g.addEdge('RENDER', END);

export const episodeGraph = g.compile({
  checkpointer: postgresCheckpointer,       // @langchain/langgraph-checkpoint-postgres
  interruptAfter: ['IDEA','SCRIPT','SCENES','VOICE','MUSIC','RENDER'],
});
```

**Each node** (in `src/ai/graph/nodes/`) does:
1. Set the matching `EpisodeStage.status = GENERATING`, `startedAt`, bump `attempt` if this is a regenerate.
2. Run its chain / provider calls (routing via T03, tools via T05).
3. Save outputs to local storage; write `EpisodeStage.output`, `costEstimate`, `providerMeta`; set `status = READY`.
4. Return the patched graph state. The graph then interrupts.

`SCENES` node fans out: `Promise`-map over `state.script.scenes` with concurrency `aiConfig.limits.sceneConcurrency`; each scene → compose prompt → resolve `@mentions` (T06) → `providerRegistry.run('image-to-video'|'text-to-video', …)`.

Resume/regenerate control (called by the engine, T07):

```ts
await episodeGraph.invoke(null, { configurable: { thread_id: episodeId }, resume: approvalCommand });
```

---

## Acceptance criteria

- [ ] `getChatModel` returns a working ChatModel for anthropic + openai, task-tuned temperature.
- [ ] SCRIPT stage returns data validated by `sceneBreakdownSchema`; scene count tracks Video Config within ±1.
- [ ] Graph compiles with a Postgres checkpointer and interrupts after every stage.
- [ ] Re-invoking a thread with a `resume` command re-runs only the targeted node and bumps `attempt`.
- [ ] Continuity summary stays bounded (< N chars) regardless of episode count.
- [ ] Nodes never call vendor SDKs directly — only via the T03 registry and T05 tools.
