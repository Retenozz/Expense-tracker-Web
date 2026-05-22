/*
  Warnings:

  - You are about to drop the column `text` on the `Expense` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "text",
ADD COLUMN     "amount" DOUBLE PRECISION,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "merchant" TEXT,
ADD COLUMN     "rawText" TEXT;
