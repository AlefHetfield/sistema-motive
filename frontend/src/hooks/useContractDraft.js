import { useEffect, useRef, useState } from 'react';
import { isContractDraft } from '../utils/contractForm';

export function useContractDraft(userId, snapshot, onRestore, hasExplicitContract) {
  const key = userId ? `motive.contract-draft.v1.${userId}` : null;
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('');
  const restoreRef = useRef(onRestore);
  useEffect(() => { restoreRef.current = onRestore; }, [onRestore]);
  useEffect(() => {
    if (!key) return;
    const timer = setTimeout(() => { try {
      const draft = JSON.parse(localStorage.getItem(key) || 'null');
      if (!hasExplicitContract && isContractDraft(draft)) {
        restoreRef.current(draft);
        setStatus('Rascunho recuperado');
      }
    } catch { setStatus('Não foi possível recuperar o rascunho'); }
    setReady(true); }, 0);
    return () => clearTimeout(timer);
  }, [key, hasExplicitContract]);
  useEffect(() => {
    if (!ready || !key) return;
    const statusTimer = setTimeout(() => setStatus('Salvando rascunho…'), 0);
    const save = (report = true) => {
      try {
        localStorage.setItem(key, JSON.stringify({ ...snapshot, version: 1, savedAt: new Date().toISOString() }));
        if (report) setStatus('Rascunho salvo neste navegador');
      } catch { if (report) setStatus('Rascunho não salvo: armazenamento indisponível'); }
    };
    const timer = setTimeout(save, 700);
    const flush = () => save(false);
    window.addEventListener('pagehide', flush);
    return () => { clearTimeout(timer); clearTimeout(statusTimer); window.removeEventListener('pagehide', flush); flush(); };
  }, [key, ready, snapshot]);
  return status;
}
