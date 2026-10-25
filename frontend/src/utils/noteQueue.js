import { normalizeNoteForm, noteFormSignature, hasNoteContent } from './noteDrafts.js';
import { mergeNoteSnapshot } from './noteSnapshots.js';

const failure = (message, code) => Object.assign(new Error(message), { code });
const formOf = note => normalizeNoteForm(note || {});
const waiting = entry => ['pending', 'sending', 'retry'].includes(entry.status);

export function createNoteQueue({ store, request, withLock, auto = true, now = Date.now, changed = () => {} }) {
  let userId = null, lastOwner = null, epoch = 0, paused = false, running = false, timer = null, controller, contendedUntil = 0;
  let snapshot = { userId: null, entries: [], ready: false, error: '' };
  const listeners = new Set(), editors = new Set();
  const observed = new Set();
  const emit = value => { snapshot = value; for (const notify of listeners) notify(); };
  const current = () => userId && !paused;
  const schedule = () => {
    clearTimeout(timer);
    if (!auto || !current() || running || globalThis.navigator?.onLine === false) return;
    const due = snapshot.entries.filter(waiting).map(entry => entry.nextAttemptAt || entry.updatedAt + 700);
    if (due.length) timer = setTimeout(() => { void api.run().catch(error => emit({ ...snapshot, error: error.message })); }, Math.max(0, Math.min(...due) - now(), contendedUntil - now()));
  };
  const refresh = async () => {
    const readingUser = userId, readingEpoch = epoch;
    if (!readingUser) return;
    const stored = await store.list(readingUser);
    if (readingEpoch !== epoch) return;
    for (const entry of stored) if (entry.status !== 'synced') observed.add(entry.id);
    const entries = stored.filter(entry => entry.status !== 'synced' || observed.has(entry.id));
    emit({ userId: readingUser, entries: entries.sort((a, b) => a.updatedAt - b.updatedAt), ready: true, error: '' });
    schedule();
  };
  const update = async (id, owner, change) => {
    const result = await store.update(id, owner, change);
    await refresh(); changed(owner);
    return result;
  };
  const acknowledge = (id, owner, sent, remote) => update(id, owner, entry => {
    if (!entry || entry.attempt?.id !== sent.id) return entry;
    const merged = mergeNoteSnapshot(entry.remoteNote, remote);
    return { ...entry, noteId: remote.id, baseVersion: remote.version, baseForm: formOf(remote), remoteNote: merged,
      attempt: null, failures: 0, error: '', conflict: null, nextAttemptAt: 0,
      status: noteFormSignature(entry.form) === noteFormSignature(remote) ? 'synced' : 'pending', syncedAt: now() };
  });
  const send = async entry => {
    const sendingUser = userId, sendingEpoch = epoch;
    if (!current() || entry.userId !== sendingUser) return;
    if (!hasNoteContent(entry.form)) {
      await update(entry.id, sendingUser, record => record && ({ ...record, status: 'blocked', blockedStatus: 400, error: 'Preencha o título, o texto ou um item antes de sincronizar.' }));
      return;
    }
    const sent = entry.attempt || { id: crypto.randomUUID(), noteId: entry.noteId, snapshot: formOf(entry.form), version: entry.baseVersion };
    const marked = await update(entry.id, sendingUser, currentEntry => {
      if (!currentEntry || !waiting(currentEntry)) return currentEntry;
      // If edits changed before the transaction started, take their latest durable snapshot.
      const attempt = currentEntry.attempt || { ...sent, snapshot: formOf(currentEntry.form), version: currentEntry.baseVersion, noteId: currentEntry.noteId };
      return { ...currentEntry, attempt, status: 'sending', error: '' };
    });
    if (!marked || marked.status !== 'sending' || sendingEpoch !== epoch) return;
    const attempt = marked.attempt;
    controller = new AbortController();
    const options = { expectedUserId: sendingUser, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) };
    try {
      const remote = await request(attempt.noteId ? `/${attempt.noteId}` : '', { ...options,
        method: attempt.noteId ? 'PATCH' : 'POST',
        body: attempt.noteId ? { ...attempt.snapshot, version: attempt.version }
          : { ...attempt.snapshot, kind: marked.kind, clientMutationId: marked.mutationId },
      });
      if (sendingEpoch !== epoch) return;
      if (noteFormSignature(remote) !== noteFormSignature(attempt.snapshot)) {
        await update(entry.id, sendingUser, currentEntry => currentEntry && ({ ...currentEntry, noteId: remote.id, remoteNote: remote,
          status: 'conflict', conflict: remote, error: 'Outra versão foi salva. Compare antes de continuar.' }));
      } else await acknowledge(entry.id, sendingUser, attempt, remote);
    } catch (caught) {
      let error = caught;
      if (sendingEpoch !== epoch) return;
      if (error.status === 409 && attempt.noteId && error.code !== 'SESSION_CHANGED') {
        try {
          const remote = await request(`/${attempt.noteId}`, options);
          if (sendingEpoch !== epoch) return;
          if (noteFormSignature(remote) === noteFormSignature(attempt.snapshot)) {
            await acknowledge(entry.id, sendingUser, attempt, remote); return;
          }
          // An independent share change can advance the version without changing text.
          if (noteFormSignature(remote) === noteFormSignature(marked.baseForm) && remote.role !== 'VIEWER' && !remote.deletedAt) {
            await update(entry.id, sendingUser, currentEntry => currentEntry && ({ ...currentEntry, baseVersion: remote.version, remoteNote: remote,
              attempt: null, status: 'pending', nextAttemptAt: now() })); return;
          }
          await update(entry.id, sendingUser, currentEntry => currentEntry && ({ ...currentEntry, status: 'conflict', conflict: remote,
            error: 'Outra pessoa alterou a nota. Seu texto foi preservado.' })); return;
        } catch (readError) { error = readError; }
      }
      const retryable = !error.status || error.status >= 500 || error.status === 429;
      await update(entry.id, sendingUser, currentEntry => currentEntry && ({ ...currentEntry,
        status: retryable ? 'retry' : 'blocked', blockedStatus: error.status || null,
        failures: (currentEntry.failures || 0) + 1,
        nextAttemptAt: retryable ? now() + Math.min(30000, 1000 * 2 ** Math.min(currentEntry.failures || 0, 5)) : 0,
        error: retryable ? 'Aguardando conexão para sincronizar. A cópia está neste navegador.' : error.message,
      }));
    } finally { controller = null; }
  };
  const api = {
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => snapshot,
    hasEditors: () => editors.size > 0,
    registerEditor: id => { editors.add(id); return () => editors.delete(id); },
    async activate(nextUser) {
      clearTimeout(timer); epoch++; controller?.abort(); userId = nextUser || null; paused = false;
      if (userId) lastOwner = userId;
      observed.clear();
      emit({ userId, entries: [], ready: !userId, error: '' });
      if (!userId) return;
      const loadingUser = userId, loadingEpoch = epoch;
      try {
        const stored = await store.list(loadingUser);
        for (const entry of stored) {
          if (loadingEpoch !== epoch) return;
          // Don't surface old acknowledgements as current server data. Keep
          // recent records for editors in other tabs using their draft version.
          if (entry.status === 'synced' && (entry.syncedAt || entry.updatedAt) < now() - 7 * 86400000) await store.update(entry.id, loadingUser, record => record?.status === 'synced' && (record.syncedAt || record.updatedAt) < now() - 7 * 86400000 ? null : record);
          else if (entry.status === 'sending' || (entry.status === 'blocked' && [401, 409].includes(entry.blockedStatus))) {
            await store.update(entry.id, loadingUser, record => record && (record.status === 'sending' || (record.status === 'blocked' && [401, 409].includes(record.blockedStatus))) ? { ...record, status: 'pending', nextAttemptAt: now() } : record);
          }
        }
        if (loadingEpoch === epoch) await refresh();
      } catch (error) { if (loadingEpoch === epoch) emit({ userId: loadingUser, entries: [], ready: true, error: error.message }); }
    },
    pause() { paused = true; epoch++; clearTimeout(timer); controller?.abort(); },
    resume() { paused = false; void refresh().catch(error => emit({ ...snapshot, error: error.message })); },
    refresh,
    async save(input, expectedDraftVersion = 0) {
      // A final local write can finish after session expiry/unmount. It stays
      // scoped to its original owner and cannot start a network request.
      if (input.userId !== (userId || lastOwner)) throw failure('Entre novamente na conta que criou este texto.', 'SESSION_CHANGED');
      const form = { title: String(input.form.title || ''), content: String(input.form.content || ''), items: structuredClone(input.form.items || []) };
      const hasContent = hasNoteContent(form);
      if (form.title.length > 250 || form.content.length > 100000 || form.items.length > 100) throw failure('O conteúdo ultrapassa o limite da nota.', 'NOTE_LIMIT');
      return update(input.id, input.userId, entry => {
        if ((entry?.draftVersion || 0) !== expectedDraftVersion) throw failure('Esta cópia está aberta em outra aba. Copie seu texto antes de continuar.', 'LOCAL_CONFLICT');
        if (!hasContent && (!entry || (entry.isNew && !entry.attempt && !entry.noteId))) return null;
        const existing = entry || { ...input, isNew: !input.noteId, baseForm: formOf(input.baseForm), draftVersion: 0, status: 'pending', attempt: null };
        const invalid = existing.status === 'blocked' && existing.blockedStatus === 400;
        return { ...existing, form, draftVersion: existing.draftVersion + 1, updatedAt: now(),
          status: !hasContent ? (existing.status === 'sending' ? 'sending' : 'blocked') : invalid || existing.status === 'synced' ? 'pending' : existing.status,
          ...(invalid ? { attempt: null, error: '', blockedStatus: null } : {}),
          ...(!hasContent ? { blockedStatus: 400, error: 'Preencha o título, o texto ou um item antes de sincronizar.' } : {}),
        };
      });
    },
    async run(force = false, targetId = null) {
      if (!current() || running || globalThis.navigator?.onLine === false) return;
      running = true;
      const runningUser = userId, runningEpoch = epoch;
      let entered = false;
      try {
        await withLock(`motive-note-sync:${runningUser}`, async () => {
          entered = true;
          if (!current() || runningEpoch !== epoch) return;
          const entries = await store.list(runningUser);
          const entry = entries.find(item => (!targetId || item.id === targetId) && waiting(item) && (force || (item.nextAttemptAt || item.updatedAt + 700) <= now()));
          if (entry) await send(entry);
        });
      } finally { if (!entered) contendedUntil = now() + 1000; else contendedUntil = 0; running = false; await refresh(); }
    },
    async retry(id) {
      const entry = snapshot.entries.find(item => item.id === id);
      if (!entry || entry.status === 'conflict') return;
      await update(id, userId, record => record && ({ ...record, status: 'pending', error: '', nextAttemptAt: now() }));
      schedule();
    },
    async discard(id) {
      await update(id, userId, entry => {
        if (entry?.status === 'sending') throw new Error('Aguarde a resposta antes de descartar esta cópia.');
        return null;
      });
    },
    async acceptRemote(id, remote) {
      await update(id, userId, entry => {
        if (!entry) return null;
        const merged = mergeNoteSnapshot(entry.remoteNote, remote);
        if (entry.status === 'synced') return { ...entry, baseVersion: merged.version, baseForm: formOf(merged), form: formOf(merged), remoteNote: merged };
        if (noteFormSignature(remote) !== noteFormSignature(entry.baseForm)) return entry;
        return { ...entry, baseVersion: Math.max(entry.baseVersion || 0, remote.version), remoteNote: merged };
      });
    },
    async flush(id) {
      await api.retry(id);
      // Wait for this entry, not for unrelated notes, with a bounded deadline.
      const deadline = now() + 25000;
      while (now() < deadline) {
        if (!current() || globalThis.navigator?.onLine === false) return null;
        const entry = snapshot.entries.find(item => item.id === id);
        if (!entry || entry.status === 'synced') return entry?.remoteNote || null;
        if (['blocked', 'conflict', 'retry'].includes(entry.status)) return null;
        if (!running) await api.run(true, id);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return null;
    },
    destroy() { clearTimeout(timer); epoch++; paused = true; userId = null; controller?.abort(); listeners.clear(); },
  };
  return api;
}
