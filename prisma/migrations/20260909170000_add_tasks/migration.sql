-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "canManageAllTasks" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."task_lists" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tasks" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "important" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" DATE,
    "myDay" DATE,
    "assigneeId" INTEGER NOT NULL,
    "createdById" INTEGER,
    "clientId" INTEGER,
    "listId" INTEGER,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_lists_ownerId_idx" ON "public"."task_lists"("ownerId");

-- CreateIndex
CREATE INDEX "tasks_assigneeId_deletedAt_status_idx" ON "public"."tasks"("assigneeId", "deletedAt", "status");

-- CreateIndex
CREATE INDEX "tasks_clientId_idx" ON "public"."tasks"("clientId");

-- CreateIndex
CREATE INDEX "tasks_listId_idx" ON "public"."tasks"("listId");

-- CreateIndex
CREATE INDEX "tasks_dueDate_idx" ON "public"."tasks"("dueDate");

-- AddForeignKey
ALTER TABLE "public"."task_lists" ADD CONSTRAINT "task_lists_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_listId_fkey" FOREIGN KEY ("listId") REFERENCES "public"."task_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
