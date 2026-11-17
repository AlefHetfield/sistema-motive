import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPropertyListingRefresh, refreshPropertyListings } from '../services/api';

const activeStatuses = new Set(['running', 'waiting']);
const terminalStatuses = new Set(['completed', 'cancelled']);

export default function usePropertyListingRefresh({ onUpdated, onSettled } = {}) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(false);
  const inFlight = useRef(null);
  const jobRef = useRef(null);
  const callbacks = useRef({ onUpdated, onSettled });
  const settled = useRef('');

  useEffect(() => { callbacks.current = { onUpdated, onSettled }; }, [onUpdated, onSettled]);

  const request = useCallback(async (action = 'current') => {
    if (inFlight.current || !mounted.current) return;
    const operation = { controller: new AbortController() };
    inFlight.current = operation;
    setBusy(true);
    setError('');
    try {
      const result = action === 'current'
        ? await fetchPropertyListingRefresh(operation.controller.signal)
        : await refreshPropertyListings({ action, ...(jobRef.current?.id ? { jobId: jobRef.current.id } : {}) }, operation.controller.signal);
      if (!mounted.current || inFlight.current !== operation) return;
      if (!result || !Object.hasOwn(result, 'job')) throw new Error('Não foi possível verificar o progresso da atualização.');
      const current = result.job;
      jobRef.current = current;
      setJob(current);
      if (Array.isArray(result.updated) && result.updated.length) callbacks.current.onUpdated?.(result.updated);
      if (current && terminalStatuses.has(current.status)) {
        const key = `${current.id}:${current.status}:${current.processed}`;
        if (settled.current !== key) {
          settled.current = key;
          callbacks.current.onSettled?.(current, action !== 'current');
        }
      }
    } catch (failure) {
      if (failure.name !== 'AbortError' && mounted.current && inFlight.current === operation) {
        setError(failure.message || 'Não foi possível acessar a atualização. O progresso foi preservado.');
      }
    } finally {
      if (mounted.current && inFlight.current === operation) {
        inFlight.current = null;
        setBusy(false);
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void request();
    return () => {
      mounted.current = false;
      inFlight.current?.controller.abort();
      inFlight.current = null;
    };
  }, [request]);

  useEffect(() => {
    if (loading || busy || error || !activeStatuses.has(job?.status)) return;
    const deadline = job.nextAttemptAt ? new Date(job.nextAttemptAt).getTime() : 0;
    // A minimum interval also protects against a stale lease/deadline response.
    const delay = Math.max(500, Math.min(2147483647, (Number.isFinite(deadline) ? deadline : 0) - Date.now()));
    const timer = setTimeout(() => { void request('step'); }, delay);
    return () => clearTimeout(timer);
  }, [job, busy, error, loading, request]);

  return {
    job, loading, busy, error,
    refresh: useCallback(() => request('current'), [request]),
    start: useCallback(() => request('start'), [request]),
    resume: useCallback(() => request('resume'), [request]),
    cancel: useCallback(() => request('cancel'), [request]),
  };
}
