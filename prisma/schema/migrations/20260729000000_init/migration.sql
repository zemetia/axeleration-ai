-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('EPISODIC', 'NON_CONTINUOUS');

-- CreateEnum
CREATE TYPE "AspectRatio" AS ENUM ('R9_16', 'R16_9', 'R1_1');

-- CreateEnum
CREATE TYPE "Resolution" AS ENUM ('P720', 'P1080', 'P4K');

-- CreateEnum
CREATE TYPE "EpisodeStatus" AS ENUM ('DRAFT', 'GENERATING', 'READY_FOR_REVIEW', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "StageKind" AS ENUM ('RESEARCH', 'IDEA', 'SCRIPT', 'SCENES', 'VOICE', 'MUSIC', 'RENDER');

-- CreateEnum
CREATE TYPE "ResearchMode" AS ENUM ('HUMAN', 'AI_REASONING', 'AI_CDP', 'SKIP');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('PENDING', 'GENERATING', 'READY', 'APPROVED', 'FAILED');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('CHARACTER', 'PERSON', 'STYLE', 'LOCATION', 'MAP', 'PROP', 'VOICE');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Capability" AS ENUM ('TEXT_TO_IMAGE', 'IMAGE_TO_IMAGE', 'TEXT_TO_VIDEO', 'IMAGE_TO_VIDEO', 'TTS', 'MUSIC', 'VIDEO_ASSEMBLY', 'LLM_TEXT');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT,
    "ciphertext" TEXT NOT NULL,
    "lastFour" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "handle" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "refUrl" TEXT,
    "voiceId" TEXT,
    "metadata" JSONB,
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "producedByStageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "sessions" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "character_bibles" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lockedTraits" JSONB NOT NULL,
    "seedImageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "character_bibles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "continuity_states" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "lastEpisodeNo" INTEGER NOT NULL DEFAULT 0,
    "facts" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "continuity_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "episodes" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT,
    "status" "EpisodeStatus" NOT NULL DEFAULT 'DRAFT',
    "graphThreadId" TEXT,
    "finalVideoUrl" TEXT,
    "totalCost" DECIMAL(10,4),
    "researchMode" "ResearchMode" NOT NULL DEFAULT 'AI_CDP',
    "researchNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "episode_stages" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "kind" "StageKind" NOT NULL,
    "status" "StageStatus" NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "output" JSONB,
    "error" TEXT,
    "costEstimate" DECIMAL(10,4),
    "providerMeta" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "episode_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenes" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "status" "StageStatus" NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "prompt" TEXT,
    "videoUrl" TEXT,
    "error" TEXT,
    "costEstimate" DECIMAL(10,4),
    "providerMeta" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProjectType" NOT NULL,
    "premise" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "logline" TEXT,
    "targetAudience" TEXT,
    "tone" TEXT,
    "visualStyle" TEXT,
    "language" TEXT NOT NULL DEFAULT 'English',
    "aspectRatio" "AspectRatio" NOT NULL DEFAULT 'R9_16',
    "resolution" "Resolution" NOT NULL DEFAULT 'P1080',
    "targetTotalSeconds" INTEGER NOT NULL DEFAULT 60,
    "sceneDurationMin" INTEGER NOT NULL DEFAULT 4,
    "sceneDurationMax" INTEGER NOT NULL DEFAULT 8,
    "styleConfig" JSONB,
    "modelConfig" JSONB,
    "defaultResearchMode" "ResearchMode" NOT NULL DEFAULT 'AI_CDP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_projectId_provider_key" ON "api_keys"("projectId", "provider");

-- CreateIndex
CREATE INDEX "assets_projectId_type_idx" ON "assets"("projectId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "assets_projectId_handle_key" ON "assets"("projectId", "handle");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "character_bibles_projectId_key" ON "character_bibles"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "continuity_states_projectId_key" ON "continuity_states"("projectId");

-- CreateIndex
CREATE INDEX "episodes_projectId_idx" ON "episodes"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "episodes_projectId_number_key" ON "episodes"("projectId", "number");

-- CreateIndex
CREATE INDEX "episode_stages_episodeId_idx" ON "episode_stages"("episodeId");

-- CreateIndex
CREATE UNIQUE INDEX "episode_stages_episodeId_kind_key" ON "episode_stages"("episodeId", "kind");

-- CreateIndex
CREATE INDEX "scenes_episodeId_idx" ON "scenes"("episodeId");

-- CreateIndex
CREATE UNIQUE INDEX "scenes_episodeId_index_key" ON "scenes"("episodeId", "index");

-- CreateIndex
CREATE INDEX "projects_ownerId_idx" ON "projects"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_producedByStageId_fkey" FOREIGN KEY ("producedByStageId") REFERENCES "episode_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_bibles" ADD CONSTRAINT "character_bibles_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "continuity_states" ADD CONSTRAINT "continuity_states_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episode_stages" ADD CONSTRAINT "episode_stages_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
