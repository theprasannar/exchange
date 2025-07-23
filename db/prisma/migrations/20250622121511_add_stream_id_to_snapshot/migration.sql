/*
  Warnings:

  - You are about to drop the column `snapshot` on the `OrderbookSnapshot` table. All the data in the column will be lost.
  - Added the required column `streamId` to the `OrderbookSnapshot` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OrderbookSnapshot" DROP COLUMN "snapshot",
ADD COLUMN     "streamId" TEXT NOT NULL;
