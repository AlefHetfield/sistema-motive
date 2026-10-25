import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { notesApi } from '../services/api';
import { noteContentText } from '../utils/noteContent';
import { mergeNoteSnapshot } from '../utils/noteSnapshots';
import { hasNoteContent, noteDraftKey, noteFormSignature, readNoteDraft, removeNoteDraft, writeNoteDraft } from '../utils/noteDrafts';

const formOf = note => ({ title: note?.title || '', content: note?.content || '', items: structuredClone(note?.items || []) });

export default function useQueuedNoteAutosave({ initialNote, kind = 'TEXT', userId, onSaved }, sync) {
  const { queue } = sync;
  const [initial] = useState(() => {
    const stored = sync.entries.find(entry => entry.id === initialNote?._queueId);
    const remote = stored?.remoteNote || (typeof initialNote?.id === 'number' ? initialNote : null);
    const key = noteDraftKey(userId, remote?.id, kind);
    const draft = readNoteDraft(key, userId);
    return { id: stored?.id || crypto.randomUUID(), mutationId: stored?.mutationId || draft?.mutationId || crypto.randomUUID(),
      form: stored?.form || draft?.form || formOf(remote), remote, key, draftVersion: stored?.draftVersion || 0,
      baseVersion: stored?.baseVersion || draft?.baseVersion || remote?.version, baseForm: stored?.baseForm || formOf(remote) };
  });
  const entry = sync.entries.find(value => value.id === initial.id);
  const [form, setForm] = useState(initial.form);
  const [note, setNote] = useState(initial.remote);
  const [confirmedForm, setConfirmedForm] = useState(initial.baseForm);
  const [localError, setLocalError] = useState(null);
  const [localSaved, setLocalSaved] = useState(Boolean(entry));
  const [leaving, setLeaving] = useState(false);
  const [remoteConflict, setRemoteConflict] = useState(null);
  const formRef = useRef(form), noteRef = useRef(note), confirmedRef = useRef(confirmedForm);
  const draftVersion = useRef(initial.draftVersion), baseVersion = useRef(initial.baseVersion);
  const writes = useRef(Promise.resolve()), writing = useRef(0), durable = useRef(Boolean(entry) || noteFormSignature(form) === noteFormSignature(confirmedForm));
  const mounted = useRef(true), leavingRef = useRef(false), editRevision = useRef(0), onSavedRef = useRef(onSaved), lastAck = useRef('');
  const dirty = noteFormSignature(form) !== noteFormSignature(confirmedForm);
  const blocked = entry?.status === 'blocked' && [401, 403, 404, 409].includes(entry.blockedStatus);
  const [accessLost, setAccessLost] = useState(false);
  useEffect(() => { onSavedRef.current = onSaved; }, [onSaved]);

  const backup = useCallback(() => {
    writeNoteDraft(initial.key, { userId, noteId: noteRef.current?.id || null, kind, mutationId: initial.mutationId,
      baseVersion: baseVersion.current, form: formRef.current });
  }, [initial.key, initial.mutationId, kind, userId]);

  const persist = useCallback(next => {
    durable.current = false; writing.current++; setLocalSaved(false);
    const snapshot = structuredClone(next);
    const pending = writes.current.catch(() => {}).then(async () => {
      const saved = await queue.save({ id: initial.id, userId, kind, mutationId: initial.mutationId,
        noteId: noteRef.current?.id || null, baseVersion: baseVersion.current, baseForm: confirmedRef.current,
        remoteNote: noteRef.current, form: snapshot }, draftVersion.current);
      draftVersion.current = saved?.draftVersion || 0;
      durable.current = noteFormSignature(snapshot) === noteFormSignature(formRef.current);
      removeNoteDraft(initial.key);
      if (mounted.current) { setLocalError(null); setLocalSaved(durable.current); }
      return saved;
    }).catch(error => {
      backup(); if (mounted.current) setLocalError(error); throw error;
    }).finally(() => { writing.current--; });
    // Keep rejection observable to close/navigation, while edits do not leak an unhandled promise.
    writes.current = pending; void pending.catch(() => {});
    return pending;
  }, [backup, initial.id, initial.key, initial.mutationId, kind, queue, userId]);

  const updateForm = useCallback(next => {
    if (leavingRef.current) return;
    editRevision.current++; formRef.current = next; setForm(next); setLocalSaved(false); backup();
    void persist(next).catch(() => {});
  }, [backup, persist]);
  const setField = useCallback((field, value) => updateForm({ ...formRef.current, [field]: value }), [updateForm]);
  const setItems = useCallback(items => updateForm({ ...formRef.current, items }), [updateForm]);

  useEffect(() => {
    if (!entry) return;
    if (!writing.current && entry.draftVersion > draftVersion.current) {
      backup(); setLocalError(new Error('Esta cópia mudou em outra aba. Copie seu texto antes de continuar.')); durable.current = false;
      return;
    }
    if (entry.remoteNote) {
      noteRef.current = mergeNoteSnapshot(noteRef.current, entry.remoteNote);
      confirmedRef.current = entry.baseForm; baseVersion.current = entry.baseVersion;
      setNote(noteRef.current); setConfirmedForm(entry.baseForm);
      const ack = `${entry.remoteNote.id}:${entry.remoteNote.version}:${entry.remoteNote.state?.version}`;
      if (entry.status === 'synced' && lastAck.current !== ack) { lastAck.current = ack; onSavedRef.current?.(noteRef.current); }
    }
  }, [entry, backup]);

  const queueClose = useCallback(async () => {
    if (!writing.current && !hasNoteContent(formRef.current) && !noteRef.current && !queue.getSnapshot().entries.some(record => record.id === initial.id)) return true;
    try {
      await writes.current;
      if (!durable.current) { await persist(formRef.current); }
      return durable.current;
    } catch { return false; }
  }, [initial.id, persist, queue]);

  const flush = useCallback(async () => {
    if (!await queueClose()) return false;
    const current = queue.getSnapshot().entries.find(value => value.id === initial.id);
    if (!current || current.status === 'synced') return current?.remoteNote || noteRef.current || false;
    return await queue.flush(initial.id) || false;
  }, [initial.id, queue, queueClose]);
  const checkRemote = useCallback(async () => {
    const pending = queue.getSnapshot().entries.find(value => value.id === initial.id);
    if (!noteRef.current?.id || (pending && pending.status !== 'synced')) return null;
    const revision = editRevision.current;
    try {
      const remote = await notesApi(`/${noteRef.current.id}`, { expectedUserId: userId, signal: AbortSignal.timeout(20000) });
      if (!mounted.current) return null;
      noteRef.current = mergeNoteSnapshot(noteRef.current, remote); setNote(noteRef.current);
      if (revision === editRevision.current && noteFormSignature(formRef.current) === noteFormSignature(confirmedRef.current)) {
        formRef.current = formOf(remote); confirmedRef.current = formOf(remote); baseVersion.current = remote.version;
        setForm(formOf(remote)); setConfirmedForm(formOf(remote));
      } else if (remote.version !== baseVersion.current && noteFormSignature(remote) !== noteFormSignature(confirmedRef.current)) setRemoteConflict(remote);
      onSavedRef.current?.(remote); return remote;
    } catch (error) {
      if (mounted.current && [401, 403, 404].includes(error.status)) { backup(); setAccessLost(true); setLocalError(error); }
      return null;
    }
  }, [backup, initial.id, queue, userId]);
  const acceptMutation = useCallback(remote => {
    noteRef.current = mergeNoteSnapshot(noteRef.current, remote); setNote(noteRef.current);
    const current = queue.getSnapshot().entries.find(value => value.id === initial.id);
    if ((!current || current.status === 'synced') && noteFormSignature(formRef.current) === noteFormSignature(confirmedRef.current)) {
      formRef.current = formOf(noteRef.current); confirmedRef.current = formRef.current; baseVersion.current = noteRef.current.version;
      setForm(formRef.current); setConfirmedForm(formRef.current);
    } else if (noteFormSignature(noteRef.current) === noteFormSignature(confirmedRef.current)) baseVersion.current = noteRef.current.version;
    void queue.acceptRemote(initial.id, noteRef.current).catch(error => setLocalError(error));
    onSavedRef.current?.(noteRef.current); return noteRef.current;
  }, [initial.id, queue]);
  const discard = useCallback(async () => {
    try {
      await writes.current.catch(() => {}); await queue.discard(initial.id);
      formRef.current = formOf(noteRef.current); confirmedRef.current = formRef.current;
      draftVersion.current = 0; durable.current = true; removeNoteDraft(initial.key);
      setForm(formRef.current); setConfirmedForm(formRef.current); setLocalError(null); return true;
    } catch (error) { setLocalError(error); return false; }
  }, [initial.id, initial.key, queue]);
  const reload = useCallback(async () => {
    if (!noteRef.current?.id) return false;
    const revision = editRevision.current;
    try {
      const remote = await notesApi(`/${noteRef.current.id}`, { expectedUserId: userId });
      if (revision !== editRevision.current) throw new Error('Você continuou editando. Copie o rascunho antes de carregar novamente.');
      if (!await discard()) return false;
      noteRef.current = remote; formRef.current = formOf(remote); confirmedRef.current = formRef.current; baseVersion.current = remote.version;
      setNote(remote); setForm(formRef.current); setConfirmedForm(formRef.current); setRemoteConflict(null); setAccessLost(false);
      onSavedRef.current?.(remote); return remote;
    } catch (error) { setLocalError(error); return false; }
  }, [discard, userId]);

  useEffect(() => {
    mounted.current = true;
    const unregister = queue.registerEditor(initial.id);
    const beforeUnload = event => {
      if (durable.current && !writing.current) return;
      backup(); event.preventDefault(); event.returnValue = '';
    };
    const beforeLogout = event => {
      leavingRef.current = true; setLeaving(true);
      event.detail?.waitUntil((async () => {
        if (!await queueClose()) return false;
        if (!queue.getSnapshot().entries.some(value => value.status !== 'synced')) return true;
        return window.confirm('Há notas pendentes neste navegador. Ao sair, elas ficarão guardadas para sincronizar quando você entrar nesta mesma conta. Deseja sair?');
      })());
    };
    const cancel = () => { leavingRef.current = false; setLeaving(false); };
    window.addEventListener('beforeunload', beforeUnload); window.addEventListener('motive:before-logout', beforeLogout);
    window.addEventListener('motive:logout-cancelled', cancel);
    return () => { mounted.current = false; unregister(); window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('motive:before-logout', beforeLogout); window.removeEventListener('motive:logout-cancelled', cancel); };
  }, [backup, initial.id, queue, queueClose]);

  const blocker = useBlocker(useCallback(() => !durable.current || writing.current > 0, []));
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    let active = true;
    void queueClose().then(ready => { if (active && ready) blocker.proceed?.(); });
    return () => { active = false; };
  }, [blocker, queueClose]);
  const saveAndLeave = useCallback(async () => { if (await queueClose()) blocker.proceed?.(); }, [blocker, queueClose]);
  const discardAndLeave = useCallback(async () => { if (await discard()) blocker.proceed?.(); }, [blocker, discard]);
  const stay = useCallback(() => blocker.reset?.(), [blocker]);
  const copyDraftText = useCallback(() => [formRef.current.title, noteContentText(formRef.current.content), ...formRef.current.items.map(item => `${item.checked ? '[x]' : '[ ]'} ${item.text}`)].filter(Boolean).join('\n'), []);
  const retry = useCallback(async () => { await queue.retry(initial.id); return flush(); }, [flush, initial.id, queue]);
  const conflict = entry?.conflict || remoteConflict;
  const error = localError || (entry?.error ? Object.assign(new Error(entry.error), { status: entry.blockedStatus }) : null);
  return { persistent: true, localSaved, pending: Boolean(entry && entry.status !== 'synced'), note, form, setField, setItems, dirty, saving: entry?.status === 'sending',
    status: entry?.status || 'idle', error, conflict, remoteChanged: Boolean(conflict), draftWarning: localError ? 'Mantenha o editor aberto até preservar ou copiar seu texto.' : '',
    canEdit: sync.ready && !leaving && !blocked && !accessLost && (!note || (note.role !== 'VIEWER' && !note.deletedAt)),
    accessLost: blocked || accessLost, leaving, queueClose, flush, checkRemote, acceptMutation, discard, reload, retry, copyDraftText,
    navigationBlocked: blocker.state === 'blocked' && Boolean(localError), saveAndLeave, discardAndLeave, stay };
}
