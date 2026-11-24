import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';
import Button from '../ui/Button';
import useProspectDialog from './useProspectDialog';
import { prospectAddress } from './prospectFields';
import { prospectApi } from '../../services/prospectApi';

export default function DeleteProspectDialog({ item, onClose, onDeleted }) {
  const id = useId(), ref = useRef(null), pending = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useProspectDialog(ref, onClose, busy, `${id}-cancel`);
  const remove = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError('');
    try {
      await prospectApi(`/${item.id}`, { method: 'DELETE', body: { version: item.version } });
      onDeleted();
    } catch (reason) { setError(reason.message); }
    finally { pending.current = false; setBusy(false); }
  };
  return createPortal(<div className="mobile-safe-overlay fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
    <section ref={ref} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} aria-busy={busy} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600"><Trash2 size={22} aria-hidden="true" /></div>
      <h2 id={`${id}-title`} className="text-lg font-bold text-slate-900">Excluir captação?</h2>
      <p className="mt-2 break-words text-sm font-semibold leading-6 text-slate-700">{prospectAddress(item)}</p>
      <p id={`${id}-description`} className="mt-2 text-sm leading-6 text-slate-500">O registro e a foto serão excluídos permanentemente. Essa ação não pode ser desfeita.</p>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-700">{error}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button id={`${id}-cancel`} variant="secondary" disabled={busy} onClick={onClose}>Cancelar</Button>
        <Button variant="danger" loading={busy} loadingLabel="Excluindo…" onClick={remove}><Trash2 size={15} aria-hidden="true" />Excluir captação</Button>
      </div>
    </section>
  </div>, document.body);
}
