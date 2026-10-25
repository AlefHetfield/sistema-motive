import { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, ArrowLeft, ArrowRight, CheckSquare, ChevronDown, EyeOff, FileClock, LayoutGrid, LayoutList, Lightbulb, LoaderCircle, Plus, Search, SlidersHorizontal, StickyNote, Tag, Trash2, X, Pin, RotateCcw } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import { notesApi, noteLabelsApi } from '../services/api';
import NoteCard from '../components/notes/NoteCard';
import NoteEditor from '../components/notes/NoteEditor';
import NoteDialog from '../components/notes/NoteDialog';
import NoteLabelsDialog from '../components/notes/NoteLabelsDialog';
import NoteDraftsDialog from '../components/notes/NoteDraftsDialog';
import { noteColors } from '../components/notes/noteColors';
import { listNoteDrafts } from '../utils/noteDrafts';
import { mergeNoteSnapshot, reconcileNotePage } from '../utils/noteSnapshots';
import '../components/notes/noteStyles.css';

const views = [
  { id: 'active', name: 'Notas', icon: StickyNote },
  { id: 'archived', name: 'Arquivadas', icon: Archive },
  { id: 'hidden', name: 'Ocultas', icon: EyeOff },
  { id: 'trash', name: 'Lixeira', icon: Trash2 },
];

