import { useState } from 'react';
import { Cloud, CloudOff, Copy, LoaderCircle, Trash2, X } from 'lucide-react';
import { useNoteSync } from '../../context/NoteSyncContext';
import { noteContentText } from '../../utils/noteContent';
import { useToast } from '../../hooks/useToast';
import NoteDialog from './NoteDialog';

const noteSyncLabel = status => ({ pending: 'Pendente de envio', sending: 'Sincronizando…', retry: 'Aguardando conexão', conflict: 'Conflito: compare as versões', blocked: 'Não foi sincronizada' }[status] || 'Salva');

export default function NoteSyncStatus() {
  const sync = useNoteSync();
  const notify = useToast();
  const [opened, setOpened] = useState(false);
  const [discarding, setDiscarding] = useState(null);
  const entries = sync?.entries.filter(entry => entry.status !== 'synced') || [];
  if (!sync || (!entries.length && !sync.error)) return null;
  const failed = entries.some(entry => ['blocked', 'conflict'].includes(entry.status));
  const sending = entries.some(entry => entry.status === 'sending');
  const copy = async entry => {
    try { await navigator.clipboard.writeText([entry.form.title, noteContentText(entry.form.content), ...entry.form.items.map(item => `${item.checked ? '[x]' : '[ ]'} ${item.text}`)].filter(Boolean).join('\n')); notify.success('Texto pendente copiado.'); }
    catch { notify.error('Selecione o texto da cópia local e copie manualmente.'); }
  };
  return <>
    <div className={`mx-3 mt-3 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm sm:mx-6 ${failed || sync.error ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-600'}`} role="status">
      {sending ? <LoaderCircle size={17} className="animate-spin" /> : failed ? <CloudOff size={17} /> : <Cloud size={17} />}
      <span className="flex-1">{sync.error ? 'Não foi possível acessar as cópias locais.' : `${entries.length} ${entries.length === 1 ? 'nota pendente' : 'notas pendentes'} · ${sending ? 'Sincronizando…' : failed ? 'Há alterações que precisam de atenção.' : 'Cópia guardada neste navegador.'}`}</span>
      <button className="font-medium underline" onClick={() => setOpened(true)}>Ver pendentes</button>
    </div>
    {opened && <NoteDialog titleId="note-sync-title" onClose={() => setOpened(false)}>
      <div className="flex items-center gap-3 border-b p-5"><h2 id="note-sync-title" className="flex-1 font-semibold">Sincronização das notas</h2><button className="note-icon" aria-label="Fechar sincronização" onClick={() => setOpened(false)}><X size={20} /></button></div>
      <div className="space-y-4 p-5"><p className="text-sm text-slate-500">As cópias pendentes ficam neste navegador e nesta conta. Conflitos precisam ser resolvidos no editor da nota; o texto não será enviado por cima de outra versão.</p>
        {sync.error && <p role="alert" className="text-sm text-amber-800">{sync.error} Mantenha o editor aberto se ele ainda indicar alterações não preservadas.</p>}
        {!entries.length && <p className="text-sm text-slate-500">Nenhuma nota pendente.</p>}
        {entries.map(entry => <article key={entry.id} className="space-y-3 rounded-xl border p-4">
          <div><h3 className="font-medium">{entry.form.title || 'Sem título'}</h3><p className="text-xs text-slate-500">{noteSyncLabel(entry.status)}</p></div>
          <textarea className="note-input min-h-24 text-sm" readOnly aria-label={`Cópia pendente: ${entry.form.title || 'Sem título'}`} value={[entry.form.content ? noteContentText(entry.form.content) : '', ...entry.form.items.map(item => `${item.checked ? '[x]' : '[ ]'} ${item.text}`)].join('\n')} />
          {entry.error && <p className="text-xs text-amber-800">{entry.error}</p>}
          <div className="flex flex-wrap gap-2"><button className="note-button" onClick={() => copy(entry)}><Copy size={14} />Copiar</button>
            {['retry', 'blocked'].includes(entry.status) && <button className="note-button" onClick={() => sync.queue.retry(entry.id).catch(error => notify.error(error.message))}>Tentar novamente</button>}
            <button className="note-button" disabled={entry.status === 'sending'} onClick={() => setDiscarding(entry.id)}><Trash2 size={14} />Descartar cópia</button>
          </div>
          {discarding === entry.id && <div className="rounded-lg bg-red-50 p-3 text-xs text-red-800">Descartar a cópia pendente deste navegador? Isso não exclui a nota do servidor nem desfaz uma gravação que ele já recebeu.
            <div className="mt-3 flex gap-2"><button className="note-button" onClick={() => setDiscarding(null)}>Manter cópia</button><button className="note-button" onClick={async () => { try { await sync.queue.discard(entry.id); setDiscarding(null); } catch (error) { notify.error(error.message); } }}>Confirmar descarte</button></div>
          </div>}
        </article>)}
      </div>
    </NoteDialog>}
  </>;
}
