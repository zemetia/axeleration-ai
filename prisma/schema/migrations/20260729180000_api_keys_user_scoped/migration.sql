-- Move API keys from project scope to user scope.
--
-- Keys belong to the person, not to one project: the global /settings page lists them all, and a
-- project picks which one to use per capability via `Project.modelConfig[capability].apiKeyId`.
--
-- Written by hand rather than taken from `prisma migrate diff`, which emits a bare
-- `DROP COLUMN "projectId"` + `ADD COLUMN "userId" TEXT NOT NULL`. That fails outright on a table
-- that already has rows (NOT NULL with no default) and throws the existing keys away. Here the
-- owner is backfilled through `projects` first, so keys saved before this migration survive it.

-- AlterTable: nullable first so existing rows can be backfilled.
ALTER TABLE "api_keys" ADD COLUMN "userId" TEXT;

UPDATE "api_keys" AS k
SET "userId" = p."ownerId"
FROM "projects" AS p
WHERE p."id" = k."projectId";

-- A key whose project is already gone has no owner to inherit; it is unusable either way.
DELETE FROM "api_keys" WHERE "userId" IS NULL;

ALTER TABLE "api_keys" ALTER COLUMN "userId" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_projectId_fkey";

-- DropIndex: the old UNIQUE ("projectId", "provider") has no user-scoped equivalent on purpose —
-- several keys per provider are allowed now, and projects choose between them.
DROP INDEX "api_keys_projectId_provider_key";

-- AlterTable
ALTER TABLE "api_keys" DROP COLUMN "projectId";

-- CreateIndex
CREATE INDEX "api_keys_userId_provider_idx" ON "api_keys"("userId", "provider");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
