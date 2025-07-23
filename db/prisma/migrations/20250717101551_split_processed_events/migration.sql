-- CreateTable
CREATE TABLE "EngineProcessedEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngineProcessedEvent_pkey" PRIMARY KEY ("id")
);
