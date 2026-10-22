import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

let openDialogs = 0;
let originalOverflow = '';

export default function NoteDialog({ children, titleId, onClose, compact = false, editor = false }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const priorFocus = document.activeElement;
    if (openDialogs === 0) { originalOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    openDialogs += 1;
    const timer = setTimeout(() => (ref.current?.querySelector('[data-autofocus]:not(:disabled)') || ref.current?.querySelector('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)') || ref.current)?.focus(), 0);
    const keydown = event => {
      const dialogs = [...document.querySelectorAll('[data-note-dialog]')];
      if (dialogs.at(-1) !== ref.current) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current?.(); }
      if (event.key !== 'Tab') return;
      const elements = [...ref.current.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]')].filter(item => item.getClientRects().length);
      if (!elements.length) { event.preventDefault(); ref.current.focus(); return; }
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { clearTimeout(timer); document.removeEventListener('keydown', keydown); openDialogs -= 1; if (!openDialogs) document.body.style.overflow = originalOverflow; if (priorFocus?.isConnected) priorFocus.focus(); };
  }, []);
  return createPortal(<div className="note-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}><section ref={ref} data-note-dialog role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`note-dialog ${compact ? 'note-dialog-compact' : ''} ${editor ? 'note-dialog-editor' : ''}`}>{children}</section></div>, document.body);
}
