import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, PauseCircle, RefreshCw, X } from 'lucide-react';
import Button from '../ui/Button';

const statusLabels = {
  running: 'Atualizando imóveis',
  waiting: 'Aguardando nova tentativa',
  paused: 'Atualização pausada',
  completed: 'Atualização concluída',
  cancelled: 'Atualização cancelada',
};

function remainingTime(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes}min ${String(seconds % 60).padStart(2, '0')}s` : `${seconds}s`;
}

export default function RefreshListingsModal({ total = 0, job, loading, busy, error, onClose, onStart, onResume, onCancel, onRetry }) {
  const headingId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const [now, setNow] = useState(Date.now);
  const deadline = job?.nextAttemptAt ? new Date(job.nextAttemptAt).getTime() : 0;
  const cooldown = Number.isFinite(deadline) && deadline > now;
  const isActive = ['running', 'waiting'].includes(job?.status);
  const canResume = ['paused', 'cancelled'].includes(job?.status) && job.pendingCount > 0;
  const completed = job?.status === 'completed';
  const currentTotal = job?.total ?? total;
  const processed = job?.processed ?? 0;
  const failed = Array.isArray(job?.failed) ? job.failed : [];
  const progress = currentTotal ? Math.min(100, Math.round(processed / currentTotal * 100)) : (completed ? 100 : 0);
  const waitingOnSite = job?.status === 'waiting' && job.delayReason === 'rate_limit';
  const status = error ? 'Conexão interrompida' : loading ? 'Verificando atualização' : waitingOnSite ? 'Aguardando liberação do site' : statusLabels[job?.status] || 'Atualizar imóveis';

  useEffect(() => {
    if (!deadline) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    if (deadline <= Date.now()) return () => clearTimeout(first);
    const interval = setInterval(() => {
      tick();
      if (Date.now() >= deadline) clearInterval(interval);
    }, 1000);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, [deadline]);

  useEffect(() => {
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    dialog.querySelector('h2')?.focus();
    const keyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('button:not([disabled]), summary, [tabindex="0"]')].filter(element => !element.hidden);
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
    };
    dialog.addEventListener('keydown', keyDown);
    return () => { dialog.removeEventListener('keydown', keyDown); previous?.focus?.(); };
  }, [onClose]);

  return <div className="fixed inset-0 z-[9700] flex items-end justify-center bg-gray-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
    <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Fechar atualização de imóveis" tabIndex={-1} />
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={headingId} aria-describedby={descriptionId} className="mobile-safe-bottom relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-xl sm:rounded-3xl">
      <header className="flex shrink-0 items-start gap-3 border-b border-gray-100 p-5">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${completed ? 'bg-emerald-50 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
          {completed ? <CheckCircle2 className="h-5 w-5" /> : job?.status === 'waiting' ? <Clock3 className="h-5 w-5" /> : ['paused', 'cancelled'].includes(job?.status) ? <PauseCircle className="h-5 w-5" /> : <RefreshCw className={`h-5 w-5 ${job?.status === 'running' ? 'animate-spin' : ''}`} />}
        </span>
        <div className="min-w-0 flex-1"><h2 id={headingId} tabIndex={-1} className="text-lg font-bold text-gray-900 outline-none">{completed ? 'Atualização concluída' : 'Atualizar imóveis'}</h2><p id={descriptionId} className="mt-1 text-sm leading-5 text-gray-500">Atualiza fotos, valores e informações a partir dos anúncios do site.</p></div>
        <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100" aria-label="Fechar"><X className="h-5 w-5" /></button>
      </header>

      <div className="min-h-0 overflow-y-auto p-5">
        {!job && !loading && !error && <div className="rounded-xl border border-primary/15 bg-primary/[0.05] p-4 text-sm leading-6 text-primary">Encontramos <strong>{total} imóvel(is)</strong> com link do site. As consultas serão feitas uma por vez, com pausas para respeitar o limite do site.</div>}
        {(job || loading) && <div>
          <div className="flex items-center justify-between gap-3 text-xs font-bold text-gray-600"><span role="status" aria-live="polite">{status}</span>{job && <span className="shrink-0">{processed} de {currentTotal}</span>}</div>
          {job && <>
            <div role="progressbar" aria-label="Progresso da atualização" aria-valuemin={0} aria-valuemax={currentTotal || 1} aria-valuenow={processed} className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} /></div>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Atualizados</p><p className="mt-1 text-xl font-bold text-emerald-700">{job.updatedCount}</p></div>
              <div className="rounded-xl bg-primary/[0.05] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-primary">Pendentes</p><p className="mt-1 text-xl font-bold text-primary">{job.pendingCount}</p></div>
              <div className="rounded-xl bg-amber-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-amber-600">Para revisão</p><p className="mt-1 text-xl font-bold text-amber-700">{failed.length}</p></div>
            </div>
          </>}
        </div>}

        {!error && job?.status === 'waiting' && <div className="mt-4 flex gap-3 rounded-xl border border-primary/20 bg-primary/[0.05] p-4 text-sm text-primary"><Clock3 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><div><p className="font-bold">{waitingOnSite ? 'Pausa automática para respeitar o site' : 'Vamos tentar novamente automaticamente'}</p><p className="mt-1 leading-5">{job.message || 'O progresso foi salvo. Os imóveis pendentes continuam na fila.'}</p><p className="mt-2 font-semibold">{cooldown ? <><span aria-hidden="true">Nova tentativa em {remainingTime(deadline - now)}</span><span className="sr-only">Próxima tentativa às {new Date(deadline).toLocaleTimeString('pt-BR')}</span></> : 'Retomando a atualização…'}</p></div></div>}
        {!error && job?.status === 'paused' && <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><PauseCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><div><p className="font-bold">Seu progresso está salvo</p><p className="mt-1 leading-5">{job.message || 'As tentativas automáticas foram pausadas. Você pode retomar somente os imóveis pendentes.'}</p>{cooldown && <p className="mt-2 font-semibold" aria-hidden="true">Retomada disponível em {remainingTime(deadline - now)}</p>}</div></div>}
        {!error && job?.status === 'cancelled' && <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-600"><p>A atualização foi cancelada. Os dados já atualizados foram mantidos{job.pendingCount ? '; você pode retomar os imóveis pendentes.' : '.'}</p>{job.pendingCount > 0 && cooldown && <p className="mt-2 font-semibold"><span aria-hidden="true">Retomada disponível em {remainingTime(deadline - now)}</span><span className="sr-only">Retomada disponível às {new Date(deadline).toLocaleTimeString('pt-BR')}</span></p>}</div>}
        {error && <div role="alert" className="mt-4 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><div><p className="font-bold">Não foi possível continuar agora</p><p className="mt-1 leading-5">{error}</p><p className="mt-2 leading-5">O progresso fica salvo para retomar os imóveis pendentes.</p></div></div>}
        {failed.length > 0 && <details className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><summary className="min-h-6 cursor-pointer font-bold">Ver {failed.length} imóvel(is) para revisão</summary><div className="mt-2 max-h-36 overflow-y-auto">{failed.map(item => <p key={item.id} className="py-1 leading-5"><strong>{item.code || item.title}:</strong> {item.error}</p>)}</div></details>}
        {isActive && !error && <p className="mt-4 text-xs leading-5 text-gray-500">Você pode fechar esta janela e continuar usando o mapa. O progresso fica salvo para retomar quando voltar.</p>}
      </div>

      <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-4">
        {(isActive || job?.status === 'paused') && <Button variant="ghost" disabled={busy} onClick={onCancel} className="mr-auto">Cancelar atualização</Button>}
        <Button variant="secondary" onClick={onClose}>{completed ? 'Concluir' : 'Fechar'}</Button>
        {error ? <Button onClick={onRetry} loading={busy} loadingLabel="Reconectando…">Reconectar</Button> : canResume ? <Button onClick={onResume} disabled={busy || cooldown} loading={busy}>Retomar pendentes</Button> : (!job || completed) && <Button onClick={onStart} loading={busy || loading} loadingLabel={loading ? 'Verificando…' : 'Iniciando…'} disabled={total === 0}>{completed ? 'Nova atualização' : 'Atualizar todos'}</Button>}
      </footer>
    </section>
  </div>;
}
