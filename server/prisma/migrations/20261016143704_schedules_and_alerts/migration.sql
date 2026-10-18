-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('DAILY', 'WEEKLY', 'INTERVAL', 'MONTHLY');

-- AlterTable
ALTER TABLE "Routine" ADD COLUMN     "alertAfterMinutes" INTEGER DEFAULT 180,
ADD COLUMN     "dayOfMonth" INTEGER,
ADD COLUMN     "followUpMinutes" INTEGER DEFAULT 60,
ADD COLUMN     "frequency" "Frequency" NOT NULL DEFAULT 'DAILY',
ADD COLUMN     "intervalDays" INTEGER,
ADD COLUMN     "startDate" TEXT;

-- AlterTable
ALTER TABLE "RoutineOccurrence" ADD COLUMN     "childAlertedAt" TIMESTAMP(3),
ADD COLUMN     "followUpAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "whatsappAlerts" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "routineId" TEXT,
    "occurrenceId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "whatsappAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Routines that were limited to certain weekdays become WEEKLY (empty daysOfWeek used to mean every day).
UPDATE "Routine" SET "frequency" = 'WEEKLY' WHERE cardinality("daysOfWeek") > 0;
