CREATE TABLE "task_notifications" (
    "id" SERIAL NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "taskId" INTEGER NOT NULL,
    "actorName" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "task_notifications_recipientId_id_idx" ON "task_notifications"("recipientId", "id");
CREATE INDEX "task_notifications_recipientId_readAt_idx" ON "task_notifications"("recipientId", "readAt");
CREATE INDEX "task_notifications_taskId_idx" ON "task_notifications"("taskId");
ALTER TABLE "task_notifications" ADD CONSTRAINT "task_notifications_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_notifications" ADD CONSTRAINT "task_notifications_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
