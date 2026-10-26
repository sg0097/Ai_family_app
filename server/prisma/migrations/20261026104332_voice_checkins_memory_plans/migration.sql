-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'FAMILY');

-- CreateEnum
CREATE TYPE "MemoryStatus" AS ENUM ('SUGGESTED', 'KEPT', 'DISMISSED');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "voiceClipId" TEXT;

-- AlterTable
ALTER TABLE "Routine" ADD COLUMN     "voiceClipId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "middaySummary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "plan" "Plan" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "planRenewsAt" TIMESTAMP(3),
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "VoiceClip" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "seconds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceClip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "voiceClipId" TEXT,
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Memory" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "status" "MemoryStatus" NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Memory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CheckIn_parentId_createdAt_idx" ON "CheckIn"("parentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Memory_parentId_key_key" ON "Memory"("parentId", "key");

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_voiceClipId_fkey" FOREIGN KEY ("voiceClipId") REFERENCES "VoiceClip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceClip" ADD CONSTRAINT "VoiceClip_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceClip" ADD CONSTRAINT "VoiceClip_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_voiceClipId_fkey" FOREIGN KEY ("voiceClipId") REFERENCES "VoiceClip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Everyone already here gets the same 14-day Family plan trial new sign-ups get.
UPDATE "User" SET "trialEndsAt" = NOW() + INTERVAL '14 days' WHERE "trialEndsAt" IS NULL;
