-- AlterTable
ALTER TABLE "public"."clients"
ADD COLUMN "emEspera" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "motivoEspera" TEXT,
ADD COLUMN "observacaoEspera" TEXT,
ADD COLUMN "dataRetomada" DATE,
ADD COLUMN "pausadoEm" TIMESTAMP(3),
ADD COLUMN "pausadoPor" TEXT;
