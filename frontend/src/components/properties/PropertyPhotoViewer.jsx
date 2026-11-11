import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, ImageIcon, X } from 'lucide-react';
import Button from '../ui/Button';

export default function PropertyPhotoViewer({ photos = [], index = 0, onIndexChange, onPhotoError, onClose }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const displayedIndex = Math.min(Math.max(index, 0), Math.max(photos.length - 1, 0));
  const photo = photos[displayedIndex];
  const actionsRef = useRef({ onClose, onIndexChange, index: displayedIndex, count: photos.length });

  useEffect(() => {
    actionsRef.current = { onClose, onIndexChange, index: displayedIndex, count: photos.length };
  }, [onClose, onIndexChange, displayedIndex, photos.length]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus({ preventScroll: true });

    const handleKeyDown = event => {
      const current = actionsRef.current;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        current.onClose();
        return;
      }
      if (current.count > 1 && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        current.onIndexChange((current.index + direction + current.count) % current.count);
        return;
      }
      if (event.key !== 'Tab') return;
      event.stopImmediatePropagation();
      const buttons = [...(dialogRef.current?.querySelectorAll('button:not([disabled])') || [])];
      const first = buttons[0];
      const last = buttons.at(-1);
      if (!first) return;
      if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  const previousPhoto = () => onIndexChange((displayedIndex - 1 + photos.length) % photos.length);
  const nextPhoto = () => onIndexChange((displayedIndex + 1) % photos.length);

  return createPortal(
    <div className="mobile-safe-overlay fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-2 backdrop-blur-sm sm:p-5">
      <button type="button" tabIndex={-1} aria-label="Fechar visualização das fotos" onClick={onClose} className="absolute inset-0" />
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative flex h-full max-h-[900px] min-h-0 w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-3 py-2 sm:px-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-sm font-bold text-slate-900">Fotos do imóvel</h2>
            <p aria-live="polite" aria-atomic="true" className="mt-0.5 text-xs text-slate-500">{photos.length ? `${displayedIndex + 1} de ${photos.length}` : 'Nenhuma foto disponível'}</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Fechar galeria de fotos" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-950">
          {photo ? <img src={photo.url} alt={photo.name || `Foto ${displayedIndex + 1} do imóvel`} onError={() => onPhotoError?.(photo.id)} className="h-full min-h-0 w-full object-contain" /> : <p className="flex items-center gap-2 px-4 text-sm text-slate-500"><ImageIcon size={20} aria-hidden="true" />Nenhuma foto disponível</p>}
          {photos.length > 1 && <>
            <Button variant="secondary" size="icon" onClick={previousPhoto} aria-label="Foto anterior" className="absolute left-2 top-1/2 min-h-11 min-w-11 -translate-y-1/2 sm:left-4"><ChevronLeft size={22} aria-hidden="true" /></Button>
            <Button variant="secondary" size="icon" onClick={nextPhoto} aria-label="Próxima foto" className="absolute right-2 top-1/2 min-h-11 min-w-11 -translate-y-1/2 sm:right-4"><ChevronRight size={22} aria-hidden="true" /></Button>
          </>}
        </div>
      </section>
    </div>, document.body,
  );
}
