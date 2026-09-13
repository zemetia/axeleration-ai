# T08 — Services, Server Actions & API

> **Status (2026-07-27): DONE** (the CRUD/data-access slice — see note below). DTOs/VOs, Zod schemas, `projectService`/`episodeService`/`assetService`/`apiKeyService`/`generationService`, all eight Server Actions, the `episodes/[id]/stages` polling route, and all six TanStack Query hook files are written. `npm run lint`, `type-check`, and `build` all pass.
>
> **Known gap, by design:** T03 (provider registry) and T04/T07 (LangGraph + real Inngest functions) don't exist yet. `createProjectAction`, `generateEpisodeAction`, `approveStageAction`, and `regenerateStageAction` already emit the correct Inngest events (`project/bible.generate`, `episode/generate`, `episode/stage.approve`, `episode/stage.regenerate`) — but `src/inngest/functions/index.ts` is still `[]`, so those events currently land with no handler. This is expected: events are decoupled from handlers by design, so T07 can add the real functions later without touching T08's actions.

Goal: the boundary layer between UI and the AI engine. Follows the repo's DTO → Service → VO pattern ([SERVICES.md](../../blueprint/SERVICES.md)) and auth rules ([DATABASE.md](../../blueprint/DATABASE.md)). Components never touch prisma/providers/MCP — they go through these.

**Depends on:** T02, T03, T07. **Blocks:** T09.

---

## 1. Domain types (DTO + VO) and services

For each domain create `src/types/dtos/<d>.dto.ts`, `src/types/value-objects/<d>.vo.ts`, `src/services/<d>.service.ts` (per the INDEX "New Domain Service" checklist). These services are **server-side data access** (call `prisma` directly — this app fetches internal data straight from services per `docs/tasks/2026-06-11.txt`), returning VOs.

| Service | Key methods |
|---|---|
| `projectService` | `list(ownerId)`, `get(id)`, `create(input)`, `update(id, input)`, `remove(id)` |
| `episodeService` | `listByProject(projectId)`, `get(id)`, `create(projectId)` (next number + 6 PENDING stages), `stages(episodeId)` |
| `assetService` | `list(projectId, type?)`, `byHandles(projectId, handles[])`, `get(projectId, handle)`, `create`, `update`, `archive` |
| `apiKeyService` | `list(projectId)` (masked), `upsert(projectId, provider, plaintext)` → encrypt via `crypto`, `getDecrypted(projectId, provider)` (server-only) |
| `generationService` | `stageOutput(episodeId, kind)`, `cost(episodeId)` — read helpers for the review UI |

VO transform examples: dates → formatted strings, enums → display labels, `ApiKey` → `{ provider, lastFour, isActive }` (never expose ciphertext).

---

## 2. Server Actions (`src/app/[locale]/**/actions.ts`)

Every action: `'use server'`, `requireAuth()` first, Zod-validate input, verify the resource belongs to the caller, then act. Mutations that start generation only **emit an Inngest event** — they never run the graph inline.

| Action | Does | Zod schema |
|---|---|---|
| `createProjectAction` | validate + `projectService.create` + send `project/bible.generate` → redirect to detail | `projectSchema` |
| `updateProjectAction` | validate + update (incl. video config) | `projectSchema.partial()` |
| `generateEpisodeAction` | `episodeService.create` + send `episode/generate` | `{ projectId }` |
| `approveStageAction` | ownership check + send `episode/stage.approve` | `{ episodeId, stage }` |
| `regenerateStageAction` | ownership check + send `episode/stage.regenerate` | `{ episodeId, stage, note? }` |
| `upsertAssetAction` | validate handle (kebab, unique) + save ref to local storage + `assetService.create/update` | `assetSchema` |
| `resetCharacterBibleAction` | new bible version + re-run `project/bible.generate` | `{ projectId }` |
| `saveApiKeyAction` | encrypt + `apiKeyService.upsert` | `apiKeySchema` |

Zod schemas live in `src/lib/validations/` (e.g. `project.ts`, `asset.ts`, `apikey.ts`). `projectSchema` enforces `sceneDurationMin <= sceneDurationMax`, `targetTotalSeconds >= 1`, and computes the scene-count **warning** (`estimatedScenes < 3`) as a non-blocking field the form surfaces.

---

## 3. API Routes (`src/app/api/**`)

Create HTTP endpoints **only** where a Client Component or an external caller needs one (per `docs/tasks/2026-06-11.txt` rule). Server Components read via services directly.

| Route | Why it must be HTTP |
|---|---|
| `api/inngest/route.ts` | Inngest serve endpoint |
| `api/mcp/[server]/route.ts` | MCP over HTTP (only if `MCP_TRANSPORT=http`) — `requireAuth()`, project-scoped |
| `api/webhooks/provider/route.ts` | async provider callbacks (if a vendor is async/webhook-based) — verify signature |
| `api/episodes/[id]/stages/route.ts` | client polling of stage status (see §4) — or use a Server Action; pick one and be consistent |

Do **not** create routes for data a Server Component can fetch directly.

---

## 4. TanStack Query hooks (`src/hooks/queries/`) — client data + polling

Server data in the UI is TanStack Query only (never `useState`). The Episode Detail page polls while a stage is `GENERATING`.

```ts
// src/hooks/queries/useEpisodeStages.ts
export function useEpisodeStages(episodeId: string) {
  return useQuery({
    queryKey: ['episode-stages', episodeId],
    queryFn: () => episodeStagesClient(episodeId),          // hits api/episodes/[id]/stages
    refetchInterval: (q) =>
      q.state.data?.some((s) => s.status === 'GENERATING') ? 3000 : false,
  });
}
```

Mutations (`useMutation`) wrap the Server Actions and `invalidateQueries(['episode-stages', id])` on settle. Provide hooks: `useProjects`, `useProject`, `useEpisodes`, `useEpisodeStages`, `useAssets`, `useApiKeys` + their mutations.

---

## Acceptance criteria

- [x] Every Server Action starts with `requireAuth()` + ownership check + Zod validate.
- [x] Generation actions only emit Inngest events (no inline graph run).
- [x] Services return VOs; `ApiKey` ciphertext never leaves the server.
- [x] Only the justified API route for this task (`episodes/[id]/stages`) exists; the other three (`mcp/[server]`, `webhooks/provider`, and `inngest` itself) belong to T05/T07 and are deliberately not added yet. All other reads go through services in Server Components.
- [x] `useEpisodeStages` polls at 3s while any stage is `GENERATING`, stops otherwise.
- [x] `npm run lint` exits 0.
