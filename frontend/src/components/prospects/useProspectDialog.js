import { useEffect, useRef } from 'react';

export default function useProspectDialog(ref, onClose, blocked, focusId) {
  const latest = useRef({ onClose, blocked });
  useEffect(() => { latest.current = { onClose, blocked }; }, [onClose, blocked]);
  useEffect(() => {
    const previous = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = ref.current;
    const focus = setTimeout(() => (document.getElementById(focusId) || dialog)?.focus(), 0);
    const keyDown = event => {
      if (event.key === 'Escape' && !latest.current.blocked) { event.preventDefault(); latest.current.onClose(); }
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]):not([type="file"]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]')]
        .filter(el => !el.hidden && el.getAttribute('tabindex') !== '-1' && el.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (!controls.length) { event.preventDefault(); dialog.focus(); }
      else if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener('keydown', keyDown);
    return () => { clearTimeout(focus); dialog.removeEventListener('keydown', keyDown); document.body.style.overflow = oldOverflow; previous?.focus?.(); };
  }, [ref, focusId]);
}
