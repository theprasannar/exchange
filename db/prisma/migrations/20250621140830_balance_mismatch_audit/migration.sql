-- CreateTable
CREATE TABLE "BalanceMismatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "asset" VARCHAR(12) NOT NULL,
    "ledger" BIGINT NOT NULL,
    "wallet" BIGINT NOT NULL,
    "diff" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceMismatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BalanceMismatch_userId_asset_idx" ON "BalanceMismatch"("userId", "asset");
