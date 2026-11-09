import { useEffect, useRef, useState } from 'react';
import { releaseApi } from '../services/releaseApi';

const acknowledgmentEvent = 'motive:releases-acknowledged';
const acknowledgmentStorage = 'motive:release-acknowledged';

export default function useReleaseAnnouncements(userId, enabled = true) {
  const [result, setResult] = useState({ userId: null, items: [] });
  const [confirmation, setConfirmation] = useState({ userId: null, busy: false, error: '' });
  const currentUser = useRef(userId);
  const acknowledgedIds = useRef(new Set());
  const pendingConfirmation = useRef(null);
  const items = enabled && result.userId === userId ? result.items : [];
  const checking = Boolean(userId && enabled && result.userId !== userId);
  const busy = confirmation.userId === userId && confirmation.busy;
  const error = confirmation.userId === userId ? confirmation.error : '';

  useEffect(() => {
    currentUser.current = userId;
    acknowledgedIds.current = new Set();
    return () => pendingConfirmation.current?.controller.abort();
  }, [userId]);

  useEffect(() => {
    if (!userId || !enabled) return;
    const controller = new AbortController();
    let disposed = false;
    const timeout = setTimeout(() => controller.abort(), 8000);
    releaseApi('/pending', { signal: controller.signal, expectedUserId: userId })
      .then(data => {
        if (disposed) return;
        // A slow request must not interrupt a form that the user has already opened.
        const editing = document.activeElement?.matches('input, textarea, select, [contenteditable="true"]');
        const dialogOpen = document.querySelector('[role="dialog"][aria-modal="true"]');
        setResult({ userId, items: editing || dialogOpen ? [] : data.items.filter(item => !acknowledgedIds.current.has(item.id)) });
      })
      .catch(() => {
        if (!disposed) setResult({ userId, items: [] });
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      disposed = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [userId, enabled]);

  useEffect(() => {
    const applyAcknowledgment = data => {
      if (data?.userId !== userId || !Array.isArray(data.ids)) return;
      data.ids.forEach(id => acknowledgedIds.current.add(id));
      setResult(current => current.userId === userId
        ? { ...current, items: current.items.filter(item => !data.ids.includes(item.id)) }
        : current);
    };
    const local = event => applyAcknowledgment(event.detail);
    const remote = event => {
      if (event.key !== acknowledgmentStorage || !event.newValue) return;
      try { applyAcknowledgment(JSON.parse(event.newValue)); } catch { /* Ignore unrelated storage data. */ }
    };
    window.addEventListener(acknowledgmentEvent, local);
    window.addEventListener('storage', remote);
    return () => {
      window.removeEventListener(acknowledgmentEvent, local);
      window.removeEventListener('storage', remote);
    };
  }, [userId]);

  const acknowledge = () => {
    if (pendingConfirmation.current?.userId === userId) return pendingConfirmation.current.promise;
    if (!userId || !items.length) return Promise.resolve(true);
    const ids = items.map(item => item.id);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    setConfirmation({ userId, busy: true, error: '' });
    const promise = releaseApi('/acknowledge', { method: 'POST', body: { ids }, signal: controller.signal, expectedUserId: userId })
      .then(data => {
        if (controller.signal.aborted || currentUser.current !== userId) return false;
        const acknowledgment = { userId, ids: data.acknowledgedIds };
        setResult(current => current.userId === userId
          ? { ...current, items: current.items.filter(item => !data.acknowledgedIds.includes(item.id)) }
          : current);
        window.dispatchEvent(new CustomEvent(acknowledgmentEvent, { detail: acknowledgment }));
        try {
          localStorage.setItem(acknowledgmentStorage, JSON.stringify({ ...acknowledgment, at: Date.now() }));
        } catch { /* The server keeps the acknowledgment when browser storage is unavailable. */ }
        return true;
      })
      .catch(() => {
        if (currentUser.current === userId) {
          setConfirmation({ userId, busy: false, error: 'Não foi possível confirmar a leitura. Tente novamente.' });
        }
        return false;
      })
      .finally(() => {
        clearTimeout(timeout);
        if (pendingConfirmation.current?.controller === controller) pendingConfirmation.current = null;
        setConfirmation(current => current.userId === userId ? { ...current, busy: false } : current);
      });
    pendingConfirmation.current = { userId, controller, promise };
    return promise;
  };

  const dismiss = () => {
    setResult(current => current.userId === userId ? { ...current, items: [] } : current);
  };

  return { items, checking, busy, error, acknowledge, dismiss };
}
