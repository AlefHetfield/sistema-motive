import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { noteContentText } from '../../../shared/noteContent';
import { notesApi } from '../services/api';
import { hasNoteContent, normalizeNoteForm, noteDraftKey, noteFormSignature, readNoteDraft, removeNoteDraft, writeNoteDraft } from '../utils/noteDrafts';

const formOf = note => ({ title: note?.title || '', content: note?.content || '', items: (note?.items || []).map(item => ({ ...item })) });

export default function useNoteAutosave({ initialNote = null, kind = 'TEXT', userId, onSaved }) {
  const [initial] = useState(() => {
    const key = noteDraftKey(userId, initialNote?.id, kind);
    const draft = readNoteDraft(key, userId);
    return { key, draft, mutationId: draft?.mutationId || crypto.randomUUID() };
  });
  const [note, setNote] = useState(initialNote);
  const [form, setForm] = useState(() => initial.draft?.form || formOf(initialNote));
  const [confirmedForm, setConfirmedForm] = useState(() => formOf(initialNote));
  const [status, setStatus] = useState(initial.draft && initialNote && initial.draft.baseVersion !== initialNote.version ? 'conflict' : initial.draft ? 'idle' : initialNote ? 'saved' : 'idle');
  const [error, setError] = useState(null);
  const [conflict, setConflict] = useState(() => initial.draft && initialNote && initial.draft.baseVersion !== initialNote.version ? initialNote : null);
  const [remoteChanged, setRemoteChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accessLost, setAccessLost] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [draftWarning, setDraftWarning] = useState('');
  const formRef = useRef(form);
  const noteRef = useRef(initialNote);
  const confirmedRef = useRef(formOf(initialNote));
  const baseVersionRef = useRef(initial.draft?.baseVersion ?? initialNote?.version);
  const keyRef = useRef(initial.key);
  const pausedRef = useRef(Boolean(initial.draft && initialNote && initial.draft.baseVersion !== initialNote.version));
  const accessLostRef = useRef(false);
  const leavingRef = useRef(false);
  const inFlightRef = useRef(null);
  const readSequenceRef = useRef(0);
  const editRevisionRef = useRef(0);
  const mountedRef = useRef(true);
  const onSavedRef = useRef(onSaved);
  const dirty = noteFormSignature(form) !== noteFormSignature(confirmedForm);
  const canEdit = !leaving && !accessLost && (!note || (note.role !== 'VIEWER' && !note.deletedAt));
  const dirtyRef = useRef(dirty);

  useEffect(() => { onSavedRef.current = onSaved; }, [onSaved]);

  const persist = useCallback(() => {
    if (!dirtyRef.current) return;
    const stored = writeNoteDraft(keyRef.current, {
      userId, noteId: noteRef.current?.id || null, mutationId: initial.mutationId,
      kind: noteRef.current?.kind || kind, baseVersion: baseVersionRef.current,
      form: formRef.current,
    });
    if (!stored && mountedRef.current) setDraftWarning('A recuperação nesta aba está indisponível. Mantenha o editor aberto até salvar.');
  }, [initial.mutationId, kind, userId]);

  const updateForm = useCallback(next => {
    if (leavingRef.current) return;
    editRevisionRef.current++;
    formRef.current = next;
    dirtyRef.current = noteFormSignature(next) !== noteFormSignature(confirmedRef.current);
    setForm(next);
    if (!['conflict', 'error', 'readonly'].includes(status)) setError(null);
    persist();
  }, [persist, status]);
  const setField = useCallback((field, value) => updateForm({ ...formRef.current, [field]: value }), [updateForm]);
  const setItems = useCallback(items => updateForm({ ...formRef.current, items }), [updateForm]);

  const adoptClean = useCallback(remote => {
    pausedRef.current = false;
    accessLostRef.current = false;
    noteRef.current = remote;
    confirmedRef.current = formOf(remote);
    baseVersionRef.current = remote.version;
    formRef.current = formOf(remote);
    dirtyRef.current = false;
    removeNoteDraft(keyRef.current);
    if (mountedRef.current) {
      setNote(remote); setForm(formOf(remote)); setConfirmedForm(formOf(remote)); setStatus(remote.role === 'VIEWER' || remote.deletedAt ? 'readonly' : 'saved');
      setError(null); setConflict(null); setRemoteChanged(false); setAccessLost(false);
    }
    onSavedRef.current?.(remote);
  }, []);

  const checkRemote = useCallback(async () => {
    if (!noteRef.current?.id || inFlightRef.current) return null;
    const sequence = ++readSequenceRef.current;
    const readingBase = baseVersionRef.current;
    try {
      const remote = await notesApi(`/${noteRef.current.id}`);
      if (!mountedRef.current || sequence !== readSequenceRef.current || inFlightRef.current || readingBase !== baseVersionRef.current) return null;
      if (!dirtyRef.current) adoptClean(remote);
      else {
        // Keep the version on which the pending text was based until the user resolves it.
        noteRef.current = remote;
        setNote(remote);
        if (remote.version !== baseVersionRef.current) {
          if (noteFormSignature(remote) === noteFormSignature(confirmedRef.current)) {
            // A participant or preference change can advance metadata without changing the text.
            baseVersionRef.current = remote.version;
            persist();
          } else {
            setRemoteChanged(true); setConflict(remote); setStatus('conflict'); pausedRef.current = true;
          }
        }
        if (remote.role === 'VIEWER' || remote.deletedAt) {
          pausedRef.current = true;
          setError(Object.assign(new Error('Seu acesso de edição mudou. Copie o rascunho antes de sair.'), { status: 403 }));
        }
      }
      return remote;
    } catch (cause) {
      if (sequence !== readSequenceRef.current || readingBase !== baseVersionRef.current || inFlightRef.current) return null;
      if (mountedRef.current && [401, 403, 404].includes(cause.status)) {
        pausedRef.current = true; accessLostRef.current = true;
        setAccessLost(true); setError(cause); setStatus('readonly'); persist();
      }
      return null;
    }
  }, [adoptClean, persist]);

  const flush = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current;
    if (accessLostRef.current || pausedRef.current) return false;
    if (noteRef.current?.role === 'VIEWER' || noteRef.current?.deletedAt) return dirtyRef.current ? false : noteRef.current;
    if (!dirtyRef.current) return noteRef.current || false;
    if (!hasNoteContent(formRef.current)) return false;
    const run = async () => {
      if (mountedRef.current) { setSaving(true); setStatus('saving'); setError(null); }
      try {
        // One in-flight request per editor. Edits arriving during the request become the next snapshot.
        while (dirtyRef.current) {
          const snapshot = normalizeNoteForm(formRef.current);
          if (!hasNoteContent(snapshot)) return false;
          const creating = !noteRef.current;
          const remote = await notesApi(creating ? '' : `/${noteRef.current.id}`, {
            method: creating ? 'POST' : 'PATCH',
            body: creating
              ? { ...snapshot, kind, clientMutationId: initial.mutationId }
              : { ...snapshot, version: baseVersionRef.current },
          });
          noteRef.current = remote;
          const nextKey = noteDraftKey(userId, remote.id, remote.kind);
          if (nextKey !== keyRef.current) { removeNoteDraft(keyRef.current); keyRef.current = nextKey; }
          if (creating && noteFormSignature(remote) !== noteFormSignature(snapshot)) {
            // An idempotent retry may discover a note already edited in another tab.
            pausedRef.current = true;
            if (mountedRef.current) { setNote(remote); setConflict(remote); setRemoteChanged(true); setStatus('conflict'); }
            persist();
            return false;
          }
          confirmedRef.current = formOf(remote);
          baseVersionRef.current = remote.version;
          dirtyRef.current = noteFormSignature(formRef.current) !== noteFormSignature(remote);
          if (dirtyRef.current) persist();
          else removeNoteDraft(keyRef.current);
          if (mountedRef.current) { setNote(remote); setConfirmedForm(formOf(remote)); setStatus(dirtyRef.current ? 'saving' : 'saved'); }
          onSavedRef.current?.(remote);
          if (!mountedRef.current || accessLostRef.current) break;
        }
        return dirtyRef.current ? false : noteRef.current;
      } catch (cause) {
        pausedRef.current = true;
        persist();
        if (mountedRef.current) {
          setError(cause);
          if (cause.status === 409) {
            setStatus('conflict'); setRemoteChanged(true); setConflict({ message: cause.message });
            try {
              const remote = await notesApi(`/${noteRef.current.id}`);
              if (mountedRef.current) { setConflict(remote); setNote(remote); }
            } catch { /* Preserve the local text even if current access was revoked. */ }
          } else {
            setStatus([401, 403, 404].includes(cause.status) ? 'readonly' : 'error');
            if ([401, 403, 404].includes(cause.status)) { accessLostRef.current = true; setAccessLost(true); }
          }
        }
        return false;
      } finally {
        inFlightRef.current = null;
        if (mountedRef.current) setSaving(false);
      }
    };
    const pending = run();
    inFlightRef.current = pending;
    return pending;
  }, [initial.mutationId, kind, persist, userId]);

  const discard = useCallback(() => {
    if (inFlightRef.current) return false;
    removeNoteDraft(keyRef.current);
    formRef.current = formOf(confirmedRef.current);
    dirtyRef.current = false;
    setForm(formOf(confirmedRef.current));
    setError(null);
    setStatus(noteRef.current ? 'saved' : 'idle');
    return true;
  }, []);

  const reload = useCallback(async () => {
    if (!noteRef.current?.id || inFlightRef.current) return false;
    const revision = editRevisionRef.current;
    const sequence = ++readSequenceRef.current;
    try {
      const remote = await notesApi(`/${noteRef.current.id}`);
      if (!mountedRef.current || sequence !== readSequenceRef.current || inFlightRef.current || editRevisionRef.current !== revision) {
        if (mountedRef.current) setError(new Error('Você continuou editando. Seu rascunho foi preservado; carregue novamente quando terminar.'));
        return false;
      }
      pausedRef.current = false; accessLostRef.current = false; setAccessLost(false);
      adoptClean(remote);
      return remote;
    } catch (cause) { setError(cause); return false; }
  }, [adoptClean]);

  const retry = useCallback(() => {
    if (conflict || accessLostRef.current) return Promise.resolve(false);
    pausedRef.current = false;
    return flush();
  }, [conflict, flush]);

  useEffect(() => {
    if (!dirty || !canEdit || pausedRef.current) return undefined;
    const timer = setTimeout(() => { void flush(); }, 700);
    return () => clearTimeout(timer);
  }, [dirty, form, canEdit, flush]);

  useEffect(() => {
    mountedRef.current = true;
    const preserve = () => persist();
    const beforeUnload = event => {
      if (!dirtyRef.current && !inFlightRef.current) return;
      persist(); event.preventDefault(); event.returnValue = '';
    };
    const beforeLogout = event => {
      leavingRef.current = true;
      setLeaving(true);
      if (!dirtyRef.current && !inFlightRef.current) return;
      event.detail?.waitUntil((async () => {
        if (await flush()) return true;
        if (inFlightRef.current) return false;
        if (!window.confirm('Há alterações que não foram salvas. Deseja descartá-las e sair?')) return false;
        return discard();
      })());
    };
    const cancelLogout = () => { leavingRef.current = false; setLeaving(false); };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('pagehide', preserve);
    window.addEventListener('motive:preserve-note-draft', preserve);
    window.addEventListener('motive:before-logout', beforeLogout);
    window.addEventListener('motive:logout-cancelled', cancelLogout);
    return () => {
      persist(); mountedRef.current = false;
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('pagehide', preserve);
      window.removeEventListener('motive:preserve-note-draft', preserve);
      window.removeEventListener('motive:before-logout', beforeLogout);
      window.removeEventListener('motive:logout-cancelled', cancelLogout);
    };
  }, [discard, flush, persist]);

  const blocker = useBlocker(useCallback(() => dirtyRef.current || Boolean(inFlightRef.current), []));
  const saveAndLeave = useCallback(async () => {
    if (await flush()) blocker.proceed?.();
  }, [blocker, flush]);
  const discardAndLeave = useCallback(() => { if (discard()) blocker.proceed?.(); }, [blocker, discard]);
  const stay = useCallback(() => blocker.reset?.(), [blocker]);
  const copyDraftText = useCallback(() => {
    const current = formRef.current;
    return [current.title, noteContentText(current.content), ...current.items.map(item => `${item.checked ? '[x]' : '[ ]'} ${item.text}`)].filter(Boolean).join('\n');
  }, []);

  return { note, form, setField, setItems, status, error, dirty, saving, conflict, remoteChanged, canEdit,
    flush, discard, reload, checkRemote, copyDraftText, retry, draftWarning,
    navigationBlocked: blocker.state === 'blocked', saveAndLeave, discardAndLeave, stay, leaving };
}