export default function Notes() {
  const { user } = useAuth();
  const notify = useToast();
  const [view, setView] = useState('active');
  const [scope, setScope] = useState('all');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [color, setColor] = useState('');
  const [labelId, setLabelId] = useState('');
  const [page, setPage] = useState(1);
  const [layout, setLayout] = useState(() => { try { return localStorage.getItem('motive-notes-layout') === 'list' ? 'list' : 'grid'; } catch { return 'grid'; } });
  const [data, setData] = useState(null);
  const [labels, setLabels] = useState([]);
  const [labelsError, setLabelsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState(null);
  const [labelsDialog, setLabelsDialog] = useState(false);
  const [draftsDialog, setDraftsDialog] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [pending, setPending] = useState(new Set());
  const [confirmation, setConfirmation] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const fetchSequence = useRef(0);
  const listRequest = useRef(null);
  const noteCache = useRef(new Map());
  const lastRefresh = useRef(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const refreshDrafts = useCallback(() => setDrafts(user?.id ? listNoteDrafts(user.id) : []), [user?.id]);
  const loadLabels = useCallback(async () => { try { const result = await noteLabelsApi(); setLabels(result); setLabelsError(''); return result; } catch (err) { setLabelsError(err.message); return []; } }, []);
  useEffect(() => { loadLabels(); }, [loadLabels]);
  useEffect(() => {
    refreshDrafts();
    const update = () => { if (!document.hidden) refreshDrafts(); };
    window.addEventListener('focus', update); document.addEventListener('visibilitychange', update);
    return () => { window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update); };
  }, [refreshDrafts]);
  useEffect(() => { const timer = setTimeout(() => { setSearch(query.trim()); setPage(1); }, 250); return () => clearTimeout(timer); }, [query]);
  useEffect(() => {
    const controller = new AbortController();
    listRequest.current = controller;
    const sequence = ++fetchSequence.current;
    setLoading(true); setError('');
    const params = new URLSearchParams(Object.entries({ scope: view === 'trash' ? 'mine' : scope, view, q: search, color, labelId, page: String(page), pageSize: '40' }).filter(([, value]) => value !== ''));
    notesApi(`?${params}`, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted || sequence !== fetchSequence.current) return;
      if (!result.notes.length && result.total > 0 && page > 1) { setPage(value => value - 1); return; }
      for (const note of result.notes) noteCache.current.set(note.id, mergeNoteSnapshot(noteCache.current.get(note.id), note));
      setData({ ...result, criteria: { scope, view, search, color, labelId } });
    }).catch(err => { if (!controller.signal.aborted && sequence === fetchSequence.current) setError(err.message); }).finally(() => {
      if (listRequest.current === controller) listRequest.current = null;
      if (!controller.signal.aborted && sequence === fetchSequence.current) setLoading(false);
    });
    return () => { controller.abort(); if (listRequest.current === controller) listRequest.current = null; };
  }, [scope, view, search, color, labelId, page, revision]);
  useEffect(() => {
    const update = () => {
      if (document.hidden || editor || listRequest.current || Date.now() - lastRefresh.current < 1000) return;
      lastRefresh.current = Date.now(); refresh();
    };
    const timer = setInterval(update, 30000);
    window.addEventListener('focus', update); document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update); };
  }, [refresh, editor]);
  const applyChange = useCallback((note, removed = false) => {
    const previous = noteCache.current.get(note.id);
    const next = removed ? null : mergeNoteSnapshot(previous, note);
    if (!removed && previous && JSON.stringify(previous) === JSON.stringify(next)) return;
    if (removed) noteCache.current.delete(note.id); else noteCache.current.set(note.id, next);
    // A list request started before this confirmed mutation must not resurrect
    // a removed card or replace its newer version. Reconcile that race once.
    if (listRequest.current) {
      listRequest.current.abort(); listRequest.current = null;
      fetchSequence.current++; setLoading(false); refresh();
    }
    setData(current => current ? reconcileNotePage(current, previous, next, current.criteria, user?.id) : current);
  }, [refresh, user?.id]);
  const saved = useCallback(note => applyChange(note), [applyChange]);
  useEffect(() => {
    if (!data || loading || error || listRequest.current) return;
    const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));
    if (page > lastPage) { setPage(lastPage); return; }
    const expected = Math.min(data.pageSize, Math.max(0, data.total - (data.page - 1) * data.pageSize));
    if (data.needsRefresh || data.notes.length < expected) refresh();
  }, [data, loading, error, page, refresh]);
  const chooseView = id => { setView(id); setPage(1); setLabelId(''); setShowNav(false); };
  const open = note => { setEditor({ note, key: note.id, kind: note.kind }); };
  const create = kind => { setPage(1); setEditor({ note: null, kind, key: crypto.randomUUID() }); };
  const closeEditor = (options = {}) => { setEditor(null); if (options.refresh) refresh(); refreshDrafts(); };
  const changeLayout = value => { setLayout(value); try { localStorage.setItem('motive-notes-layout', value); } catch { /* Preference can remain in memory. */ } };
  const markPending = (id, value) => setPending(current => { const next = new Set(current); if (value) next.add(id); else next.delete(id); return next; });
  const changeState = async (note, changes) => {
    markPending(note.id, true);
    try { saved(await notesApi(`/${note.id}/state`, { method: 'PATCH', body: { version: note.state.version, ...changes } })); }
    catch (err) { notify.error(err.status === 409 ? 'Esta nota mudou em outra aba. Atualizamos a lista; tente novamente.' : err.message); refresh(); }
    finally { markPending(note.id, false); }
  };
  const restore = async note => {
    markPending(note.id, true);
    try { saved(await notesApi(`/${note.id}/restore`, { method: 'POST', body: { version: note.version } })); notify.success('Nota restaurada.'); return true; }
    catch (err) { notify.error(err.message); refresh(); return false; }
    finally { markPending(note.id, false); }
  };
  const requestConfirmation = (note, permanent) => new Promise(resolve => { setConfirmError(''); setConfirmation({ note, permanent, resolve }); });
  const cancelConfirmation = () => { if (confirmBusy) return; confirmation?.resolve(false); setConfirmation(null); };
  const confirmAction = async () => {
    const { note, permanent, resolve } = confirmation;
    setConfirmBusy(true); setConfirmError(''); markPending(note.id, true);
    try {
      const moved = await notesApi(`/${note.id}${permanent ? '' : '/trash'}`, { method: permanent ? 'DELETE' : 'POST', body: { version: note.version } });
      applyChange(permanent ? note : moved, permanent);
      setConfirmation(null); resolve(true);
      if (permanent) notify.success('Nota excluída definitivamente.');
      else notify.info('Nota movida para a lixeira.', { action: { label: 'Desfazer', onClick: () => restore(moved) }, duration: 8000 });
    } catch (err) { setConfirmError(err.status === 409 ? 'A nota foi alterada. Cancele e abra a versão atual antes de tentar novamente.' : err.message); refresh(); }
    finally { setConfirmBusy(false); markPending(note.id, false); }
  };
  const pageSize = data?.pageSize || 40;
  const pages = Math.max(1, Math.ceil((data?.total || 0) / pageSize));
  const notes = data?.notes || [];
  const pinned = view === 'active' ? notes.filter(note => note.state?.isPinned) : [];
  const other = view === 'active' ? notes.filter(note => !note.state?.isPinned) : notes;
  const filterActive = Boolean(query || color || labelId || scope !== 'all');
  const viewName = views.find(item => item.id === view)?.name;
  const renderCards = items => <div className={layout === 'grid' ? 'note-grid' : 'note-list'}>{items.map(note => <NoteCard key={note.id} note={note} layout={layout} onOpen={open} onState={changeState} onTrash={item => requestConfirmation(item, false)} onRestore={restore} onDelete={item => requestConfirmation(item, true)} busy={pending.has(note.id)} />)}</div>;
  return <div className="notes-workspace mx-auto max-w-[1600px] p-3 sm:p-5 lg:p-7">
    <div className="flex items-center gap-4 justify-between mb-6"><div><div className="hidden sm:flex items-center gap-2 text-[10px] font-semibold tracking-[.18em] uppercase text-[#315b78] mb-2"><span className="w-5 h-px bg-[#D99A35]" />Seu espaço de ideias</div><h1 className="text-2xl lg:text-[30px] font-semibold tracking-tight">Uma ideia merece espaço.</h1><p className="hidden sm:block text-sm text-slate-500 mt-2">Guarde o que importa. Conecte ideias com sua equipe.</p></div><button className="note-button note-button-primary !px-3 sm:!px-4 !py-2.5 shrink-0" onClick={() => create('TEXT')}><Plus size={18} /><span className="hidden sm:inline">Nova nota</span><span className="sm:hidden">Nova</span></button></div>
    <div className="grid lg:grid-cols-[192px_minmax(0,1fr)] xl:grid-cols-[208px_minmax(0,1fr)] gap-5 lg:gap-8">
      <aside className="min-w-0"><button className="note-button w-full justify-between lg:hidden" aria-controls="notes-navigation" aria-expanded={showNav} onClick={() => setShowNav(!showNav)}><span className="flex items-center gap-2"><StickyNote size={17} />{viewName}</span><ChevronDown size={16} className={showNav ? 'rotate-180' : ''} /></button><div id="notes-navigation" className={`${showNav ? 'block' : 'hidden'} lg:block pt-3 lg:pt-0`}><nav aria-label="Visualizações de notas" className="space-y-1">{views.map(item => { const { id, name, icon: Icon } = item; return <button key={id} onClick={() => chooseView(id)} aria-current={view === id ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-xl text-sm px-3.5 py-3 ${view === id ? 'bg-[#315b7810] text-[#315b78] font-semibold' : 'text-slate-500 hover:bg-white'}`}><Icon size={18} />{name}{id === 'active' && <span className={`ml-auto h-1.5 w-1.5 rounded-full ${view === id ? 'bg-[#D99A35]' : 'bg-slate-300'}`} />}</button>; })}</nav><div className="border-t border-[#dde4e8] mt-5 pt-5"><div className="flex items-center justify-between pl-3 mb-2"><h2 className="text-[10px] text-slate-400 uppercase tracking-[.14em] font-semibold">Seus marcadores</h2><button className="note-icon !h-8 !w-8 !min-h-8 !min-w-8" onClick={() => setLabelsDialog(true)} aria-label="Gerenciar marcadores" title="Gerenciar marcadores"><Plus size={15} /></button></div>{labels.map(label => <button key={label.id} className={`flex items-center gap-2.5 w-full px-3.5 py-2 rounded-xl text-sm ${String(labelId) === String(label.id) ? 'text-[#315b78] bg-[#315b7810]' : 'text-slate-500 hover:bg-white'}`} onClick={() => { setLabelId(String(labelId) === String(label.id) ? '' : String(label.id)); setPage(1); setShowNav(false); }} aria-pressed={String(labelId) === String(label.id)}><Tag size={14} className="shrink-0" /><span className="truncate">{label.name}</span></button>)}{!labels.length && <p className="text-xs text-slate-400 leading-5 px-3">Organize por assunto, projeto ou inspiração.</p>}<button className="flex gap-2 items-center text-xs text-[#315b78] px-3 py-3 font-medium" onClick={() => setLabelsDialog(true)}><Tag size={14} />Gerenciar marcadores</button>{labelsError && <button className="text-xs text-red-600 px-3 text-left" onClick={loadLabels}>Falha ao carregar marcadores. Tentar novamente.</button>}</div><div className="hidden lg:block mt-7 rounded-2xl border border-[#e8e4d9] bg-[#faf8f1] p-4"><Lightbulb size={20} className="text-[#ad7d2e] mb-2" /><p className="text-xs leading-5 text-[#7a735e]">As melhores ideias às vezes começam com uma pequena anotação.</p></div></div></aside>
      <main className="min-w-0">{drafts.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 mb-5 flex flex-wrap items-center gap-3"><FileClock size={18} className="text-amber-700 shrink-0" /><p className="text-xs text-amber-800 flex-1 min-w-40">{drafts.length === 1 ? 'Há um rascunho local pendente.' : `Há ${drafts.length} rascunhos locais pendentes.`}</p><button className="note-button !text-xs" onClick={() => { refreshDrafts(); setDraftsDialog(true); }}>Recuperar rascunhos</button></div>}
        <div className="flex flex-wrap gap-3 items-center mb-5"><div className="relative flex-1 min-w-[180px]"><Search size={18} className="absolute left-3.5 top-3 text-slate-400" /><input className="note-input !pl-10 !pr-10 shadow-sm" placeholder="Buscar nas suas notas…" aria-label="Buscar em títulos, texto e itens" value={query} onChange={event => setQuery(event.target.value)} />{query && <button className="absolute right-1 top-0.5 note-icon" onClick={() => setQuery('')} aria-label="Limpar busca"><X size={16} /></button>}</div><button className="note-icon !bg-white border border-[#dde4e8]" onClick={() => setShowFilters(!showFilters)} aria-label="Mostrar filtros de notas" title="Filtros" aria-expanded={showFilters} aria-pressed={showFilters}><SlidersHorizontal size={18} /></button><div className="flex rounded-xl border border-[#dde4e8] bg-white p-0.5" role="group" aria-label="Layout das notas"><button className="note-icon !min-h-9 !h-9 !w-9 !min-w-9" onClick={() => changeLayout('grid')} aria-label="Visualizar em grade" title="Grade" aria-pressed={layout === 'grid'}><LayoutGrid size={17} /></button><button className="note-icon !min-h-9 !h-9 !w-9 !min-w-9" onClick={() => changeLayout('list')} aria-label="Visualizar em lista" title="Lista" aria-pressed={layout === 'list'}><LayoutList size={18} /></button></div></div>
        {showFilters && <div className="rounded-2xl border border-[#dde4e8] bg-white p-4 mb-5 flex flex-wrap gap-4 items-end"><label className="flex-1 min-w-36 text-xs text-slate-500">Cor<select className="note-input mt-1.5 !text-sm" value={color} onChange={event => { setColor(event.target.value); setPage(1); }}><option value="">Todas as cores</option>{noteColors.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="flex-1 min-w-36 text-xs text-slate-500">Marcador<select className="note-input mt-1.5 !text-sm" value={labelId} onChange={event => { setLabelId(event.target.value); setPage(1); }}><option value="">Todos os marcadores</option>{labels.map(label => <option value={label.id} key={label.id}>{label.name}</option>)}</select></label><button className="note-button" onClick={() => { setColor(''); setLabelId(''); setQuery(''); setScope('all'); setPage(1); }}>Limpar filtros</button></div>}
        {view === 'active' && !search && <div className="rounded-2xl bg-white border border-[#d9e2e8] shadow-sm flex items-center gap-2 p-2 sm:p-3 mb-6"><button className="flex items-center gap-3 text-left flex-1 min-w-0 px-2 sm:px-3 text-sm text-slate-400 py-2" onClick={() => create('TEXT')}><Plus size={20} className="text-[#315b78] shrink-0" /><span className="truncate">Criar uma nota…</span></button><span className="w-px bg-slate-200 h-6" /><button className="note-button !border-0 !text-xs !bg-[#f5f8fa] shrink-0" onClick={() => create('CHECKLIST')}><CheckSquare size={17} /><span className="hidden sm:inline">Nova lista</span><span className="sm:hidden">Lista</span></button></div>}
        <div className="flex flex-wrap items-center gap-3 justify-between mb-5"><div className="flex gap-1 rounded-xl bg-[#eaf0f4] p-1" role="group" aria-label="Origem das notas">{[['all', 'Todas'], ['mine', 'Minhas'], ['shared', 'Compartilhadas']].map(([id, name]) => <button key={id} disabled={view === 'trash' && id !== 'mine'} className={`rounded-lg text-xs px-3 sm:px-4 py-2 transition ${(view === 'trash' ? 'mine' : scope) === id ? 'bg-white text-[#315b78] shadow-sm font-semibold' : 'text-slate-500 disabled:opacity-40'}`} aria-pressed={(view === 'trash' ? 'mine' : scope) === id} onClick={() => { setScope(id); setPage(1); }}>{name}</button>)}</div><p className="text-xs text-slate-400 flex items-center gap-2">{loading && <LoaderCircle size={13} className="animate-spin" />}{data ? `${data.total} ${data.total === 1 ? 'nota' : 'notas'}` : 'Carregando…'}</p></div>
        {view === 'trash' && <div className="rounded-xl bg-[#fff7e5] border border-[#eee3c8] p-3 text-xs leading-5 text-[#856a38] mb-5">A lixeira contém apenas notas criadas por você. Restaurar recupera o acesso dos participantes; a exclusão definitiva é manual.</div>}
        {view === 'hidden' && <p className="text-sm text-slate-500 mb-5">Notas compartilhadas que você ocultou. Mostre novamente quando precisar delas.</p>}
        {view === 'archived' && <p className="text-sm text-slate-500 mb-5">Suas notas arquivadas continuam disponíveis para os outros participantes.</p>}
        {error && <div role="alert" className="border border-red-100 bg-red-50 text-red-700 p-4 rounded-xl mb-5 flex flex-wrap gap-3 items-center"><p className="text-sm flex-1">{error}</p><button className="note-button" onClick={refresh}><RotateCcw size={15} />Tentar novamente</button></div>}
        {loading && !data ? <div className="note-grid" aria-label="Carregando notas">{[1, 2, 3].map(id => <div key={id} className="rounded-2xl border border-slate-200 p-5 bg-white animate-pulse h-48"><div className="bg-slate-100 rounded h-4 w-2/3" /><div className="bg-slate-100 rounded h-3 mt-5" /><div className="bg-slate-100 rounded h-3 mt-3 w-4/5" /></div>)}</div> : !error && <>
          {pinned.length > 0 && <section aria-labelledby="notes-pinned-title" className="mb-7"><h2 id="notes-pinned-title" className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.15em] text-slate-400 mb-3"><Pin size={12} />Fixadas</h2>{renderCards(pinned)}</section>}
          {other.length > 0 && <section aria-label={pinned.length ? 'Outras notas' : viewName}>{pinned.length > 0 && <h2 className="text-[10px] font-semibold uppercase tracking-[.15em] text-slate-400 mb-3">Outras notas</h2>}{renderCards(other)}</section>}
          {!notes.length && <div className="text-center py-16 sm:py-20 rounded-2xl border border-dashed border-[#d5dfe6] bg-white/50"><div className="bg-[#edf2f6] rounded-2xl w-16 h-16 mx-auto flex items-center justify-center mb-5"><StickyNote size={28} strokeWidth={1.4} className="text-[#315b78]" /></div><h2 className="text-lg font-medium">{filterActive ? 'Nenhuma nota por aqui' : view === 'active' ? 'Dê espaço à sua primeira ideia' : view === 'trash' ? 'Sua lixeira está vazia' : view === 'hidden' ? 'Nenhuma nota oculta' : 'Nenhuma nota arquivada'}</h2><p className="text-sm text-slate-500 mt-2 px-5">{filterActive ? 'Experimente outra busca ou ajuste os filtros.' : view === 'active' ? 'Uma inspiração, um lembrete ou uma lista. Comece por aqui.' : 'As notas desta visualização aparecerão aqui.'}</p>{view === 'active' && !filterActive && <button className="note-button note-button-primary mt-5" onClick={() => create('TEXT')}><Plus size={16} />Criar minha primeira nota</button>}</div>}
        </>}
        {pages > 1 && <nav aria-label="Páginas de notas" className="flex items-center justify-center gap-4 mt-7"><button className="note-icon border bg-white" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)} aria-label="Página anterior"><ArrowLeft size={18} /></button><span className="text-xs text-slate-500">{page} de {pages}</span><button className="note-icon border bg-white" disabled={loading || page >= pages} onClick={() => setPage(value => value + 1)} aria-label="Próxima página"><ArrowRight size={18} /></button></nav>}
      </main>
    </div>
    {editor && <NoteEditor key={editor.key} initialNote={editor.note} kind={editor.kind} userId={user?.id} labels={labels} onSaved={saved} onClose={closeEditor} onTrash={note => requestConfirmation(note, false)} onRestore={restore} onDelete={note => requestConfirmation(note, true)} />}
    {draftsDialog && <NoteDraftsDialog drafts={drafts} onChanged={refreshDrafts} onClose={() => setDraftsDialog(false)} />}
    {labelsDialog && <NoteLabelsDialog labels={labels} onChanged={async () => { const current = await loadLabels(); if (labelId && !current.some(label => String(label.id) === String(labelId))) setLabelId(''); refresh(); }} onClose={() => setLabelsDialog(false)} />}
    {confirmation && <NoteDialog compact titleId="note-delete-title" onClose={cancelConfirmation}><div className="p-6"><div className="rounded-xl bg-red-50 text-red-500 p-3 inline-flex mb-4"><Trash2 size={22} /></div><h2 id="note-delete-title" className="text-lg font-semibold">{confirmation.permanent ? 'Excluir esta nota definitivamente?' : 'Mover esta nota para a lixeira?'}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{confirmation.permanent ? 'A nota será excluída para todos os participantes. Esta ação não pode ser desfeita.' : 'Todos os participantes perderão o acesso enquanto a nota estiver na lixeira. Você poderá restaurá-la depois.'}</p>{confirmError && <p className="mt-3 text-sm text-red-600" role="alert">{confirmError}</p>}<div className="mt-6 flex flex-wrap justify-end gap-2"><button className="note-button" disabled={confirmBusy} onClick={cancelConfirmation}>Cancelar</button><button className="note-button !bg-red-600 !border-red-600 !text-white" disabled={confirmBusy} onClick={confirmAction}>{confirmBusy ? 'Aguarde…' : confirmation.permanent ? 'Excluir definitivamente' : 'Mover para a lixeira'}</button></div></div></NoteDialog>}
  </div>;
}
