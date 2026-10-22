import { noteContentText } from './noteContent.js';
const PREFIX = 'motive.note-draft.v1.';
const USER_KEY = 'motive.note-draft-user';
const TTL = 30 * 60 * 1000;

export function noteDraftKey(userId, noteId, kind = 'TEXT') {
  return `${PREFIX}${userId}.${noteId || `new-${kind}`}`;
}

export function normalizeNoteForm(value = {}) {
  return {
    title: String(value.title || '').trim(),
    content: String(value.content || ''),
    items: (value.items || []).filter(item => item.text?.trim()).map(item => ({
      id: item.id, text: item.text.trim(), checked: Boolean(item.checked),
    })),
  };
}

export const noteFormSignature = value => JSON.stringify(normalizeNoteForm(value));
export const hasNoteContent = value => {
  const form = normalizeNoteForm(value);
  return Boolean(form.title || noteContentText(form.content).trim() || form.items.length);
};

export function clearNoteDrafts() {
  try {
    for (const key of Object.keys(sessionStorage)) if (key.startsWith(PREFIX)) sessionStorage.removeItem(key);
    sessionStorage.removeItem(USER_KEY);
  } catch { /* A API continua sendo a fonte principal quando o armazenamento está indisponível. */ }
}

export function prepareNoteDraftUser(userId) {
  try {
    if (sessionStorage.getItem(USER_KEY) !== String(userId)) clearNoteDrafts();
    sessionStorage.setItem(USER_KEY, String(userId));
    for (const key of Object.keys(sessionStorage)) {
      if (!key.startsWith(PREFIX)) continue;
      try {
        const draft = JSON.parse(sessionStorage.getItem(key));
        if (draft.userId !== userId || !Number.isFinite(draft.savedAt) || Date.now() - draft.savedAt > TTL) sessionStorage.removeItem(key);
      } catch { sessionStorage.removeItem(key); }
    }
  } catch { /* Navegação privada pode bloquear sessionStorage. */ }
}

export function readNoteDraft(key, userId) {
  try {
    const draft = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (!draft || draft.userId !== userId || !Number.isFinite(draft.savedAt) || Date.now() - draft.savedAt > TTL || !draft.form || typeof draft.form.title !== 'string' || typeof draft.form.content !== 'string' || !Array.isArray(draft.form.items) || draft.form.items.some(item => !item || typeof item.id !== 'string' || typeof item.text !== 'string' || typeof item.checked !== 'boolean')) {
      sessionStorage.removeItem(key);
      return null;
    }
    return draft;
  } catch { return null; }
}

export function listNoteDrafts(userId) {
  try {
    return Object.keys(sessionStorage).filter(key => key.startsWith(`${PREFIX}${userId}.`))
      .map(key => { const draft = readNoteDraft(key, userId); return draft && { ...draft, key }; })
      .filter(Boolean).sort((a, b) => b.savedAt - a.savedAt);
  } catch { return []; }
}

export function writeNoteDraft(key, draft) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ ...draft, savedAt: Date.now() }));
    return true;
  } catch { return false; }
}

export function removeNoteDraft(key) {
  try { sessionStorage.removeItem(key); } catch { /* O rascunho já pode estar indisponível. */ }
}
