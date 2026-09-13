# T02 — Database Schema (Prisma)

> **Status (2026-07-27): DONE.** All models written (`prisma/schema/enums.prisma`, `project.prisma`, `context.prisma`, `episode.prisma`, `asset.prisma`, `apikey.prisma`), `User.projects` back-relation added, `npm run db:format` + `npx prisma validate` + `npm run db:generate` all succeed. Local Postgres runs via `docker-compose.yml` (container `axeleration-ai-postgres`, host port `5436` — chosen because 5432–5435 were already taken by other local projects). Migration `20260727020428_init_video_platform` applied successfully against it. `prisma.config.ts` now `import 'dotenv/config'` at the top — Prisma 7's CLI does not auto-load `.env` the way older Prisma versions did, so without this line `prisma migrate dev` fails with "datasource.url property is required."

Goal: model every entity the platform needs. Modular `.prisma` files per [DATABASE.md](../../blueprint/DATABASE.md).

**Depends on:** T01. **Blocks:** T03, T07, T08.

Rules: no `url` in `datasource` (Prisma 7 — it's in `prisma.config.ts`). Add back-relations to `User` in `user.prisma`. `@@map` snake_case table names. Use `cuid()` ids. Run `npm run db:format` then `npm run db:migrate` after.

---

## Enums (`prisma/schema/enums.prisma`)

```prisma
enum ProjectType     { KIDS_CARTOON  SELF_FACE  REALISTIC  SHORT_FILM }
enum AspectRatio     { R9_16  R16_9  R1_1 }
enum Resolution      { P720  P1080  P4K }
enum EpisodeStatus   { DRAFT  GENERATING  READY_FOR_REVIEW  DONE  FAILED }
enum StageKind       { IDEA  SCRIPT  SCENES  VOICE  MUSIC  RENDER }
enum StageStatus     { PENDING  GENERATING  READY  APPROVED  FAILED }
enum AssetType       { CHARACTER  PERSON  STYLE  LOCATION  MAP  PROP  VOICE }
enum AssetStatus     { ACTIVE  ARCHIVED }
enum Capability      { TEXT_TO_IMAGE  IMAGE_TO_IMAGE  TEXT_TO_VIDEO  IMAGE_TO_VIDEO  TTS  MUSIC  VIDEO_ASSEMBLY  LLM_TEXT }
```

---

## Project (`prisma/schema/project.prisma`)

```prisma
model Project {
  id          String       @id @default(cuid())
  ownerId     String
  owner       User         @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  name        String
  type        ProjectType
  premise     String       @db.Text

  // Video config (per project — see concept doc)
  aspectRatio         AspectRatio @default(R9_16)
  resolution          Resolution  @default(P1080)
  targetTotalSeconds  Int         @default(60)
  sceneDurationMin    Int         @default(4)
  sceneDurationMax    Int         @default(8)

  // Style / model overrides (JSON: negative prompt, style tags, per-capability model overrides)
  styleConfig Json?
  modelConfig Json?

  characterBible  CharacterBible?
  continuity      ContinuityState?
  episodes        Episode[]
  assets          Asset[]
  apiKeys         ApiKey[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([ownerId])
  @@map("projects")
}
```

Add to `user.prisma`: `projects Project[]`.

---

## CharacterBible + ContinuityState (`prisma/schema/context.prisma`)

`CharacterBible` = identity lock. `ContinuityState` = rolling narrative summary. Both 1:1 with Project. Keep bible versionable so a "reset" is auditable.

```prisma
model CharacterBible {
  id            String   @id @default(cuid())
  projectId     String   @unique
  project       Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  version       Int      @default(1)
  lockedTraits  Json     // structured visual identity (hair, outfit, palette, etc.)
  seedImageUrl  String?  // original reference upload (local storage path)
  status        String   @default("ready") // ready | generating | failed

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@map("character_bibles")
}

model ContinuityState {
  id            String   @id @default(cuid())
  projectId     String   @unique
  project       Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  summary       String   @db.Text @default("")   // rolling summary fed to next episode's IDEA stage
  lastEpisodeNo Int      @default(0)
  facts         Json?    // optional structured continuity facts (locations visited, plot flags)

  updatedAt     DateTime @updatedAt
  @@map("continuity_states")
}
```

---

## Episode + EpisodeStage (`prisma/schema/episode.prisma`)

Episode status is a rollup; the real per-stage state lives in `EpisodeStage` (the state machine the Episode Detail page renders).

```prisma
model Episode {
  id          String        @id @default(cuid())
  projectId   String
  project     Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)

  number      Int
  title       String?
  status      EpisodeStatus @default(DRAFT)
  graphThreadId String?     // LangGraph checkpoint thread id (== episodeId is fine)
  finalVideoUrl String?     // local storage path of RENDER output
  totalCost   Decimal?      @db.Decimal(10, 4)

  stages      EpisodeStage[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([projectId, number])
  @@index([projectId])
  @@map("episodes")
}

model EpisodeStage {
  id          String      @id @default(cuid())
  episodeId   String
  episode     Episode     @relation(fields: [episodeId], references: [id], onDelete: Cascade)

  kind        StageKind
  status      StageStatus @default(PENDING)
  attempt     Int         @default(0)     // bumped on Regenerate — for cost/debug
  output      Json?        // stage result: idea text, script JSON, scene refs, audio urls, etc.
  error       String?
  costEstimate Decimal?    @db.Decimal(10, 4)
  providerMeta Json?        // which provider/model ran, latency, tokens

  assets      Asset[]      @relation("StageProducedAssets")

  startedAt   DateTime?
  finishedAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([episodeId, kind])
  @@index([episodeId])
  @@map("episode_stages")
}
```

---

## Asset (`prisma/schema/asset.prisma`)

The `@mention`-able reference. `handle` is unique **per project** and is what the mention parser matches (`@handle`). `refUrl` is the stored reference the resolver ships to providers.

```prisma
model Asset {
  id          String      @id @default(cuid())
  projectId   String
  project     Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)

  type        AssetType
  handle      String                    // e.g. "luna", "rainy-alley" (mentioned as @luna)
  name        String
  description String?     @db.Text       // canonical text injected when the mention is rewritten
  refUrl      String?                    // local storage path — reference image/audio sent to the provider
  voiceId     String?                    // for AssetType.VOICE (e.g. ElevenLabs voice id)
  metadata    Json?
  status      AssetStatus @default(ACTIVE)

  // provenance (nullable: user-uploaded assets have no producing stage)
  producedByStageId String?
  producedByStage   EpisodeStage? @relation("StageProducedAssets", fields: [producedByStageId], references: [id], onDelete: SetNull)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([projectId, handle])
  @@index([projectId, type])
  @@map("assets")
}
```

---

## ApiKey (`prisma/schema/apikey.prisma`)

Per-project provider credentials, **encrypted at rest** via `src/lib/crypto.ts`. Store ciphertext only; never a plaintext column.

```prisma
model ApiKey {
  id           String   @id @default(cuid())
  projectId    String
  project      Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  provider     String   // "fal" | "replicate" | "elevenlabs" | "anthropic" | "openai" | ...
  label        String?
  ciphertext   String   @db.Text     // AES-256-GCM output (iv:tag:data)
  lastFour     String?               // for display only
  isActive     Boolean  @default(true)

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([projectId, provider])
  @@map("api_keys")
}
```

> A global/user-level settings key can also exist; MVP scopes keys to the project since providers are chosen per project. If you prefer user-level keys, move `projectId` → `userId` and relate to `User`. Decide once, note it here.

---

## Migration

```bash
npm run db:format
npm run db:migrate    # name it: init_video_platform
npm run db:generate
```

## Acceptance criteria

- [ ] All models compile; `npm run db:migrate` applies cleanly.
- [ ] Back-relations added to `user.prisma`.
- [ ] `@@unique([projectId, handle])` on Asset and `@@unique([episodeId, kind])` on EpisodeStage exist (mention resolution + stage state machine depend on them).
- [ ] No plaintext secret column anywhere.
