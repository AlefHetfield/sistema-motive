import { useState } from 'react';
import { Plus, Tag, Trash2, Check, X } from 'lucide-react';
import { noteLabelsApi } from '../../services/api';
import NoteDialog from './NoteDialog';

function LabelRow({ label, onChanged, onError }) {
  const [name, setName] = useState(label.name);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const mutate = async deleting => {
    setBusy(true);
    try { await noteLabelsApi(`/${label.id}`, { method: deleting ? 'DELETE' : 'PATCH', ...(deleting ? {} : { body: { name: name.trim() } }) }); await onChanged(); setConfirm(false); }
    catch (err) { onError(err.message); }
    finally { setBusy(false); }
  };
  return <div className="border-b border-slate-100 pb-3 last:border-0"><div className="flex gap-2 items-center"><Tag size={16} className="text-slate-400 shrink-0" /><input className="note-input !text-sm" aria-label={`Nome do marcador ${label.name}`} value={name} maxLength={50} onChange={event => setName(event.target.value)} disabled={busy} /><button className="note-icon shrink-0" onClick={() => mutate(false)} disabled={busy || !name.trim() || name.trim() === label.name} aria-label={`Salvar nome do marcador ${label.name}`}><Check size={18} /></button><button className="note-icon shrink-0 hover:!text-red-600" onClick={() => setConfirm(!confirm)} disabled={busy} aria-label={`Excluir marcador ${label.name}`}><Trash2 size={16} /></button></div>{confirm && <div className="bg-slate-50 rounded-xl p-3 mt-2 text-xs text-slate-500"><p>Excluir “{label.name}”? Suas notas serão preservadas.</p><div className="flex justify-end gap-2 mt-2"><button className="note-button" onClick={() => setConfirm(false)}>Cancelar</button><button className="note-button !text-red-600" disabled={busy} onClick={() => mutate(true)}>Excluir marcador</button></div></div>}</div>;
}

export default function NoteLabelsDialog({ labels, onChanged, onClose }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const create = async event => {
    event.preventDefault(); if (!name.trim()) return; setBusy(true); setError('');
    try { await noteLabelsApi('', { method: 'POST', body: { name: name.trim() } }); setName(''); await onChanged(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <NoteDialog compact titleId="notes-labels-title" onClose={onClose}><div className="p-5 border-b border-slate-100 flex items-center gap-2"><Tag size={18} /><h2 id="notes-labels-title" className="font-semibold flex-1">Seus marcadores</h2><button className="note-icon" onClick={onClose} aria-label="Fechar marcadores"><X size={20} /></button></div><div className="p-5 space-y-4"><p className="text-sm text-slate-500">Organize suas ideias do seu jeito. Os marcadores são visíveis apenas para você.</p><form onSubmit={create} className="flex gap-2"><input data-autofocus className="note-input" value={name} onChange={event => setName(event.target.value)} maxLength={50} placeholder="Nome do novo marcador" aria-label="Nome do novo marcador" /><button className="note-button note-button-primary" disabled={busy || !name.trim() || labels.length >= 50} aria-label="Criar marcador"><Plus size={18} /></button></form>{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<div className="space-y-3 max-h-80 overflow-y-auto">{labels.map(label => <LabelRow key={`${label.id}-${label.name}`} label={label} onChanged={onChanged} onError={setError} />)}{!labels.length && <p className="text-sm text-slate-400 p-5 text-center">Comece com “Ideias”, “Reuniões” ou “Atendimento”.</p>}</div><p className="text-xs text-slate-400">{labels.length}/50 marcadores</p></div></NoteDialog>;
}
