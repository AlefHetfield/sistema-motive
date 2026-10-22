import { useState } from 'react';
import { Copy, FileClock, Trash2, X } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { removeNoteDraft } from '../../utils/noteDrafts';
import NoteDialog from './NoteDialog';
import { noteContentText } from '../../../../shared/noteContent';

const draftText = form => [form.title, noteContentText(form.content), ...(form.items || []).map(item => `${item.checked ? '[x]' : '[ ]'} ${item.text}`)].filter(Boolean).join('\n');

function DraftItem({ draft, onChanged }) {
  const notify = useToast();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const text = draftText(draft.form);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopyError(false); notify.success('Rascunho copiado.'); }
    catch { setCopyError(true); }
  };
  return <article className="rounded-2xl border border-slate-200 p-4 space-y-3">
    <div><h3 className="text-sm font-semibold break-words">{draft.form.title || 'Rascunho sem título'}</h3><p className="text-xs text-slate-400 mt-1">{draft.noteId ? 'Edição não enviada' : 'Nota ainda não criada'} · {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(draft.savedAt))}</p></div>
    <textarea readOnly value={text} onFocus={event => event.target.select()} aria-label={`Texto local do rascunho ${draft.form.title || 'sem título'}`} className="note-input min-h-28 text-sm leading-6" />
    {copyError && <p role="alert" className="text-xs text-amber-800">A cópia automática está indisponível. Selecione o texto acima e copie manualmente.</p>}
    <div className="flex flex-wrap gap-2"><button className="note-button" onClick={copy}><Copy size={15} />Copiar rascunho</button><button className="note-button !border-transparent !text-slate-500" onClick={() => setConfirmDiscard(!confirmDiscard)} aria-expanded={confirmDiscard}><Trash2 size={14} />Descartar</button></div>
    {confirmDiscard && <div className="rounded-xl bg-red-50 p-3 text-xs text-red-800"><p>Descartar este rascunho local? O texto pendente será removido desta aba.</p><div className="flex justify-end gap-2 mt-3"><button className="note-button" onClick={() => setConfirmDiscard(false)}>Manter rascunho</button><button className="note-button !text-red-600" onClick={() => { removeNoteDraft(draft.key); onChanged(); }}>Descartar rascunho</button></div></div>}
  </article>;
}

export default function NoteDraftsDialog({ drafts, onChanged, onClose }) {
  return <NoteDialog titleId="note-drafts-title" onClose={onClose}>
    <div className="flex items-center gap-3 p-5 border-b border-slate-100"><FileClock size={20} className="text-[#315b78]" /><h2 id="note-drafts-title" className="font-semibold flex-1">Recuperar rascunhos locais</h2><button className="note-icon" onClick={onClose} aria-label="Fechar rascunhos"><X size={20} /></button></div>
    <div className="p-5 space-y-4"><p className="text-sm text-slate-500 leading-6">Estes textos ficaram pendentes nesta aba. Você pode copiá-los mesmo que a nota original tenha sido excluída ou seu acesso tenha mudado.</p><p className="text-xs text-amber-800 bg-amber-50 rounded-xl p-3 leading-5">Rascunhos são temporários e ficam disponíveis por até 30 minutos. Copie o texto que deseja preservar. Nenhuma cópia será salva automaticamente.</p>{drafts.length ? drafts.map(draft => <DraftItem key={draft.key} draft={draft} onChanged={onChanged} />) : <p className="py-8 text-center text-sm text-slate-400">Nenhum rascunho pendente nesta aba.</p>}</div>
  </NoteDialog>;
}
