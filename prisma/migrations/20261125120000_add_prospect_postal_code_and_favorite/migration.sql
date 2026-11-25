ALTER TABLE "property_prospects"
  ADD COLUMN "postalCode" VARCHAR(8),
  ADD COLUMN "isFavorite" BOOLEAN NOT NULL DEFAULT false;
