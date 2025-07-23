/*
  Warnings:

  - You are about to drop the column `diff` on the `BalanceMismatch` table. All the data in the column will be lost.
  - You are about to drop the column `ledger` on the `BalanceMismatch` table. All the data in the column will be lost.
  - You are about to drop the column `wallet` on the `BalanceMismatch` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `OrderbookSnapshot` table. All the data in the column will be lost.
  - Added the required column `diffAvail` to the `BalanceMismatch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `diffLocked` to the `BalanceMismatch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ledgerAvail` to the `BalanceMismatch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ledgerLocked` to the `BalanceMismatch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `walletAvail` to the `BalanceMismatch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `walletLocked` to the `BalanceMismatch` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "OrderbookSnapshot_market_key";

-- AlterTable
ALTER TABLE "BalanceMismatch" DROP COLUMN "diff",
DROP COLUMN "ledger",
DROP COLUMN "wallet",
ADD COLUMN     "diffAvail" BIGINT NOT NULL,
ADD COLUMN     "diffLocked" BIGINT NOT NULL,
ADD COLUMN     "ledgerAvail" BIGINT NOT NULL,
ADD COLUMN     "ledgerLocked" BIGINT NOT NULL,
ADD COLUMN     "walletAvail" BIGINT NOT NULL,
ADD COLUMN     "walletLocked" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "OrderbookSnapshot" DROP COLUMN "updatedAt";

-- CreateIndex
CREATE INDEX "OrderbookSnapshot_market_createdAt_idx" ON "OrderbookSnapshot"("market", "createdAt");
