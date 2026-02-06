/*
  Warnings:

  - You are about to drop the column `processo` on the `clients` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."clients" DROP COLUMN "processo",
ADD COLUMN     "valorFinanciado" DECIMAL(15,2);
