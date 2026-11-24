CREATE TYPE "ProspectStage" AS ENUM ('SEARCHING', 'CONTACT_FOUND', 'IN_CONTACT', 'CAPTURED', 'DISCARDED');
CREATE TABLE "property_prospects" (
  "id" SERIAL NOT NULL,
  "street" VARCHAR(180) NOT NULL,
  "number" VARCHAR(40) NOT NULL,
  "complement" VARCHAR(120),
  "neighborhood" VARCHAR(160),
  "city" VARCHAR(120) NOT NULL,
  "state" VARCHAR(2) NOT NULL DEFAULT 'SP',
  "stage" "ProspectStage" NOT NULL DEFAULT 'SEARCHING',
  "registration" VARCHAR(100),
  "ownerName" VARCHAR(160),
  "ownerPhone" VARCHAR(30),
  "notes" VARCHAR(4000),
  "photo" BYTEA,
  "photoUpdatedAt" TIMESTAMP(3),
  "createdById" INTEGER,
  "createdByName" VARCHAR(160) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "property_prospects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "property_prospects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "property_prospects_stage_createdAt_id_idx" ON "property_prospects"("stage", "createdAt" DESC, "id");
CREATE INDEX "property_prospects_city_idx" ON "property_prospects"("city");
