import { noteContentText } from './noteContent.js';

// Content/access and personal organization have independent version counters.
export function mergeNoteSnapshot(current, incoming) {
  if (!current || current.id !== incoming.id) return incoming;
  const content = incoming.version >= current.version ? incoming : current;
  const organization = (incoming.state?.version || 0) >= (current.state?.version || 0) ? incoming : current;
  return { ...content, state: organization.state, labels: organization.labels };
}

const normalized = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();

export function matchesNoteView(note, { view = 'active', scope = 'all', search = '', color = '', labelId = '' }, userId) {
  if (!note) return false;
  if (view === 'trash') {
    if (!note.deletedAt || note.ownerId !== userId) return false;
  } else {
    if (note.deletedAt) return false;
    if (view === 'active' && (note.state?.archivedAt || note.state?.hiddenAt)) return false;
    if (view === 'archived' && (!note.state?.archivedAt || note.state?.hiddenAt)) return false;
    if (view === 'hidden' && !note.state?.hiddenAt) return false;
    if (scope === 'mine' && note.ownerId !== userId) return false;
    if (scope === 'shared' && note.ownerId === userId) return false;
  }
  if (color && note.state?.color !== color) return false;
  if (labelId && !note.labels?.some(label => String(label.id) === String(labelId))) return false;
  const query = normalized(search);
  return !query || normalized([note.title, noteContentText(note.content), ...(note.items || []).map(item => item.text)].join('\n')).includes(query);
}

export function reconcileNotePage(page, previous, incoming, criteria, userId) {
  if (!page) return page;
  const id = incoming?.id || previous?.id;
  const existing = page.notes.find(note => note.id === id);
  const next = incoming ? mergeNoteSnapshot(existing || previous, incoming) : null;
  const wasIncluded = Boolean(existing) || matchesNoteView(previous, criteria, userId);
  const included = matchesNoteView(next, criteria, userId);
  const total = Math.max(0, page.total + Number(included) - Number(wasIncluded));
  let notes = page.notes.filter(note => note.id !== id);
  // Unknown entries belong at the start of page one; later pages reconcile
  // from the server rather than inserting a first-page entry at a wrong rank.
  if (included && (existing || page.page === 1)) notes.push(next);
  notes.sort((a, b) => (criteria.view === 'active' ? Number(Boolean(b.state?.isPinned)) - Number(Boolean(a.state?.isPinned)) : 0)
    || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() || b.id - a.id);
  return { ...page, total, notes: notes.slice(0, page.pageSize), needsRefresh: page.total > page.pageSize || page.page > 1 };
}
