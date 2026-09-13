-- AlterTable
ALTER TABLE "episodes" ADD COLUMN     "autoPilotBudget" DECIMAL(10,4),
ADD COLUMN     "autoPilotStartedAt" TIMESTAMP(3),
ADD COLUMN     "autoPilotStoppedAt" TIMESTAMP(3),
ADD COLUMN     "autoPilotStopReason" TEXT;
