-- Amplia o cadastro de imóveis para o módulo Mapa de Imóveis.
ALTER TABLE "properties"
    ADD COLUMN "code" TEXT,
    ADD COLUMN "city" TEXT,
    ADD COLUMN "neighborhood" TEXT,
    ADD COLUMN "propertyType" TEXT,
    ADD COLUMN "condition" TEXT,
    ADD COLUMN "status" TEXT NOT NULL DEFAULT 'Disponível',
    ADD COLUMN "landArea" DOUBLE PRECISION,
    ADD COLUMN "bedrooms" INTEGER,
    ADD COLUMN "suites" INTEGER,
    ADD COLUMN "bathrooms" INTEGER,
    ADD COLUMN "parkingSpaces" INTEGER,
    ADD COLUMN "sourceUrl" TEXT,
    ADD COLUMN "captador" TEXT,
    ADD COLUMN "lastAvailabilityCheck" TIMESTAMP(3),
    ADD COLUMN "createdById" INTEGER,
    ADD COLUMN "createdByName" TEXT,
    ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "properties_status_idx" ON "properties"("status");
CREATE INDEX "properties_city_idx" ON "properties"("city");
CREATE INDEX "properties_latitude_longitude_idx" ON "properties"("latitude", "longitude");
