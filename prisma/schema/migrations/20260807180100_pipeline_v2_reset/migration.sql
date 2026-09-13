-- AlterTable
ALTER TABLE "episodes" ADD COLUMN "graphVersion" INTEGER NOT NULL DEFAULT 1;

-- Every episode needs a BREAKDOWN row: `startStage` reads it with `findUniqueOrThrow`, so a stage
-- the graph runs but the episode has no row for is a hard failure, not a missing card. Backfilled
-- for retired episodes too, so the control rail renders eight stages everywhere.
INSERT INTO "episode_stages" ("id", "episodeId", "kind", "status", "attempt", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, e."id", 'BREAKDOWN', 'PENDING', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "episodes" e
WHERE NOT EXISTS (
  SELECT 1 FROM "episode_stages" s WHERE s."episodeId" = e."id" AND s."kind" = 'BREAKDOWN'
);

-- Drop every LangGraph checkpoint written against the v1 graph shape.
--
-- A checkpoint stores each thread's channel values *and* `next` — the node to run on resume. v1
-- parked SCRIPT with `next: ['SCENES']`; under v2 that skips BREAKDOWN entirely and hands SCENES an
-- empty breakdown, which does not throw, it just renders an episode with no scenes. Measured before
-- deciding: 3 episodes, none DONE, 2 scene rows — there was no finished work to migrate, so the
-- threads are dropped rather than backfilled.
--
-- Guarded by to_regclass because these tables are created at runtime by `PostgresSaver.setup()`
-- (src/ai/graph/checkpointer.ts), not by Prisma — on a fresh database they do not exist yet.
DO $$
BEGIN
  IF to_regclass('public.checkpoint_writes') IS NOT NULL THEN DELETE FROM "checkpoint_writes"; END IF;
  IF to_regclass('public.checkpoint_blobs') IS NOT NULL THEN DELETE FROM "checkpoint_blobs"; END IF;
  IF to_regclass('public.checkpoints') IS NOT NULL THEN DELETE FROM "checkpoints"; END IF;
END $$;

-- Retire the episodes those checkpoints belonged to. Only ones that actually started: an episode
-- whose stages are all still PENDING never had a thread, so it is untouched by the rewiring and
-- stays a DRAFT the user can run normally.
UPDATE "episodes" e
SET "status" = 'FAILED',
    "autoPilotStoppedAt" = COALESCE(e."autoPilotStoppedAt", CURRENT_TIMESTAMP),
    "autoPilotStopReason" = COALESCE(
      e."autoPilotStopReason",
      'Retired by the pipeline v2 migration: the SCRIPT stage now feeds BREAKDOWN, and this episode''s saved progress was written against the old wiring. Create a new episode to run the current pipeline.'
    )
WHERE e."status" NOT IN ('DONE', 'FAILED')
  AND EXISTS (
    SELECT 1 FROM "episode_stages" s WHERE s."episodeId" = e."id" AND s."status" <> 'PENDING'
  );
