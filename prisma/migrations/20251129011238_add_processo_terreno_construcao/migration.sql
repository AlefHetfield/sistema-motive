-- AlterTable
ALTER TABLE "public"."clients" ADD COLUMN     "processo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "terrenoConstrucao" BOOLEAN NOT NULL DEFAULT false;
