ALTER TABLE "tasks" ADD COLUMN "delegatedById" INTEGER;
ALTER TABLE "task_notifications" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'ASSIGNED';
UPDATE "tasks" SET "delegatedById" = "createdById" WHERE "createdById" IS NOT NULL AND "createdById" <> "assigneeId";
CREATE INDEX "tasks_delegatedById_deletedAt_status_idx" ON "tasks"("delegatedById", "deletedAt", "status");
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_delegatedById_fkey" FOREIGN KEY ("delegatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
