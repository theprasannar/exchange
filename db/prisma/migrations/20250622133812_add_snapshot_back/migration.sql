/*
  Warnings:

  - Added the required column `snapshot` to the `OrderbookSnapshot` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OrderbookSnapshot" ADD COLUMN     "snapshot" JSONB NOT NULL;
