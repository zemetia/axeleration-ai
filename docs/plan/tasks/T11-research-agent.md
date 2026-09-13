# T11 — Research Agent

Goal: an agentic (ReAct) LangGraph loop that researches a **goal / target / baseline** over the live web — using a real local Chrome via CDP, not a paid search API — and hands the SCENES node a source-backed dossier to ground its generation prompts in.

**Depends on:** T04 (router, MCP bridge), T05 (MCP server pattern). **Consumed by:** the SCENES node (T04 §5).

Lives in `src/ai/research/`, with its tool surface in `src/mcp/servers/research.server.ts` and `src/lib/browser-cdp.ts`.

---

## 1. Why this is not a pipeline stage

Every other capability in this doc set is a fixed node in the episode graph (`IDEA → SCRIPT → SCENES → …`), each gated by an `interrupt()` and an Approve/Regenerate row in `EpisodeStage`. Research is deliberately **not** one of those:

- It has no independent output the user reviews — it's an input to the SCENES node's own prompt composition, not a deliverable.
- It should degrade gracefully (Chrome not running → scenes still compose, just without grounded detail) rather than block/fail the pipeline the way a missing character bible would.

So it's a plain async function, `runResearchAgent()`, callable from any node — currently only `scenesNode` calls it, once per SCENES run (covering the whole episode, not per-scene, to bound search cost/latency). Its output is persisted for traceability inside the SCENES stage's own `EpisodeStage.output.research`, not a new `StageKind`.

---

## 2. Why a real local browser instead of a search API

This app is local-first (see `docs/plan/README.md` → "Local-first note") — there's no server to host a hosted headless browser, and there's no reason to *require* a paid vendor (Tavily/Exa/SerpAPI) and a new `ApiKey` row just to fetch a results page. Instead, `src/lib/browser-cdp.ts` connects to a Chrome **the user already has running** over the Chrome DevTools Protocol:

```bash
chrome --remote-debugging-port=9222 --user-data-dir="%TEMP%\research-chrome-profile"
```

`RESEARCH_CDP_ENDPOINT` (default `http://localhost:9222`) points at it. `playwright-core`'s `chromium.connectOverCDP()` attaches without launching or bundling a browser binary. Every tool call opens an isolated `BrowserContext`, so cookies/history from one research run don't leak into the next — **except** `search_x`, which needs `withPage(fn, 'signed-in')` (see §3.2).

The browser is the *default* path, not the only one. `src/lib/web-research.ts` owns a fallback ladder so a closed Chrome degrades the run instead of ending it:

```
web_search:  Brave API (if BRAVE_SEARCH_API_KEY)  →  DuckDuckGo via Chrome  →  DuckDuckGo over plain HTTP
fetch_page:  Chrome (JS renders)                  →  plain HTTP
```

Every response carries `via` (and `degradedFrom` when it fell through), so a dossier can be judged on where it actually came from. Both DuckDuckGo transports share one parser — the `/html/` endpoint is server-rendered, so the browser only buys a real session when DDG decides a bare HTTP client looks like a bot.

---

## 3. Tools (`src/mcp/servers/research.server.ts`)

Same MCP pattern as every other server (T05): schemas + handlers live in `src/mcp/tools.ts`, the server just registers them. `projectId` is required on all four for consistency with `bindProjectScope`'s security boundary (every MCP tool is scoped that way), even though none of them read project data.

| Tool | Input | Output | Backed by |
|---|---|---|---|
| `web_search` | `{ projectId, query, maxResults, recency }` | `{ results[], via, degradedFrom? }` | `web-research.webSearch` — the ladder above. `recency` (`day`/`week`/`month`/`year`/`any`) maps to Brave's `freshness` and DDG's `df` |
| `fetch_page` | `{ projectId, url }` | `{ title, url, textContent, via }` | `web-research.readPage` — renders in Chrome (JS included), falls back to HTTP |
| `fetch_url` | `{ projectId, url }` | `{ url, status, contentType, body, truncated }` | `http-fetch.httpFetch` — plain `fetch`, no browser |
| `search_x` | `{ projectId, query, maxResults, mode }` | `{ posts[], via, query }` | `x-search.xSearch` — official API or the signed-in browser |

### 3.1 Why `fetch_url` exists next to `fetch_page`

They are not redundant. `fetch_page` costs a full browser render; `fetch_url` is a bare `fetch` and is ~20x faster. More importantly it is the only sane way to read the **JSON endpoints that answer "what's new" far better than a results page does** — HN Algolia, the GitHub search API, arXiv, `reddit.com/r/x/new.json`. The system prompt lists those URLs explicitly, which is how the agent reaches many sources without needing many tools.

`httpFetch` pretty-prints JSON into `body` and strips HTML to prose, so the model gets one text field either way.

### 3.2 X (Twitter) — `search_x`

Two paths, one output shape:

1. **`X_BEARER_TOKEN` set** → `GET /2/tweets/search/recent`. Clean and rate-limited, but X's *search* endpoints are not on the free tier, so this is opt-in and never assumed.
2. **Otherwise** → x.com's own search page inside the user's **signed-in** Chrome profile (`browser.contexts()[0]`, not a fresh context), because logged-out X shows a login wall instead of results. X virtualises its timeline, so the scraper collects on each scroll pass and dedupes by permalink.

