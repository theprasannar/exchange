/*
  Warnings:

  - A unique constraint covering the columns `[eventId]` on the table `BalanceMismatch` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[eventId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[eventId]` on the table `OrderbookSnapshot` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[eventId]` on the table `Trade` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `eventId` to the `BalanceMismatch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `eventId` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `eventId` to the `OrderbookSnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `eventId` to the `Trade` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BalanceMismatch" ADD COLUMN     "eventId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "eventId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "OrderbookSnapshot" ADD COLUMN     "eventId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "eventId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "BalanceMismatch_eventId_key" ON "BalanceMismatch"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_eventId_key" ON "Order"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderbookSnapshot_eventId_key" ON "OrderbookSnapshot"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_eventId_key" ON "Trade"("eventId");
