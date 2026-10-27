import { useEffect, useRef, useState } from 'react';
import { Archive, ArchiveRestore, Baseline, Check, CheckCheck, Cloud, CloudOff, Copy, Eye, EyeOff, LoaderCircle, Pin, Share2, Tag, Trash2, X, LockKeyhole, Users, AlertTriangle, RotateCcw } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { notesApi } from '../../services/api';
import useNoteAutosave from '../../hooks/useNoteAutosave';
import useQueuedNoteAutosave from '../../hooks/useQueuedNoteAutosave';
import { useNoteSync } from '../../context/NoteSyncContext';
import NoteDialog from './NoteDialog';
import NoteChecklist from './NoteChecklist';
import NoteRichText from './NoteRichText';
import { noteContentText } from '../../utils/noteContent.js';
import NoteShareDialog from './NoteShareDialog';
import { noteBackground, noteColors } from './noteColors';

function NoteEditorContent({ initialNote, kind = 'TEXT', userId, labels, onClose, onTrash, onRestore, onDelete, autosave }) {
  const notify = useToast();
  const { note, form, setField, setItems, error, dirty, saving, conflict, remoteChanged, canEdit, flush, discard, reload, checkRemote, acceptMutation, copyDraftText, retry, draftWarning, navigationBlocked, saveAndLeave, discardAndLeave, stay, leaving, accessLost } = autosave;
  const [shareNote, setShareNote] = useState(null);
  const [showLabels, setShowLabels] = useState(false);
  const [showFormat, setShowFormat] = useState(false);
  const [toolbarTarget, setToolbarTarget] = useState(null);
  const formatButton = useRef(null);
  const closeFormat = () => { setShowFormat(false); formatButton.current?.focus(); };
  const [showClose, setShowClose] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [actionBusy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const [optimisticState, setOptimisticState] = useState(null);
  const busy = actionBusy || leaving || closing;
  const [actionError, setActionError] = useState('');
  const lastRemoteCheck = useRef(0);
  useEffect(() => { if (initialNote?.id) void checkRemote(); }, [checkRemote, initialNote?.id]);
  useEffect(() => {
    const update = () => {
      if (document.hidden || Date.now() - lastRemoteCheck.current < 1000) return;
      lastRemoteCheck.current = Date.now(); void checkRemote();
    };
    const timer = setInterval(update, 30000);
    window.addEventListener('focus', update); document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update); };
  }, [checkRemote]);
  const state = { ...(note?.state || {}), ...optimisticState };
  const hasContent = Boolean(form.title?.trim() || form.content?.trim() || form.items?.some(item => item.text?.trim()));
  const safeClose = async () => {
    if (busy) return;
    if (!autosave.queueClose && !dirty && !saving) { onClose({ refresh: accessLost }); return; }
    if (!autosave.queueClose && !note?.id && !hasContent && !saving && discard()) { onClose(); return; }
    setClosing(true);
    try {
      if (autosave.queueClose) {
        if (await autosave.queueClose()) onClose({ refresh: accessLost }); else setShowClose(true);
        return;
      }
      const saved = await flush();
      if (saved) onClose(); else setShowClose(true);
    } finally { setClosing(false); }
  };
  const organize = async changes => {
    if (busy || note?.deletedAt) return;
    setBusy(true); setActionError('');
    setOptimisticState(changes);
    try {
      const current = canEdit ? await flush() : note;
      if (!current?.id) { setActionError('Escreva e salve sua nota antes de organizá-la.'); return; }
      const updated = await notesApi(`/${current.id}/state`, { method: 'PATCH', expectedUserId: userId, body: { version: current.state.version, ...changes } });
      acceptMutation(updated);
    } catch (err) { setActionError(err.status === 409 ? 'Sua organização mudou em outra aba. Atualize a nota antes de tentar novamente.' : err.message); }
    finally { setOptimisticState(null); setBusy(false); }
  };
  const share = async () => { setBusy(true); const current = await flush(); setBusy(false); if (current?.id) setShareNote(current); else setActionError('Salve o conteúdo da nota para compartilhar.'); };
  const trash = async () => { setBusy(true); try { const current = await flush(); if (current?.id) { const moved = await onTrash(current); if (moved) onClose(); } } finally { setBusy(false); } };
  const copy = async () => { try { await navigator.clipboard.writeText(copyDraftText()); notify.success('Rascunho copiado.'); } catch { notify.error('Não foi possível copiar. Selecione o rascunho abaixo e copie manualmente.'); setShowCompare(true); } };
  const reloadCurrent = async () => { setBusy(true); try { await reload(); setShowCompare(false); } finally { setBusy(false); } };
  const savedLabel = leaving ? 'Saindo…' : saving ? (autosave.persistent ? 'Sincronizando…' : 'Salvando…') : conflict ? 'Conflito de edição' : error ? (autosave.persistent ? 'Pendente de sincronização' : 'Não foi salvo') : note?.deletedAt ? 'Na lixeira' : !canEdit ? 'Somente leitura' : (dirty || autosave.pending) ? (autosave.persistent ? (autosave.localSaved ? 'Cópia local guardada · envio pendente' : 'Guardando cópia local…') : 'Alterações pendentes') : note?.id ? 'Todas as alterações salvas' : 'Sua ideia começa aqui';
  const isShared = !note || note.role !== 'OWNER' || note.access?.length > 0;
  const sharingLabel = !note ? 'Equipe · compartilhada ao salvar'
    : note.role !== 'OWNER' ? `${note.owner?.nome || 'Equipe'} · ${note.role === 'EDITOR' ? 'Pode editar' : 'Pode visualizar'}`
      : isShared ? `${(note.access?.length || 0) + 1} participantes` : 'Somente você';
  return <>
    <NoteDialog editor titleId="note-editor-title" onClose={safeClose}>
      <header className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b border-slate-100 shrink-0"><div className="flex-1 flex items-center gap-2 text-xs text-slate-500">{saving ? <LoaderCircle size={15} className="animate-spin" /> : error || conflict ? <CloudOff size={15} className="text-amber-600" /> : note?.id ? <CheckCheck size={15} className="text-[#315b78]" /> : <Cloud size={15} />}<span role="status" aria-live="polite">{savedLabel}</span></div>{note?.id && !note.deletedAt && <button className="note-icon" aria-label={state.isPinned ? 'Desafixar nota' : 'Fixar nota'} title={state.isPinned ? 'Desafixar' : 'Fixar'} aria-pressed={Boolean(state.isPinned)} disabled={busy || saving} onClick={() => organize({ isPinned: !state.isPinned })}><Pin size={18} /></button>}<button className="note-icon" aria-label="Fechar nota" onClick={safeClose} disabled={busy}><X size={21} /></button></header>
      <div className="note-editor-body" style={{ background: noteBackground(state.color) }}>
        <div className="p-5 sm:p-7 pb-5">
          <h2 id="note-editor-title" className="sr-only">{initialNote ? 'Editar nota' : 'Nova nota'} {form.kind === 'CHECKLIST' || kind === 'CHECKLIST' ? 'em checklist' : 'de texto'}</h2>
          {note?.deletedAt && <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 mb-5">Esta nota está na lixeira. Restaure para voltar a editar e compartilhar.</div>}
          {remoteChanged && !conflict && <div className="rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-800 p-3 mb-4 flex items-start gap-2"><AlertTriangle size={17} className="shrink-0 mt-0.5" /><div>A nota foi atualizada por outra pessoa. Seu rascunho foi preservado.<button className="block underline mt-1" onClick={() => setShowCompare(true)}>Comparar versões</button></div></div>}
          {(conflict || error) && <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 mb-4" role="alert"><p className="font-medium">{conflict ? 'Outra versão foi salva antes da sua.' : (autosave.persistent && !autosave.draftWarning ? 'Sua cópia está guardada neste navegador.' : 'Seu rascunho continua nesta aba.')}</p><p className="text-xs leading-5 mt-1">{conflict ? 'Compare o conteúdo antes de carregar a versão atual. Suas alterações não serão enviadas por cima dela.' : error.message || 'Não foi possível salvar.'}</p><div className="flex flex-wrap gap-2 mt-2"><button className="note-button !text-xs" onClick={copy}><Copy size={14} />Copiar rascunho</button>{conflict ? <button className="note-button !text-xs" onClick={() => setShowCompare(true)}>Comparar versões</button> : <button className="note-button !text-xs" disabled={saving} onClick={retry}><RotateCcw size={14} />Tentar novamente</button>}</div></div>}
          {draftWarning && <p role="alert" className="mb-4 text-xs text-amber-800 bg-amber-50 p-3 rounded-xl">{draftWarning}</p>}
          <input data-autofocus value={form.title || ''} onChange={event => setField('title', event.target.value)} disabled={!canEdit || busy} maxLength={250} aria-label="Título da nota, opcional" placeholder="Título" className="bg-transparent w-full text-[23px] leading-8 font-semibold outline-none placeholder:text-slate-400 disabled:opacity-100" />
          {(form.kind || note?.kind || kind) === 'CHECKLIST' ? <div className="mt-3"><NoteRichText value={form.content || ''} onChange={value => setField('content', value)} disabled={!canEdit || busy} label="Descrição da lista, opcional" toolbarTarget={toolbarTarget} onCloseToolbar={closeFormat} /><NoteChecklist items={form.items || []} onChange={setItems} disabled={!canEdit || busy} /></div> : <NoteRichText value={form.content || ''} onChange={value => setField('content', value)} disabled={!canEdit || busy} toolbarTarget={toolbarTarget} onCloseToolbar={closeFormat} />}
          <div className="flex items-center justify-between gap-2 mt-5 text-[11px] text-slate-400"><span className="flex items-center gap-1.5">{isShared ? <Users size={13} /> : <LockKeyhole size={13} />}{sharingLabel}</span>{(form.kind || kind) !== 'CHECKLIST' && <span>{noteContentText(form.content || '').length.toLocaleString('pt-BR')}/20.000</span>}</div>
        </div>
        {!note?.deletedAt && <div className="border-t border-[#172f430a] px-5 sm:px-7 py-4 space-y-4">
          <div className="flex items-center flex-wrap gap-2"><span className="text-xs text-slate-500 mr-2">Cor pessoal</span>{noteColors.map(color => <button key={color.id} className="note-swatch" style={{ background: noteBackground(color.id) }} aria-label={color.label} title={color.label} aria-pressed={(state.color || 'default') === color.id} disabled={busy || saving} onClick={() => organize({ color: color.id })}>{(state.color || 'default') === color.id && <Check size={14} />}</button>)}</div>
          {!!note?.labels?.length && <div className="flex flex-wrap gap-1.5">{note.labels.map(label => <span className="note-label" key={label.id}><Tag size={11} />{label.name}</span>)}</div>}
          {showLabels && <fieldset className="rounded-xl bg-white/60 p-3 border border-[#172f4312]"><legend className="text-xs text-slate-500 px-1">Seus marcadores · até 10 por nota</legend>{labels.length ? <div className="flex flex-wrap gap-3">{labels.map(label => { const selected = note?.labels?.some(value => value.id === label.id); return <label key={label.id} className="flex gap-2 text-sm items-center py-1"><input type="checkbox" className="accent-[#315b78]" checked={Boolean(selected)} disabled={busy || (!selected && note?.labels?.length >= 10)} onChange={() => organize({ labelIds: selected ? (note?.labels || []).filter(value => value.id !== label.id).map(value => value.id) : [...(note?.labels || []).map(value => value.id), label.id] })} />{label.name}</label>; })}</div> : <p className="text-xs text-slate-500">Crie marcadores no menu “Marcadores” da tela de notas.</p>}</fieldset>}
        </div>}
        {actionError && <p role="alert" className="text-sm text-red-700 bg-red-50 mx-5 mb-4 p-3 rounded-xl">{actionError}</p>}
      </div>
      <footer className="flex flex-wrap items-center gap-1 p-3 sm:px-5 border-t border-slate-100 bg-white shrink-0 mobile-safe-bottom">
        <div id="note-format-options" ref={setToolbarTarget} className="note-format-options" hidden={!showFormat || !canEdit || busy} />
        {note?.deletedAt ? <><button className="note-button" onClick={async () => { if (await onRestore(note)) onClose(); }}><RotateCcw size={16} />Restaurar</button><button className="note-icon hover:!text-red-600" onClick={async () => { if (await onDelete(note)) onClose(); }} aria-label="Excluir definitivamente" title="Excluir definitivamente"><Trash2 size={17} /></button></> : <>
          {canEdit && <button ref={formatButton} type="button" className="note-icon" disabled={busy} aria-label="Formatação do texto" title="Formatação do texto" aria-expanded={showFormat} aria-controls="note-format-options" aria-pressed={showFormat} onMouseDown={event => event.preventDefault()} onClick={() => setShowFormat(value => !value)}><Baseline size={18} /></button>}
          {(!note || note.role === 'OWNER') && <button className="note-icon" disabled={busy || saving || (!note && !hasContent)} onClick={share} title="Compartilhar" aria-label="Compartilhar nota"><Share2 size={18} /></button>}
          <button className="note-icon" onClick={() => setShowLabels(!showLabels)} aria-label="Escolher marcadores" title="Marcadores" aria-expanded={showLabels}><Tag size={18} /></button>
          <button className="note-icon" disabled={busy || saving || (!note && !hasContent)} onClick={() => organize({ archived: !state.archivedAt })} title={state.archivedAt ? 'Desarquivar' : 'Arquivar'} aria-label={state.archivedAt ? 'Desarquivar nota' : 'Arquivar nota'}>{state.archivedAt ? <ArchiveRestore size={18} /> : <Archive size={18} />}</button>
          {note?.role && note.role !== 'OWNER' && <button className="note-icon" disabled={busy || saving} onClick={() => organize({ hidden: !state.hiddenAt })} aria-label={state.hiddenAt ? 'Mostrar novamente' : 'Ocultar para mim'} title={state.hiddenAt ? 'Mostrar novamente' : 'Ocultar para mim'}>{state.hiddenAt ? <Eye size={18} /> : <EyeOff size={18} />}</button>}
          {note?.role === 'OWNER' && <button className="note-icon" disabled={busy || saving} onClick={trash} aria-label="Mover nota para a lixeira" title="Mover para lixeira"><Trash2 size={18} /></button>}
        </>}
        <div className="flex-1" /><button className="note-button note-button-primary" onClick={safeClose} disabled={busy}>{closing ? 'Concluindo…' : canEdit ? 'Concluir' : 'Fechar'}</button>
      </footer>
    </NoteDialog>
    {shareNote && <NoteShareDialog note={shareNote} onClose={() => setShareNote(null)} onSaved={acceptMutation} />}
    {showCompare && <NoteDialog titleId="note-conflict-title" onClose={() => setShowCompare(false)}><div className="p-5 border-b flex items-center"><h2 id="note-conflict-title" className="font-semibold flex-1">Compare antes de continuar</h2><button className="note-icon" onClick={() => setShowCompare(false)} aria-label="Fechar comparação"><X size={20} /></button></div><div className="p-5 space-y-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Seu rascunho</p><textarea readOnly aria-label="Seu rascunho para copiar" value={copyDraftText()} className="note-input min-h-36 text-sm" /></div><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Versão atual recebida</p>{conflict?.title !== undefined ? <div className="p-4 bg-slate-50 rounded-xl text-sm whitespace-pre-wrap break-words max-h-48 overflow-auto"><strong>{conflict.title || 'Sem título'}</strong><p className="mt-2">{conflict.kind === 'CHECKLIST' ? conflict.items?.map(item => `${item.checked ? '☑' : '☐'} ${item.text}`).join('\n') : noteContentText(conflict.content)}</p></div> : <p className="text-sm text-slate-500">Carregue a versão atual para consultar as alterações. Copie seu rascunho antes de continuar.</p>}</div><p className="text-xs text-amber-700">Carregar a versão atual substitui o rascunho aberto. Copie o que deseja preservar.</p><div className="flex flex-wrap justify-end gap-2"><button className="note-button" onClick={copy}><Copy size={15} />Copiar rascunho</button><button className="note-button note-button-primary" disabled={busy} onClick={reloadCurrent}>Carregar versão atual</button></div></div></NoteDialog>}
    {(showClose || navigationBlocked) && <NoteDialog compact titleId="note-pending-title" onClose={() => { setShowClose(false); stay?.(); }}><div className="p-6"><h2 id="note-pending-title" className="font-semibold text-lg">Há alterações pendentes</h2><p className="text-sm text-slate-500 mt-2 leading-6">Você pode tentar salvar, continuar editando ou descartar o rascunho desta nota.</p><div className="flex flex-col gap-2 mt-5"><button className="note-button note-button-primary" disabled={saving || Boolean(conflict)} onClick={async () => { if (navigationBlocked) await saveAndLeave(); else if (await flush()) onClose(); }}>Salvar e sair</button><button className="note-button" disabled={saving} onClick={async () => { if (navigationBlocked) await discardAndLeave(); else if (await discard()) onClose(); }}>Descartar e sair</button><button className="note-button !border-transparent" onClick={() => { setShowClose(false); stay?.(); }}>Continuar editando</button></div></div></NoteDialog>}
  </>;
}

function LegacyNoteEditor(props) {
  const autosave = useNoteAutosave(props);
  return <NoteEditorContent {...props} autosave={autosave} />;
}

function QueuedNoteEditor(props) {
  const sync = useNoteSync();
  const autosave = useQueuedNoteAutosave(props, sync);
  return <NoteEditorContent {...props} autosave={autosave} />;
}

export default function NoteEditor(props) {
  const sync = useNoteSync();
  return sync ? <QueuedNoteEditor {...props} /> : <LegacyNoteEditor {...props} />;
}
