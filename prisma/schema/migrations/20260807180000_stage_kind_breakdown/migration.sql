-- AlterEnum
-- Placed BEFORE 'SCENES' so the Postgres enum reads in pipeline order. Nothing sorts by this
-- ordering (STAGE_ORDER in src/config/pipeline.ts is the authority), but a psql session showing the
-- type out of order is a standing invitation to misread the pipeline.
--
-- Alone in its own migration on purpose: `ALTER TYPE ... ADD VALUE` may not be followed by
-- statements that *use* the new value inside the same transaction, and the next migration inserts
-- BREAKDOWN rows.
ALTER TYPE "StageKind" ADD VALUE 'BREAKDOWN' BEFORE 'SCENES';