Two things to be honest about with path 2: the requests are made **as the user's own account**, under their rate limits and their exposure if X objects to automated reading; and it is the one place a research tool touches the real profile rather than a throwaway context. It stays behind an explicit tool call, and the login wall produces a clear actionable error rather than an empty result.

### 3.3 Untrusted input

Two guards, both added because this agent reads text written by strangers:

- **SSRF** — `assertPublicUrl()` (in `http-fetch.ts`, called by every read path) rejects non-http(s) schemes and loopback/private/link-local hosts. Without it, one injected instruction turns the research tool into a reader of this machine's own localhost app or cloud metadata. Literal-host check only; a public domain resolving to a private IP still gets through, which is the accepted limit.
- **Prompt injection** — the system prompt states that everything a tool returns is untrusted data, that instructions found inside a page or post must not be followed, and that the attempt should be reported as a finding.

---

## 4. The agent (`src/ai/research/research-agent.ts`)

A `createReactAgent` (`@langchain/langgraph/prebuilt`) tool-calling loop, not a single prompt→response chain:

```ts
export interface RunResearchAgentInput {
  projectId: string;
  goal: string;      // why: e.g. "ground this episode's scenes in real-world detail"
  target: string;     // what: the concrete thing to investigate (logline + scene descriptions)
  baseline: string;   // what's already known — continuity summary + character bible; don't re-derive this
  modelConfig?: ProjectModelConfig;
}

export async function runResearchAgent(input: RunResearchAgentInput): Promise<ResearchDossier> {
  const model = await getChatModel('research', { projectId: input.projectId, project: input.modelConfig });
  const toolset = await getMcpTools({ projectId: input.projectId, servers: ['research'] });
  const agent = createReactAgent({
    llm: model,
    tools: toolset.tools,
    prompt: researchAgentSystemPrompt(aiConfig.limits.researchMaxSearches),
    responseFormat: { schema: researchDossierSchema, prompt: RESEARCH_STRUCTURED_RESPONSE_PROMPT },
  });
  const result = await agent.invoke({ messages: [...] }, { recursionLimit: aiConfig.limits.researchMaxSearches * 4 + 10 });
  return researchDossierSchema.parse(result.structuredResponse);
}
```

- **The system prompt is a tool guide, not just a role.** Left unguided a model renders every URL through Chrome when a plain fetch would do, and calls anything "latest" from training data. So it carries: today's ISO date (a model has no clock), when to reach for each of the four tools, the free JSON endpoints worth hitting, the rule that an X post is a *claim* needing corroboration before it becomes a cited finding, and the untrusted-input rule from §3.3.
- **`goal`/`target`/`baseline`** are the three inputs the model is told never to conflate: research past the baseline, toward the target, in service of the goal. The system prompt (`src/ai/prompts/research.prompt.ts`) states this explicitly and forbids stating a fact the agent hasn't actually read via `fetch_page`.
- **`aiConfig.limits.researchMaxSearches`** (default 6) is a soft instruction to the model *and* a hard `recursionLimit` backstop on the graph, so a stuck loop can't run forever.
- **`responseFormat`** is LangGraph's built-in "one more structured call after the tool loop ends" — the agent restates its own free-text brief into `researchDossierSchema` (`src/ai/prompts/research.schema.ts`: `summary`, `findings[]` with `sourceUrl`, `visualReferences[]`, `openQuestions[]`). This avoids a second hand-rolled parsing chain and keeps the model from inventing sources it never cited.

Failure mode: `scenesNode` wraps the call in try/catch — if the local Chrome isn't reachable, it logs and continues with `researchContext: 'none'` rather than failing the SCENES stage.

---

## 5. Wiring into SCENES (`src/ai/graph/nodes/scenes.node.ts`)

Once per SCENES run, before the per-scene fan-out:

```
goal     = "Ground this episode's scenes in real, source-backed detail before they're turned into generation prompts."
target   = script.logline + every scene's description
baseline = continuity summary + character bible (lockedTraits)
   │
   ▼ runResearchAgent()
ResearchDossier { summary, findings[], visualReferences[], openQuestions[] }
   │
   ▼ formatResearchContext() → one bullet per finding, with source URL
sceneComposePrompt({ ..., researchContext })   // per scene, same dossier reused across all of them
```

`scene-compose.prompt.ts` gained a `researchContext` input; the system prompt instructs the model to ground concrete details (setting, era, objects, wardrobe) in it instead of guessing, when it's not `"none"`.

---

## Acceptance criteria

- [ ] `runResearchAgent` returns a `researchDossierSchema`-shaped object end-to-end against a local Chrome with `--remote-debugging-port` open.
- [ ] `web_search`/`fetch_page`/`fetch_url`/`search_x` are reachable as MCP tools (`npm run mcp:research` starts the stdio server standalone).
- [ ] `web_search` still returns results with Chrome closed and no `BRAVE_SEARCH_API_KEY` — it falls to `duckduckgo-http` and says so in `via`.
- [ ] `search_x` returns an actionable error (sign in, or set `X_BEARER_TOKEN`) when it hits the login wall, never an empty list.
- [ ] Every read path rejects `http://localhost:*` and other private hosts (`src/lib/research-sources.test.ts`).
- [ ] SCENES still completes successfully when no local Chrome is reachable — `researchContext` falls back to `"none"`, no stage failure.
- [ ] The dossier is persisted in `EpisodeStage(SCENES).output.research` for debugging, without a new `StageKind` or graph channel.
- [ ] A stuck research loop is bounded by `recursionLimit`, never a silent hang.
