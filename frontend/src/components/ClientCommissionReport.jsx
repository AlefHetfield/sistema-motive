import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ClipboardList, Copy, LockKeyhole, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchClientCommissionReport } from '../services/api';
import { formatClientCommission } from '../utils/clientCommission';
import Button from './ui/Button';

export default function ClientCommissionReport({ clients, scope, onClose }) {
  const { user } = useAuth();
  const canAccess = user?.role === 'ADM';
  const ids = JSON.stringify([...new Set(clients.filter(client => client.venda).map(client => client.id))]);
  const requestKey = JSON.stringify([user?.id, canAccess, ids, scope]);
  const [result, setResult] = useState(null);
  const [revision, setRevision] = useState(0);
  const [copyState, setCopyState] = useState({ key: '', busy: false, copied: false, error: false });
  const titleId = useId();
  const descriptionId = useId();
  const titleRef = useRef(null);
  const dialogRef = useRef(null);
  const manualCopyRef = useRef(null);
  const closeRef = useRef(onClose);
  const currentKey = useRef(requestKey);
  const report = result?.key === requestKey ? result.data : null;
  const error = result?.key === requestKey ? result.error : '';
  const loading = canAccess && ids !== '[]' && !report && !error;
  const copying = copyState.key === requestKey && copyState.busy;
  const copied = copyState.key === requestKey && copyState.copied;
  const copyError = copyState.key === requestKey && copyState.error;

  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    currentKey.current = requestKey;
    return () => { currentKey.current = null; };
  }, [requestKey]);

  useEffect(() => {
    if (!canAccess || ids === '[]') return;
    const controller = new AbortController();
    let disposed = false;
    const timeout = setTimeout(() => controller.abort(), 15000);
    fetchClientCommissionReport(JSON.parse(ids), scope, controller.signal)
      .then(data => {
        if (!disposed) setResult({ key: requestKey, data, error: '' });
      })
      .catch(() => {
        if (!disposed) setResult({ key: requestKey, data: null, error: 'Não foi possível gerar o relatório. Tente novamente.' });
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      disposed = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [canAccess, ids, requestKey, scope, revision]);

  useEffect(() => {
    if (!canAccess) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    titleRef.current?.focus({ preventScroll: true });
    const keyDown = event => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== 'Tab') return;
      const controls = [...(dialogRef.current?.querySelectorAll('button:not([disabled]), textarea:not([disabled])') || [])];
      const current = document.activeElement;
      if (event.shiftKey && (current === controls[0] || !controls.includes(current))) {
        event.preventDefault();
        controls.at(-1)?.focus();
      } else if (!event.shiftKey && (current === controls.at(-1) || !controls.includes(current))) {
        event.preventDefault();
        controls[0]?.focus();
      }
    };
    document.addEventListener('keydown', keyDown);
    return () => {
      document.removeEventListener('keydown', keyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, [canAccess]);

  useEffect(() => {
    if (copyError) {
      manualCopyRef.current?.focus();
      manualCopyRef.current?.select();
    }
  }, [copyError]);

  const copy = async () => {
    if (!report?.count || copying || !canAccess) return;
    setCopyState({ key: requestKey, busy: true, copied: false, error: false });
    try {
      await navigator.clipboard.writeText(report.text);
      if (currentKey.current === requestKey) setCopyState({ key: requestKey, busy: false, copied: true, error: false });
    } catch {
      if (currentKey.current === requestKey) setCopyState({ key: requestKey, busy: false, copied: false, error: true });
    }
  };

  if (!canAccess) return null;

  return createPortal(<div className="mobile-safe-overlay fixed inset-0 z-[9800] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={loading}
      className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <header className="flex shrink-0 items-start gap-3 border-b border-slate-100 p-5 sm:px-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ClipboardList size={22} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary"><LockKeyhole size={12} aria-hidden="true" />Administrativo</p>
          <h2 ref={titleRef} tabIndex={-1} id={titleId} className="mt-1 text-lg font-bold text-slate-900 outline-none" style={{ boxShadow: 'none' }}>Relatório de comissões</h2>
          <p id={descriptionId} className="mt-1 text-xs leading-5 text-slate-500">Vendas da aba e dos filtros selecionados, com dados atualizados.</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar relatório"><X size={19} aria-hidden="true" /></Button>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 sm:px-6">
        <p className="break-words text-xs leading-5 text-slate-500"><span className="font-semibold text-slate-700">Seleção</span> · {scope}</p>
        {loading && <div role="status" className="space-y-3 py-2"><p className="text-sm text-slate-500">Gerando relatório…</p><div className="h-24 animate-pulse rounded-xl bg-slate-100" /><div className="h-44 animate-pulse rounded-xl bg-slate-100" /></div>}
        {error && <div role="alert" className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p>{error}</p><Button variant="secondary" size="sm" onClick={() => { setResult(null); setRevision(value => value + 1); }}><RefreshCw size={15} aria-hidden="true" />Tentar novamente</Button></div>}
        {report && <>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Total líquido estimado</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-primary [overflow-wrap:anywhere]">{formatClientCommission(report.total)}</p>
            <p className="mt-2 text-xs text-slate-500">{report.count} {report.count === 1 ? 'venda' : 'vendas'} · {report.missingCount} {report.missingCount === 1 ? 'comissão a informar' : 'comissões a informar'}{report.reviewCount > 0 && ` · ${report.reviewCount} ${report.reviewCount === 1 ? 'comissão para revisar' : 'comissões para revisar'}`}</p>
          </div>
          {report.reviewCount > 0 && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-800">Total parcial. Revise as comissões cujos descontos superam o valor bruto para incluí-las na soma.</p>}
          {report.count > 0 && <div>
            <p className="mb-2 text-xs font-semibold text-slate-700">Prévia do texto</p>
            {copyError ? <textarea ref={manualCopyRef} readOnly value={report.text} aria-label="Texto do relatório para copiar manualmente" className="min-h-80 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700" />
              : <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-4 font-sans text-sm leading-6 text-slate-700">{report.text}</pre>}
          </div>}
        </>}
        {!loading && !error && !report?.count && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhuma venda encontrada nesta seleção.</p>}
        {copyError && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-800">Não foi possível copiar automaticamente. O texto está selecionado para copiar manualmente.</p>}
        <p role="status" aria-live="polite" className="text-xs font-semibold text-emerald-700">{copied ? 'Relatório copiado.' : ''}</p>
      </div>
      <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <Button variant="ghost" onClick={onClose}>Fechar</Button>
        <Button disabled={!report?.count || loading || Boolean(error)} loading={copying} loadingLabel="Copiando…" onClick={copy}>
          {copied ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}{copied ? 'Copiado' : 'Copiar relatório'}
        </Button>
      </footer>
    </section>
  </div>, document.body);
}
