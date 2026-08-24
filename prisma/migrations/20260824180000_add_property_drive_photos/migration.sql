ALTER TABLE "properties"
    ADD COLUMN "driveFolderUrl" TEXT,
    ADD COLUMN "driveCoverFileId" TEXT;

UPDATE "properties"
SET "driveFolderUrl" = substring(COALESCE("sourceUrl", '') || ' ' || COALESCE("description", '') FROM '(https://drive\.google\.com/drive/folders/[A-Za-z0-9_-]+)')
WHERE COALESCE("sourceUrl", '') || ' ' || COALESCE("description", '') ~ 'https://drive\.google\.com/drive/folders/[A-Za-z0-9_-]+';

CREATE INDEX "properties_driveFolderUrl_idx" ON "properties"("driveFolderUrl");
