ALTER TABLE "tasks" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'GENERAL', ADD COLUMN "socialOrder" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "propertyId" INTEGER;
CREATE INDEX "tasks_category_deletedAt_status_socialOrder_idx" ON "tasks"("category", "deletedAt", "status", "socialOrder");
CREATE INDEX "tasks_propertyId_idx" ON "tasks"("propertyId");
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
