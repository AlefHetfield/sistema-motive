/*
  Warnings:

  - You are about to drop the column `terrenoConstrucao` on the `clients` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."clients" DROP COLUMN "terrenoConstrucao",
ADD COLUMN     "venda" BOOLEAN NOT NULL DEFAULT false;
