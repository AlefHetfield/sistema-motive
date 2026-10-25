import { reconcileNotePage } from './noteSnapshots.js';

export function optimisticNote(note, changes) {
  return { ...note, _optimistic: true, ...(changes.trash ? { deletedAt: new Date().toISOString() } : {}),
    state: { ...note.state, ...('isPinned' in changes ? { isPinned: changes.isPinned } : {}),
      ...('color' in changes ? { color: changes.color } : {}),
      ...('archived' in changes ? { archivedAt: changes.archived ? new Date().toISOString() : null } : {}),
      ...('hidden' in changes ? { hiddenAt: changes.hidden ? new Date().toISOString() : null } : {}),
    } };
}

export function projectNoteQueue(data, entries, operations, criteria, user) {
  let result = data || { notes: [], total: 0, page: 1, pageSize: 40 };
  for (const [id, operation] of operations) {
    const before = result.notes.find(note => note.id === id) || operation.note;
    result = reconcileNotePage(result, before, optimisticNote(before, operation.changes), criteria, user.id);
  }
  for (const entry of entries.filter(record => record.status !== 'synced')) {
    const id = entry.noteId || `pending:${entry.id}`;
    const existing = result.notes.find(note => note.id === id);
    const before = existing || (entry.isNew ? null : entry.remoteNote);
    const note = { ...(entry.remoteNote || {}), ...entry.form, id, kind: entry.kind, ownerId: entry.remoteNote?.ownerId || user.id,
      role: entry.remoteNote?.role || 'OWNER', owner: entry.remoteNote?.owner || { id: user.id, nome: user.nome },
      state: entry.remoteNote?.state || { color: 'default', isPinned: false, version: 1 },
      access: entry.remoteNote?.access || [], labels: entry.remoteNote?.labels || [], version: Math.max(existing?.version || 0, entry.baseVersion || 1),
      updatedAt: new Date(entry.updatedAt).toISOString(), _queueId: entry.id, _syncState: entry.status,
      _newLocal: entry.isNew && !entry.noteId,
    };
    result = reconcileNotePage(result, before, note, criteria, user.id);
  }
  return result;
}
