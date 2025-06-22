/*
  Warnings:

  - A unique constraint covering the columns `[market,interval,startTime]` on the table `Kline` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `interval` to the `Kline` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Kline" ADD COLUMN     "interval" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "usdcBalance" SET DEFAULT 1000000000000,
ALTER COLUMN "btcBalance" SET DEFAULT 5000000000;

-- CreateTable
CREATE TABLE "OrderbookSnapshot" (
    "id" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderbookSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AggregatorState" (
    "id" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "lastTime" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AggregatorState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderbookSnapshot_market_key" ON "OrderbookSnapshot"("market");

-- CreateIndex
CREATE UNIQUE INDEX "AggregatorState_market_interval_key" ON "AggregatorState"("market", "interval");

-- CreateIndex
CREATE UNIQUE INDEX "Kline_market_interval_startTime_key" ON "Kline"("market", "interval", "startTime");
