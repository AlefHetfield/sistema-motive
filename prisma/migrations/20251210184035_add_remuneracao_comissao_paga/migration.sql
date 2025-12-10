-- AlterTable
ALTER TABLE "public"."clients" ADD COLUMN     "comissaoPaga" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "remuneracaoPaga" BOOLEAN NOT NULL DEFAULT false;
