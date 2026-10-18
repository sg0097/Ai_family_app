-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('PENDING', 'GRANTED', 'DECLINED', 'REVOKED');

-- CreateEnum
CREATE TYPE "RoutineType" AS ENUM ('MEDICINE', 'WATER', 'BP', 'SUGAR', 'WALK', 'WELLBEING');

-- CreateEnum
CREATE TYPE "OccurrenceStatus" AS ENUM ('SCHEDULED', 'SENT', 'DONE', 'NOT_DONE', 'NO_RESPONSE');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('MEDICINE', 'BP', 'SUGAR', 'WATER', 'WEIGHT', 'WALK', 'WELLBEING', 'SYMPTOM');

-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('BUTTON', 'RULES', 'LLM', 'DASHBOARD');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "emergencyNumber" TEXT NOT NULL DEFAULT '112',
    "consentStatus" "ConsentStatus" NOT NULL DEFAULT 'PENDING',
    "consentAt" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Routine" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "type" "RoutineType" NOT NULL,
    "name" TEXT NOT NULL,
    "timeOfDay" TEXT NOT NULL,
    "daysOfWeek" INTEGER[],
    "target" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Routine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineOccurrence" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "OccurrenceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "sentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "RoutineOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "direction" "Direction" NOT NULL,
    "toPhone" TEXT,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "buttons" JSONB,
    "payload" TEXT,
    "waMessageId" TEXT,
    "handledBy" TEXT,
    "occurrenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthEvent" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "valueNum" DOUBLE PRECISION,
    "valueNum2" DOUBLE PRECISION,
    "valueText" TEXT,
    "unit" TEXT,
    "context" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "source" "EventSource" NOT NULL,
    "messageId" TEXT,
    "occurrenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ParentProfile_phone_key" ON "ParentProfile"("phone");

-- CreateIndex
CREATE INDEX "RoutineOccurrence_parentId_status_idx" ON "RoutineOccurrence"("parentId", "status");

-- CreateIndex
CREATE INDEX "RoutineOccurrence_parentId_localDate_idx" ON "RoutineOccurrence"("parentId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineOccurrence_routineId_localDate_key" ON "RoutineOccurrence"("routineId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "Message_waMessageId_key" ON "Message"("waMessageId");

-- CreateIndex
CREATE INDEX "Message_parentId_createdAt_idx" ON "Message"("parentId", "createdAt");

-- CreateIndex
CREATE INDEX "HealthEvent_parentId_type_occurredAt_idx" ON "HealthEvent"("parentId", "type", "occurredAt");

-- AddForeignKey
ALTER TABLE "ParentProfile" ADD CONSTRAINT "ParentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineOccurrence" ADD CONSTRAINT "RoutineOccurrence_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineOccurrence" ADD CONSTRAINT "RoutineOccurrence_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthEvent" ADD CONSTRAINT "HealthEvent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthEvent" ADD CONSTRAINT "HealthEvent_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthEvent" ADD CONSTRAINT "HealthEvent_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "RoutineOccurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
