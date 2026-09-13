# T09 — Frontend (6 pages + components)

> **Status (2026-07-27): Pages built, UI-shell-first against the real T08 data layer.** All 6 routes exist and wire to the real `useProjects`/`useEpisodes`/`useAssets`/`useApiKeys`/`useEpisodeStages` hooks (T08 was already done by a parallel session by the time this ran) — no mock data. **Component library switched from hand-rolled shadcn-style components to HeroUI v3** (`@heroui/react`) per explicit developer request — see [DESIGN_SYSTEM.md](../../blueprint/DESIGN_SYSTEM.md) HeroUI Theme Bridge and [COMPONENTS.md](../../blueprint/COMPONENTS.md). Added `/sign-in` and `/register` pages (not in the original 6) since neither existed and the app was otherwise unreachable. Known gaps: no i18n message extraction yet (pages use plain English strings, not `useTranslations`); new field-wrapper `ui/` components (`TextInputField`, `TextAreaField`, `NumberInputField`, `SelectField`) ship without Storybook stories/tests. Episode Review page (page 4) renders against `useEpisodeStages` polling, but T07's Inngest functions are still an empty array (`src/inngest/functions/index.ts`) as of this writing, so nothing populates stage data yet in a real run.

Goal: build the UI. Server Components by default; `'use client'` only for interactivity. Routing via `@/i18n/navigation`. Colors via design tokens only. Server data via TanStack Query. Components follow the four-file rule ([COMPONENTS.md](../../blueprint/COMPONENTS.md)).

**Depends on:** T08. **Blocks:** nothing.

All routes under `src/app/[locale]/(protected)/` (add an auth-guarded route group; layout calls `requireAuth()`).

---

## 1. Routes → pages

| Route | Page (concept #) | Server/Client |
|---|---|---|
| `/dashboard` | 1 Dashboard | Server (list) + client cards |
| `/projects/new` | 2 New Project | Client (wizard form) |
| `/projects/[id]/edit` | 2 Edit Project | Client (same form, prefilled) |
| `/projects/[id]` | 3 Project Detail | Server (info + episode list) |
| `/projects/[id]/episodes/[epId]` | 4 Episode Review | Client (stage panels + polling) |
| `/projects/[id]/assets` | 5 Asset Library | Server list + client editor |
| `/settings` | 6 Settings | Client (keys, negative prompt, n8n) |

Each page: `generateMetadata()` via `buildMetadata()` + `<StructuredData>` per the New Page checklist. Protected pages can use `noindex` in metadata but still call `buildMetadata()`. Add i18n keys in `messages/en` + `messages/id`.

---

## 2. Components (four-file rule: impl · stories · test · barrel)

Under `src/components/` (feature components in `src/components/features/<area>/`, primitives in `src/components/ui/`).

| Component | Client? | Purpose |
|---|---|---|
| `ProjectCard` | no | Dashboard card: name, type, last thumbnail, episode count, status |
| `NewProjectButton` | yes | CTA → `/projects/new` |
| `ProjectForm` | yes | Name, type (Select), reference upload, premise, **VideoConfig** block; live scene-count warning |
| `VideoConfigFields` | yes | aspectRatio / resolution / targetTotalSeconds / sceneDuration min–max; shows `estimatedScenes` + warning when `<3` |
| `EpisodeTable` | no | number, status badge, date, link to review |
| `GenerateEpisodeButton` | yes | fires `generateEpisodeAction` |
| `StagePanel` | yes | one stage: status, preview (text/image/video/audio), **Approve** / **Regenerate** |
| `StageTimeline` | yes | the 6-stage rail; drives StagePanels; polls via `useEpisodeStages` |
| `AssetMentionInput` | yes | textarea with `@`-autocomplete from `useAssets`; renders mention chips (see T06 §6) |
| `AssetLibraryGrid` | no | reference images / voices / styles per project |
| `AssetEditor` | yes | create/update asset: type, handle (kebab, unique), name, description, ref upload |
| `ProviderModelSelect` | yes | per-project model overrides per capability (from provider registry catalog) |
| `ApiKeyForm` | yes | provider + key (write-only; shows only lastFour) |
| `N8nWebhookForm` | yes | webhook URL + secret |
| `StatusBadge` | no | maps EpisodeStatus/StageStatus → tokened colors |

`StagePanel` preview switch by `stage.kind`: IDEA/SCRIPT → text/JSON view; SCENES → video/image grid; VOICE/MUSIC → `<audio>`; RENDER → `<video>` of `finalVideoUrl`.

---

## 3. Key interactions

- **New Project wizard:** single form (can be one page; step UI via Zustand `useProjectWizardStore` if you split into steps). On submit → `createProjectAction` → redirect to `/projects/[id]` showing "Character bible generating…" (poll bible status).
- **Episode Review:** `StageTimeline` renders `useEpisodeStages(epId)`; while any stage `GENERATING`, poll (3s). Approve → `approveStageAction` (optimistic → invalidate). Regenerate → `regenerateStageAction`. Auto-advance is server-driven (approving resumes the graph); UI just reflects it.
- **Asset Library:** upload writes ref to local storage via `upsertAssetAction`; handle validated unique per project; editing a CHARACTER warns it affects future episodes only.
- **Settings:** keys are write-only inputs; on save show masked `lastFour`. n8n webhook test button optional.

---

## 4. State (Zustand — UI only)

Only for cross-component **UI** state, never server data:
- `useProjectWizardStore` — current step, draft form (if multi-step).
- `useStageReviewStore` — which stage panel is expanded, regenerate-note draft.

Server data (projects, episodes, stages, assets, keys) → TanStack Query exclusively.

---

## Acceptance criteria

- [ ] All six routes render under `(protected)` with `requireAuth()` in the group layout.
- [ ] `ProjectForm` shows a live scene-count estimate and the `<3` warning; blocks submit only on hard Zod errors.
- [ ] `StageTimeline` polls only while a stage is `GENERATING`; Approve/Regenerate call the right actions and update without full reload.
- [ ] `AssetMentionInput` autocompletes `@handles` from the project's assets.
- [ ] Every component has impl + stories + test + barrel; `displayName` set; colors are tokens only.
- [ ] Navigation uses `@/i18n/navigation`; `npm run lint` exits 0.
