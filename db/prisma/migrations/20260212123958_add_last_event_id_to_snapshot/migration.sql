-- AlterTable
ALTER TABLE "public"."OrderbookSnapshot" ADD COLUMN     "lastEventId" TEXT NOT NULL DEFAULT '0-0';

-- CreateTable
CREATE TABLE "public"."PermanentFailure" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "stream" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "error" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermanentFailure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PermanentFailure_eventId_key" ON "public"."PermanentFailure"("eventId");

-- CreateIndex
CREATE INDEX "PermanentFailure_createdAt_idx" ON "public"."PermanentFailure"("createdAt");

-- CreateIndex
CREATE INDEX "PermanentFailure_stream_idx" ON "public"."PermanentFailure"("stream");
