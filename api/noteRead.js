// Read the presentation in one database round trip. All values are bound
// parameters; access remains scoped to the caller, including trashed notes.
export async function readNoteSnapshot(tx, noteId, userId) {
  const notes = await tx.$queryRaw`
    SELECT n."id", n."ownerId", n."title", n."content", n."kind"::text AS "kind",
      n."items", n."version", n."deletedAt", n."createdAt", n."updatedAt",
      jsonb_build_object('id', owner."id", 'nome', owner."nome") AS "owner",
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'userId', a."userId", 'role', a."role"::text,
          'user', jsonb_build_object('id', u."id", 'nome', u."nome", 'isActive', u."isActive")
        ) ORDER BY a."userId")
        FROM "public"."note_access" a JOIN "public"."users" u ON u."id" = a."userId"
        WHERE a."noteId" = n."id"
      ), '[]'::jsonb) AS "access",
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'version', s."version", 'color', s."color", 'isPinned', s."isPinned",
          'archivedAt', to_char(s."archivedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'hiddenAt', to_char(s."hiddenAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        )) FROM "public"."note_user_states" s
        WHERE s."noteId" = n."id" AND s."userId" = ${userId}
      ), '[]'::jsonb) AS "states",
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object('label', jsonb_build_object('id', l."id", 'name', l."name")) ORDER BY l."id")
        FROM "public"."note_label_assignments" assignment
        JOIN "public"."note_labels" l ON l."id" = assignment."labelId"
        WHERE assignment."noteId" = n."id" AND l."ownerId" = ${userId}
      ), '[]'::jsonb) AS "labelAssignments"
    FROM "public"."notes" n JOIN "public"."users" owner ON owner."id" = n."ownerId"
    WHERE n."id" = ${noteId} AND (
      n."ownerId" = ${userId} OR (n."deletedAt" IS NULL AND EXISTS (
        SELECT 1 FROM "public"."note_access" allowed
        WHERE allowed."noteId" = n."id" AND allowed."userId" = ${userId}
      ))
    )
  `;
  return notes[0] || null;
}
