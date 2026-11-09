import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, Sparkles, X } from 'lucide-react';
import Button from '../ui/Button';

const publicationDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' });

export default function ReleaseAnnouncementModal({ items = [], onClose, onConfirm, onDefer, busy = false, error = '' }) {
  const titleId = useId();
  const descriptionId = useId();
  const titleRef = useRef(null);
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  const hasItems = items.length > 0;

  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => { busyRef.current = busy; }, [busy]);
  useEffect(() => {
    if (!hasItems) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    titleRef.current?.focus({ preventScroll: true });

    const handleKey = event => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== 'Tab') return;
      const nodes = [...(dialogRef.current?.querySelectorAll('button:not([disabled]), a[href], [tabindex="0"]') || [])];
      if (!nodes.length) { event.preventDefault(); return; }
      const current = document.activeElement;
      if (event.shiftKey && (current === nodes[0] || !nodes.includes(current))) {
        event.preventDefault();
        nodes.at(-1).focus();
      } else if (!event.shiftKey && (current === nodes.at(-1) || !nodes.includes(current))) {
        event.preventDefault();
        nodes[0].focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, [hasItems]);

  if (!hasItems) return null;
  const single = items.length === 1;

  return createPortal(<div className="mobile-safe-overlay fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6">
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={busy}
      className="flex max-h-[92dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <header className="flex shrink-0 items-start gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles size={22} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Novidades do sistema</p>
          <h2 ref={titleRef} tabIndex={-1} id={titleId} className="mt-1 text-xl font-bold leading-7 text-slate-900 outline-none" style={{ boxShadow: 'none' }}>O sistema foi atualizado!</h2>
          <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-500">Confira o que mudou nesta versão.</p>
        </div>
        <Button variant="ghost" size="icon" disabled={busy} onClick={onClose} aria-label="Fechar novidades" className="-mr-1 -mt-1 text-slate-400"><X size={19} aria-hidden="true" /></Button>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
        {items.map(item => <section key={item.id} className={single ? '' : 'rounded-xl border border-slate-200 bg-slate-50/60 p-4'} aria-label={item.title}>
          <time dateTime={item.publishedAt} className="text-xs font-medium text-slate-500">{publicationDate.format(new Date(item.publishedAt))}</time>
          {!single && <h3 className="mt-2 text-sm font-bold leading-6 text-slate-800">{item.title}</h3>}
          <ul className="mt-4 space-y-3">
            {item.highlights.map(highlight => <li key={highlight} className="flex items-start gap-3 text-sm leading-6 text-slate-600">
              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Check size={12} aria-hidden="true" /></span>
              <span>{highlight}</span>
            </li>)}
          </ul>
        </section>)}
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm leading-5 text-red-700">{error}</p>}
      </div>
      <footer className="shrink-0 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {error && onDefer && <Button variant="ghost" disabled={busy} onClick={onDefer} className="w-full sm:w-auto">Continuar por agora</Button>}
          <Button loading={busy} loadingLabel="Registrando…" onClick={onConfirm} className="w-full sm:w-auto">Entendi</Button>
        </div>
      </footer>
    </section>
  </div>, document.body);
}
