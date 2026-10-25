/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { notesApi } from '../services/api';
import { createNoteQueue } from '../utils/noteQueue';
import { createNoteQueueStore } from '../utils/noteQueueStore';
import { guardedNoteRequest } from '../utils/guardedNoteRequest';

const NoteSyncContext = createContext(null);
export const useNoteSync = () => useContext(NoteSyncContext);

export function NoteSyncProvider({ userId, children, queue: provided }) {
  const [instanceId] = useState(() => crypto.randomUUID());
  const [queue] = useState(() => provided || createNoteQueue({
    store: createNoteQueueStore(), request: guardedNoteRequest(notesApi),
    withLock: (name, work) => navigator.locks.request(name, { ifAvailable: true }, lock => lock ? work() : null),
    changed: owner => { window.dispatchEvent(new CustomEvent('motive:note-queue-changed', { detail: { userId: owner, source: instanceId } })); },
  }));
  const state = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
  useEffect(() => { void queue.activate(userId); return () => { void queue.activate(null); }; }, [queue, userId]);
  useEffect(() => {
    const online = () => queue.resume();
    const refresh = () => { if (!document.hidden) void queue.refresh().catch(() => {}); };
    const cancelLogout = () => queue.resume();
    const logout = event => {
      queue.pause();
      if (queue.hasEditors()) return;
      if (queue.getSnapshot().entries.some(entry => entry.status !== 'synced')) {
        event.detail?.waitUntil(Promise.resolve(window.confirm('Há notas pendentes neste navegador. Ao sair, elas ficarão guardadas para sincronizar quando você entrar nesta mesma conta. Deseja sair?')));
      }
    };
    const unauthorized = () => queue.pause();
    const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('motive-note-outbox') : null;
    if (channel) channel.onmessage = event => { if (event.data === userId) refresh(); };
    const changed = event => {
      if (event.detail?.userId !== userId) return;
      channel?.postMessage(userId);
      if (event.detail.source !== instanceId) refresh();
    };
    window.addEventListener('online', online); window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('motive:before-logout', logout);
    window.addEventListener('motive:logout-cancelled', cancelLogout);
    window.addEventListener('motive:unauthorized', unauthorized);
    window.addEventListener('motive:note-queue-changed', changed);
    return () => {
      channel?.close(); window.removeEventListener('online', online); window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('motive:before-logout', logout);
      window.removeEventListener('motive:logout-cancelled', cancelLogout);
      window.removeEventListener('motive:unauthorized', unauthorized);
      window.removeEventListener('motive:note-queue-changed', changed);
    };
  }, [queue, userId, instanceId]);
  const active = state.userId === (userId || null);
  return <NoteSyncContext.Provider value={{ queue, ...state, entries: active ? state.entries : [], ready: active && state.ready }}>{children}</NoteSyncContext.Provider>;
}
