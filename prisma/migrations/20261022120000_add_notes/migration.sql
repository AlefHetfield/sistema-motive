-- The notes module is additive; existing client and task annotations are untouched.
CREATE TYPE "public"."NoteKind" AS ENUM ('TEXT', 'CHECKLIST');
CREATE TYPE "public"."NoteAccessRole" AS ENUM ('VIEWER', 'EDITOR');

CREATE TABLE "public"."notes" (
  "id" SERIAL NOT NULL,
  "ownerId" INTEGER NOT NULL,
  "clientMutationId" UUID NOT NULL,
  "title" TEXT NOT NULL DEFAULT '',
  "content" TEXT NOT NULL DEFAULT '',
  "kind" "public"."NoteKind" NOT NULL DEFAULT 'TEXT',
  "items" JSONB NOT NULL DEFAULT '[]',
  "searchText" TEXT NOT NULL DEFAULT '',
  "version" INTEGER NOT NULL DEFAULT 1,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notes_version_check" CHECK ("version" > 0)
);

CREATE TABLE "public"."note_access" (
  "noteId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "role" "public"."NoteAccessRole" NOT NULL DEFAULT 'VIEWER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "note_access_pkey" PRIMARY KEY ("noteId", "userId")
);

CREATE TABLE "public"."note_user_states" (
  "noteId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "color" TEXT NOT NULL DEFAULT 'default',
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "archivedAt" TIMESTAMP(3),
  "hiddenAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "note_user_states_pkey" PRIMARY KEY ("noteId", "userId"),
  CONSTRAINT "note_user_states_color_check" CHECK ("color" IN ('default', 'yellow', 'green', 'blue', 'pink', 'purple')),
  CONSTRAINT "note_user_states_version_check" CHECK ("version" > 0)
);

CREATE TABLE "public"."note_labels" (
  "id" SERIAL NOT NULL,
  "ownerId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "note_labels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."note_label_assignments" (
  "noteId" INTEGER NOT NULL,
  "labelId" INTEGER NOT NULL,
  CONSTRAINT "note_label_assignments_pkey" PRIMARY KEY ("noteId", "labelId")
);

CREATE UNIQUE INDEX "notes_ownerId_clientMutationId_key" ON "public"."notes"("ownerId", "clientMutationId");
CREATE INDEX "notes_ownerId_deletedAt_updatedAt_idx" ON "public"."notes"("ownerId", "deletedAt", "updatedAt");
CREATE INDEX "note_access_userId_noteId_idx" ON "public"."note_access"("userId", "noteId");
CREATE INDEX "note_user_states_userId_archivedAt_hiddenAt_isPinned_idx" ON "public"."note_user_states"("userId", "archivedAt", "hiddenAt", "isPinned");
CREATE UNIQUE INDEX "note_labels_ownerId_normalizedName_key" ON "public"."note_labels"("ownerId", "normalizedName");
CREATE INDEX "note_label_assignments_labelId_noteId_idx" ON "public"."note_label_assignments"("labelId", "noteId");

ALTER TABLE "public"."notes" ADD CONSTRAINT "notes_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."note_access" ADD CONSTRAINT "note_access_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "public"."notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."note_access" ADD CONSTRAINT "note_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."note_user_states" ADD CONSTRAINT "note_user_states_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "public"."notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."note_user_states" ADD CONSTRAINT "note_user_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."note_labels" ADD CONSTRAINT "note_labels_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."note_label_assignments" ADD CONSTRAINT "note_label_assignments_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "public"."notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."note_label_assignments" ADD CONSTRAINT "note_label_assignments_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "public"."note_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
