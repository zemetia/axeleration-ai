# T05 — MCP Integration

> **Status (2026-07-28): DONE.** `src/mcp/{tools,scope,client,http,index}.ts` + `servers/{asset,context,generation}.server.ts` + `bin/*.ts` written; all 9 tools implemented against the T08 services, the T06 resolver and the T03 registry. 5 tests in `src/mcp/mcp.test.ts` cover: every server listing its tools in-process, `resolve_mention` parity with a direct `assetResolver.resolve` call, generation tools resolving `@mentions` and routing to the registry, `getMcpTools` returning bindable LangChain tools, and the project-scoping guarantee. Verified over real stdio too — `npm run mcp:asset` answers `initialize` + `tools/list` with correct JSON Schema.
>
> **Transport deviation, deliberate:** the in-process path uses `InMemoryTransport` (a linked client/server pair), not a spawned `node dist/mcp/asset.js` as the sketch in §4 suggested. Same MCP protocol, no child process, and no separate build step — the sketch's `dist/` path doesn't exist under Next's build. External clients still get real stdio via `npm run mcp:asset|mcp:context|mcp:generation`.
>
> **HTTP transport is intentionally minimal:** `src/app/api/mcp/[server]/route.ts` is stateless JSON-RPC over POST (one fresh server per request, JSON replies only — no SSE stream, no sessions). It is disabled unless `MCP_TRANSPORT=http`, requires a session, and rejects any `tools/call` whose `projectId` the caller does not own. `GET` is not implemented.
>
> **T04 nodes were not rewired to call these tools.** The pipeline stays deterministic: nodes read the bible/continuity straight from `contextService` and generate straight through `providerRegistry`, which is the same data by a shorter path. MCP is the *opt-in* agentic surface plus the external integration point, exactly as §1 frames it. Wiring a node to `bindTools(...)` means adding a tool-calling loop to that node — do it when a stage actually needs the model to choose, not before.

Goal: expose the platform's tools/data through **Model Context Protocol** servers, and load those tools into LangChain so a graph node's LLM can call them. Also makes the same tools reusable by external MCP clients (e.g. Claude Desktop connecting to inspect a project).

**Depends on:** T02, T03, T06 (resolver used by the asset server). **Blocks:** nothing hard — chains work without MCP, but T04 nodes prefer these tools for context.

Lives in `src/mcp/`.

---

## 1. Why MCP here (and the boundary vs LangChain)

- **LangChain/LangGraph** decides *control flow* (which stage, when to pause).
- **MCP** is the *capability surface* the LLM calls **inside** a node: look up an asset, read the character bible, read continuity, or (optionally) trigger a generation. Standardized + versioned + externally connectable.
- Layer 3 (provider registry, T03) stays the deterministic path the pipeline calls directly; the generation MCP server is a thin wrapper so a node can be *agentic* when we want the model to choose.

---

## 2. Tool schemas (`src/mcp/tools.ts`)

Define each tool's input/output with Zod (shared by server impl + type inference).

| Tool | Input | Output | Backed by |
|---|---|---|---|
| `list_assets` | `{ projectId, type? }` | `Asset[]` (handle, name, type, description) | assetService (T08) |
| `get_asset` | `{ projectId, handle }` | `Asset` incl. `refUrl` | assetService |
| `resolve_mention` | `{ projectId, text }` | `{ rewritten, refs: AssetRef[] }` | asset resolver (T06) |
| `get_character_bible` | `{ projectId }` | `{ lockedTraits, seedImageUrl }` | prisma |
| `get_continuity_state` | `{ projectId }` | `{ summary, lastEpisodeNo }` | prisma |
| `generate_image` | `ProviderRequest` subset | `ProviderResult` | providerRegistry.run (T03) |
| `generate_video` | `ProviderRequest` subset | `ProviderResult` | providerRegistry.run |
| `generate_voice` | `{ text, voiceId }` | `ProviderResult` | providerRegistry.run |
| `generate_music` | `{ brief, durationSeconds }` | `ProviderResult` | providerRegistry.run |

All tools require `projectId` and run **server-side with the project's decrypted keys** — the LLM never sees credentials.

---

## 3. Servers (`src/mcp/servers/`)

Three MCP servers built with `@modelcontextprotocol/sdk`. Group by concern so external clients can mount only what they need.

| File | Server | Tools |
|---|---|---|
| `asset.server.ts` | `asset` | `list_assets`, `get_asset`, `resolve_mention` |
| `context.server.ts` | `context` | `get_character_bible`, `get_continuity_state` |
| `generation.server.ts` | `generation` | `generate_image`, `generate_video`, `generate_voice`, `generate_music` |

Server skeleton:

```ts
// src/mcp/servers/asset.server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function buildAssetServer() {
  const server = new McpServer({ name: 'asset', version: '1.0.0' });
  server.tool('resolve_mention',
    { projectId: z.string(), text: z.string() },
    async ({ projectId, text }) => {
      const { rewritten, refs } = await assetResolver.resolve(projectId, text);
      return { content: [{ type: 'text', text: JSON.stringify({ rewritten, refs }) }] };
    });
  // list_assets, get_asset …
  return server;
}
```

**Transport:** default `stdio`, spawned in-process from the Node/Inngest worker (fast, no network). Set `MCP_TRANSPORT=http` to serve over Streamable HTTP at `src/app/api/mcp/[server]/route.ts` for external clients. Guard the HTTP route with `requireAuth()` and scope every call to the caller's `projectId`.

---

## 4. Client + LangChain bridge (`src/mcp/client.ts`)

Load MCP tools as LangChain tools with `@langchain/mcp-adapters`, then bind them to the model used in a node.

```ts
// src/mcp/client.ts
import { MultiServerMCPClient } from '@langchain/mcp-adapters';

export async function getMcpTools(scope: { projectId: string }) {
  const client = new MultiServerMCPClient({
    asset:      { transport: 'stdio', command: 'node', args: ['dist/mcp/asset.js'] },
    context:    { transport: 'stdio', command: 'node', args: ['dist/mcp/context.js'] },
    generation: { transport: 'stdio', command: 'node', args: ['dist/mcp/generation.js'] },
  });
  const tools = await client.getTools();            // LangChain StructuredTool[]
  return bindProjectScope(tools, scope);            // inject projectId so the LLM can't cross projects
}
```

Usage inside a node (T04):

```ts
const tools = await getMcpTools({ projectId });
const model = getChatModel('scene-compose', project).bindTools(tools);
// the model may call resolve_mention / get_character_bible while composing the scene prompt
```

> Security: `bindProjectScope` fixes `projectId` on every tool call so a prompt-injected instruction can't read another project's assets. Tools that mutate/generate are **not** auto-executed from untrusted text without the pipeline's control — generation tools are only reachable inside pipeline nodes, not from user-facing chat.

---

## Acceptance criteria

- [ ] Three MCP servers start over stdio and list their tools.
- [ ] `resolve_mention` returns the same result as calling the resolver directly (T06 parity test).
- [ ] `getMcpTools` returns LangChain tools; a node can bind and call `get_character_bible` end-to-end.
- [ ] Every tool call is project-scoped; a tool cannot read data outside its bound `projectId`.
- [ ] HTTP transport (when enabled) is behind `requireAuth()`.
