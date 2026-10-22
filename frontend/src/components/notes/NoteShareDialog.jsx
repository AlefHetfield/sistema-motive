import { useEffect, useState } from 'react';
import { X, Users, Search, UserPlus, LockKeyhole } from 'lucide-react';
import { notesApi } from '../../services/api';
import NoteDialog from './NoteDialog';

export default function NoteShareDialog({ note, onClose, onSaved }) {
  const [access, setAccess] = useState(() => (note.access || []).map(item => ({ userId: item.userId, role: item.role, user: item.user })));
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => { setLoading(true); notesApi(`/share-options?q=${encodeURIComponent(query)}`, { signal: controller.signal }).then(items => { setOptions(items); setError(''); }).catch(err => { if (!controller.signal.aborted) setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  const save = async () => {
    setSaving(true); setError('');
    try { const updated = await notesApi(`/${note.id}/access`, { method: 'PUT', body: { version: note.version, access: access.map(({ userId, role }) => ({ userId, role })) } }); await onSaved(updated); onClose(); }
    catch (err) { setError(err.status === 409 ? 'A nota mudou enquanto você compartilhava. Feche esta janela e abra Compartilhar novamente para usar a versão atual.' : err.message); }
    finally { setSaving(false); }
  };
  return <NoteDialog compact titleId="note-share-title" onClose={() => { if (!saving) onClose(); }}>
    <div className="flex items-center gap-3 p-5 border-b border-slate-100"><div className="bg-[#315b780e] p-2.5 rounded-xl"><Users size={20} /></div><div className="flex-1"><h2 id="note-share-title" className="font-semibold">Compartilhar nota</h2><p className="text-xs text-slate-500 mt-0.5">Somente as pessoas que você escolher.</p></div><button className="note-icon" onClick={onClose} disabled={saving} aria-label="Fechar compartilhamento"><X size={20} /></button></div>
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><div className="w-9 h-9 rounded-full bg-[#315b7815] flex items-center justify-center font-semibold text-sm">{note.owner?.nome?.slice(0, 1) || 'V'}</div><div className="flex-1 text-sm"><p className="font-medium">{note.owner?.nome || 'Você'}</p><p className="text-xs text-slate-500">Dono da nota</p></div><LockKeyhole size={15} className="text-slate-400" /></div>
      {!!access.length && <div className="space-y-3">{access.map(person => <div className="flex items-center gap-2" key={person.userId}><div className="flex-1 min-w-0"><p className="text-sm truncate">{person.user?.nome || `Pessoa ${person.userId}`}</p>{person.user?.isActive === false && <p className="text-xs text-slate-400">Conta inativa</p>}</div><select className="note-input !w-auto !text-xs !py-2" aria-label={`Permissão de ${person.user?.nome || 'participante'}`} value={person.role} disabled={saving} onChange={event => setAccess(access.map(value => value.userId === person.userId ? { ...value, role: event.target.value } : value))}><option value="VIEWER">Pode visualizar</option><option value="EDITOR">Pode editar</option></select><button className="note-icon shrink-0" aria-label={`Remover ${person.user?.nome || 'participante'}`} disabled={saving} onClick={() => setAccess(access.filter(value => value.userId !== person.userId))}><X size={16} /></button></div>)}</div>}
      <div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-slate-400" /><input data-autofocus className="note-input !pl-9" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar pessoas da equipe…" aria-label="Buscar pessoas para compartilhar" /></div>
      <div className="max-h-48 overflow-y-auto space-y-1" aria-live="polite">{loading ? <p className="p-3 text-sm text-slate-400">Buscando pessoas…</p> : options.filter(person => person.id !== note.ownerId && !access.some(value => value.userId === person.id)).map(person => <button key={person.id} disabled={saving} onClick={() => setAccess([...access, { userId: person.id, role: 'VIEWER', user: person }])} className="flex w-full text-left items-center gap-3 p-3 rounded-xl hover:bg-slate-50 text-sm"><UserPlus size={16} className="text-slate-400" /><span className="flex-1">{person.nome}</span><span className="text-xs text-[#315b78]">Adicionar</span></button>)}{!loading && !options.filter(person => person.id !== note.ownerId && !access.some(value => value.userId === person.id)).length && <p className="p-3 text-sm text-slate-400">Nenhuma pessoa disponível nesta busca.</p>}</div>
      <p className="text-xs leading-5 text-slate-500">Leitores podem consultar. Editores também podem alterar o texto e marcar itens. Cores e marcadores continuam pessoais.</p>
      {error && <p role="alert" className="rounded-xl bg-red-50 text-red-700 p-3 text-sm">{error}</p>}
    </div>
    <div className="p-4 border-t border-slate-100 flex justify-end gap-2"><button className="note-button" onClick={onClose} disabled={saving}>Cancelar</button><button className="note-button note-button-primary" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar compartilhamento'}</button></div>
  </NoteDialog>;
}
