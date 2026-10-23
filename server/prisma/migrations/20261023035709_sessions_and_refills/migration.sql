-- AlterTable
ALTER TABLE "Medicine" ADD COLUMN     "refilledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;
