import useMobileLayout from '../hooks/useMobileLayout';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import TaskPropertyCard from '../components/TaskPropertyCard';
import { Check, Circle, Star, Sun, ListTodo, CalendarDays, Clock, Plus, Search, Trash2, Users, UserRound, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { taskApi } from '../services/api';
import TaskEditor from '../components/TaskEditor';
import FancySelect from '../components/FancySelect';
import { taskToday, taskDateLabel } from '../utils/taskDates';

const views = [['all','Tarefas',ListTodo],['day','Meu dia',Sun],['important','Importantes',Star],['overdue','Atrasadas',Clock],['planned','Planejadas',CalendarDays],['waiting','Aguardando retorno',UserRound],['social','Redes Sociais',Users],['delegated','Delegadas por mim',Users],['done','Concluídas',Check]];
const today = taskToday;
const statusLabels = { TODO: 'Pendente', IN_PROGRESS: 'Pendente', WAITING: 'Aguardando retorno', DONE: 'Concluída' };
const inputClass = 'rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary';

export default function Tasks() {
  const [params, setParams] = useSearchParams();
  const mobile = useMobileLayout();
  const [showTaskLists, setShowTaskLists] = useState(false);
  const [openActionTaskId, setOpenActionTaskId] = useState(null);
  const clientId = params.get('client') || '';
  const linkedTaskId = params.get('task') || '';
  const [options, setOptions] = useState(null);
  const [view, setView] = useState(() => params.get('view') === 'social' ? 'social' : 'all');
  const [socialOrder, setSocialOrder] = useState('date');
  const [socialDone, setSocialDone] = useState(false);
  const [initialProperty, setInitialProperty] = useState(null);
  const newPropertyId = params.get('newProperty') || '';
  useEffect(() => {
    if (!newPropertyId) return;
    const controller = new AbortController();
    setView('social'); setInitialProperty(null); setEditor(null);
    taskApi(`/properties?id=${encodeURIComponent(newPropertyId)}`, { signal: controller.signal }).then(items => {
      if (!items.length) throw new Error('Imóvel não encontrado.');
      setInitialProperty(items[0]); setEditor({ new: true });
    }).catch(err => { if (!controller.signal.aborted) toast.error(err.message); });
    return () => controller.abort();
  }, [newPropertyId]);
  const [delegatedStatus, setDelegatedStatus] = useState('pending');
  const [listId, setListId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [optionsRevision, setOptionsRevision] = useState(0);
  const pendingChanges = useRef(new Map());
  const mutationRevision = useRef(0);
  const mounted = useRef(true);
  const [optimisticChanges, setOptimisticChanges] = useState(new Map());
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    const refresh = () => { if (!document.hidden) { setRevision(value => value + 1); setOptionsRevision(value => value + 1); } };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);
  const [currentDay, setCurrentDay] = useState(taskToday);
  useEffect(() => { const timer = setInterval(() => setCurrentDay(taskToday()), 60000); return () => clearInterval(timer); }, []);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newList, setNewList] = useState('');
  const [shared, setShared] = useState(false);
  const [listForm, setListForm] = useState(false);
  const [initialClient, setInitialClient] = useState(null);
  const taskViewRef = useRef(null);
  const queryKeyRef = useRef('');
  taskViewRef.current = { view, socialDone, delegatedStatus, assigneeId, clientId, listId, search, userId: options?.userId };
  queryKeyRef.current = JSON.stringify([view, socialDone, delegatedStatus, assigneeId, clientId, listId, search, page]);
  useEffect(() => {
    if (!linkedTaskId) return;
    const controller = new AbortController();
    setEditor(null);
    taskApi(`/${encodeURIComponent(linkedTaskId)}`, { signal: controller.signal }).then(setEditor).catch(err => {
      if (!controller.signal.aborted) toast.error(err.message);
    });
    return () => controller.abort();
  }, [linkedTaskId]);
  const closeEditor = () => {
    setEditor(null);
    setInitialProperty(null);
    if (linkedTaskId || newPropertyId) setParams(current => { const next = new URLSearchParams(current); next.delete('task'); next.delete('newProperty'); return next; }, { replace: true });
  };
  const reload = () => setRevision(value => value + 1);
  useEffect(() => {
    const controller = new AbortController();
    taskApi('/options', { signal: controller.signal }).then(setOptions).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [optionsRevision]);
  useEffect(() => {
    // A refresh must not replace a pending change with an older server snapshot.
    // The last mutation triggers one refresh for the whole batch.
    if (pendingChanges.current.size) return;
    const controller = new AbortController();
    const startedAtRevision = mutationRevision.current;
    const filters = new URLSearchParams({ view, ...(view === 'social' ? { status: socialDone ? 'done' : 'pending', order: socialOrder } : {}), ...(view === 'delegated' ? { status: delegatedStatus } : {}), page: String(page), ...(listId ? { listId } : {}), ...(assigneeId ? { assigneeId } : {}), ...(clientId ? { clientId } : {}), ...(search ? { q:search } : {}) });
    const isCurrent = () => !controller.signal.aborted && startedAtRevision === mutationRevision.current;
    taskApi(`?${filters}`, { signal:controller.signal }).then(result => { if (isCurrent()) { setData(result); setError(''); } }).catch(err => { if (isCurrent()) setError(err.message); }).finally(() => { if (isCurrent()) setLoading(false); });
    return () => controller.abort();
  }, [view, listId, assigneeId, clientId, search, page, revision, currentDay, delegatedStatus, socialDone, socialOrder]);
  useEffect(() => {
    if (!clientId || !options?.canReadClients) return;
    const controller = new AbortController();
    taskApi(`/clients?id=${clientId}`, { signal:controller.signal }).then(clients => setInitialClient(clients[0] || null)).catch(() => {});
    return () => controller.abort();
  }, [clientId, options?.canReadClients]);
  const filter = (nextView, nextList = '') => {
    setShowTaskLists(false);
    if (nextView === view && nextList === listId && page === 1) return;
    setView(nextView); setListId(nextList); setPage(1); setLoading(true);
  };
  const taskIsVisible = task => {
    if (!task || task.deletedAt) return false;
    const { view: currentView, socialDone: showSocialDone, delegatedStatus: currentDelegatedStatus, assigneeId: currentAssigneeId, clientId: currentClientId, listId: currentListId, search: currentSearch, userId } = taskViewRef.current;
    const taskAssigneeId = String(task.assigneeId ?? task.assignee?.id ?? '');
    if (currentAssigneeId && taskAssigneeId !== currentAssigneeId) return false;
    if (currentClientId && String(task.clientId ?? task.client?.id ?? '') !== currentClientId) return false;
    if (currentListId && String(task.listId ?? task.list?.id ?? '') !== currentListId) return false;
    if (currentSearch && !task.title.toLocaleLowerCase('pt-BR').includes(currentSearch.toLocaleLowerCase('pt-BR'))) return false;
    if (currentView === 'social') return task.category === 'SOCIAL' && (showSocialDone ? task.status === 'DONE' : task.status !== 'DONE');
    if (currentView === 'done') return task.status === 'DONE';
    if (currentView === 'delegated') {
      if (String(task.delegatedById ?? '') !== String(userId ?? '') || taskAssigneeId === String(userId ?? '')) return false;
      return currentDelegatedStatus === 'all' || (currentDelegatedStatus === 'done' ? task.status === 'DONE' : task.status !== 'DONE');
    }
    if (task.status === 'DONE') return false;
    if (currentView === 'day') return task.myDay?.slice(0, 10) === today() && taskAssigneeId === String(userId ?? '');
    if (currentView === 'important') return task.important;
    if (currentView === 'overdue') return Boolean(task.dueDate && task.dueDate.slice(0, 10) < today());
    if (currentView === 'planned') return Boolean(task.dueDate);
    if (currentView === 'waiting') return task.status === 'WAITING';
    return true;
  };
  const reconcileTask = saved => {
    setData(current => {
      if (!current) return current;
      const existed = current.tasks.some(item => item.id === saved.id);
      const visible = taskIsVisible(saved);
      const tasks = visible
        ? existed ? current.tasks.map(item => item.id === saved.id ? saved : item) : [saved, ...current.tasks]
        : current.tasks.filter(item => item.id !== saved.id);
      const total = Math.max(0, current.total + (visible && !existed ? 1 : !visible && existed ? -1 : 0));
      return { ...current, tasks, total, pages: Math.ceil(total / 50) };
    });
  };
  const changeTask = async (task, patch, undo = false) => {
    if (busy || pendingChanges.current.has(task.id)) return;
    const startedQueryKey = queryKeyRef.current;
    mutationRevision.current += 1;
    pendingChanges.current.set(task.id, patch);
    setOptimisticChanges(new Map(pendingChanges.current));
    try {
      const saved = await taskApi(`/${task.id}`, { method:'PATCH', body:{...patch,version:task.version} });
      if (!mounted.current) return;
      if (startedQueryKey === queryKeyRef.current) reconcileTask(saved);
      else reload();
      if (undo) toast.success(patch.remove ? 'Tarefa removida.' : 'Tarefa concluída.', { action:{label:'Desfazer',onClick:async () => {
        if (!mounted.current) return;
        await changeTask(saved, patch.remove ? {restore:true} : {status:task.status});
      } } });
    } catch(err) {
      if (mounted.current) toast.error(err.message);
    } finally {
      pendingChanges.current.delete(task.id);
      if (mounted.current) {
        setOptimisticChanges(new Map(pendingChanges.current));
      }
    }
  };
  const quickCreate = async event => {
    event.preventDefault(); if (!newTitle.trim() || !options || creatingTask) return;
    const startedQueryKey = queryKeyRef.current;
    setCreatingTask(true);
    try {
      const body = { title:newTitle.trim(), ...(view === 'social' ? { category: 'SOCIAL' } : {}), assigneeId: Number(assigneeId) || options.userId,
        ...(listId ? {listId:Number(listId)} : {}), ...(clientId ? {clientId:Number(clientId)} : {}),
        ...(view === 'day' ? {myDay:today(),assigneeId:options.userId} : {}), ...(view === 'important' ? {important:true} : {}), ...(view === 'waiting' ? {status:'WAITING'} : {}) };
      const created = await taskApi('',{method:'POST',body});
      if (startedQueryKey === queryKeyRef.current) reconcileTask(created);
      else reload();
      setNewTitle(''); toast.success('Tarefa criada.');
    } catch(err) {toast.error(err.message);} finally {setCreatingTask(false);}
  };
  const createList = async event => {
    event.preventDefault(); if (busy) return; setBusy(true);
    try { const list=await taskApi('/lists',{method:'POST',body:{name:newList,shared}}); setNewList('');setListForm(false);setOptionsRevision(value => value + 1);reload();filter('all',String(list.id)); }
    catch(err){toast.error(err.message);}finally{setBusy(false);}
  };
  const activeList = options?.lists.find(list=>String(list.id)===listId);
  const canReorder = view === 'social' && socialOrder === 'manual' && !socialDone && options?.canManageAll && !assigneeId && !clientId && !search;
  const movePublication = async (task, direction) => {
    if (busy || pendingChanges.current.size) return;
    setBusy(true);
    try { await taskApi(`/${task.id}/social-order`, { method: 'PATCH', body: { version: task.version, direction } }); }
    catch (err) { toast.error(err.message); }
    finally { setBusy(false); reload(); }
  };
  return <div className="task-page mx-auto max-w-[1500px] p-3 sm:p-4 md:p-7">
    <div className="mb-3 flex items-center justify-between gap-3 lg:mb-6 lg:flex-wrap lg:gap-4"><div className="min-w-0"><p className="hidden text-xs font-semibold uppercase tracking-widest text-primary lg:block">Organize sua rotina</p><h2 className="truncate text-lg font-bold text-slate-900 lg:mt-1 lg:text-3xl">{mobile ? (activeList?.name || views.find(item => item[0] === view)?.[1]) : 'Cada tarefa, um próximo passo.'}</h2><p className="mt-2 hidden text-sm text-gray-500 lg:block">{options?.canManageAll ? 'Acompanhe suas prioridades e as tarefas da equipe.' : 'Seu espaço para acompanhar as tarefas atribuídas a você.'}</p></div><button type="button" disabled={!options} onClick={()=>setEditor({new:true})} className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40 lg:px-4 lg:py-3"><Plus size={18}/> {view === 'social' ? 'Nova publicação' : 'Nova tarefa'}</button></div>
    {mobile && <button type="button" aria-expanded={showTaskLists} aria-controls="task-lists" onClick={() => setShowTaskLists(value => !value)} className="mb-3 flex min-h-10 w-full items-center justify-between rounded-xl border bg-white px-3 py-2 text-left text-sm font-semibold text-primary"><span>Lista e visualização</span><span>{showTaskLists ? 'Fechar' : 'Trocar'}</span></button>}
    <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside id="task-lists" hidden={mobile && !showTaskLists} className="self-start rounded-2xl border border-gray-200 bg-white p-3"><nav aria-label="Listas de tarefas" className="space-y-1">{views.filter(item => item[0] !== 'delegated' || options?.canManageAll).map(item=>{const [key,label,Icon]=item; return <button key={key} type="button" onClick={()=>filter(key)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm ${view===key&&!listId?'bg-primary/10 font-semibold text-primary':'text-gray-600 hover:bg-gray-50'}`}><Icon size={18}/>{label}</button>;})}</nav>
        <div className="mt-4 border-t pt-4"><p className="mb-2 px-3 text-xs font-semibold uppercase text-gray-400">Suas listas</p>{options?.lists.map(list=><button key={list.id} type="button" onClick={()=>filter('all',String(list.id))} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${listId===String(list.id)?'bg-primary/10 text-primary':'text-gray-600'}`}>{list.shared?<Users size={15}/>:<ListTodo size={15}/>}<span className="truncate">{list.name}</span></button>)}<button type="button" onClick={()=>setListForm(!listForm)} className="mt-2 flex items-center gap-2 px-3 py-2 text-sm font-semibold text-primary"><Plus size={16}/> Criar lista</button>{listForm&&<form onSubmit={createList} className="space-y-2 p-2"><input required maxLength={80} aria-label="Nome da lista" value={newList} onChange={e=>setNewList(e.target.value)} placeholder="Nome da lista" className={`${inputClass} w-full`}/>{options?.canManageAll&&<label className="flex gap-2 text-xs"><input type="checkbox" checked={shared} onChange={e=>setShared(e.target.checked)}/> Compartilhar com a equipe</label>}<button disabled={busy} className="rounded-lg bg-primary px-3 py-2 text-xs text-white">Criar</button></form>}</div>
      </aside>
      <main className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="hidden text-xl font-bold text-slate-800 lg:block">{activeList?.name||views.find(item=>item[0]===view)?.[1]} <span className="text-sm font-normal text-gray-400">{!loading&&data?`(${data.total})`:''}</span></h3>{mobile && !loading && data && <p className="text-xs font-semibold text-gray-500">{data.total} tarefa(s)</p>}{options?.canManageAll&&view!=='day'&&<FancySelect className={mobile ? 'w-full' : 'min-w-52'} size="compact" ariaLabel="Filtrar responsável" value={String(assigneeId)} onChange={value=>{setAssigneeId(value);setPage(1);setLoading(true);}} placeholder="Toda a equipe" options={[{ value: '', label: 'Toda a equipe' }, ...options.users.map(user=>({ value:String(user.id), label:`${user.id===options.userId?'Minhas tarefas':user.nome}${!user.isActive?' (inativo)':''}` }))]} />}</div>
        {view === 'social' && <div className="space-y-3 rounded-xl bg-primary/5 p-3"><p className="text-sm text-gray-600">Organize a fila de publicações e as datas previstas.</p><div className="flex flex-wrap gap-3"><FancySelect className="min-w-48" size="compact" ariaLabel="Ordenar publicações" value={socialOrder} onChange={value => { setSocialOrder(value); setPage(1); setLoading(true); }} options={[{ value: 'date', label: 'Data prevista' }, { value: 'manual', label: 'Ordem da fila' }]} /><button type="button" aria-expanded={socialDone} onClick={() => { setSocialDone(value => !value); setPage(1); setLoading(true); }} className="text-sm font-semibold text-primary">{socialDone ? 'Voltar às pendentes' : 'Mostrar concluídas'}</button></div>{socialOrder === 'manual' && options?.canManageAll && !socialDone && <p className="text-xs text-gray-500">Use as setas para ordenar a fila da equipe. Remova os filtros para habilitar a ordenação.</p>}</div>}
        {view === 'delegated' && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary/5 p-3"><p className="text-sm text-gray-600">Demandas que você atribuiu a outras pessoas.</p><FancySelect className="min-w-44" size="compact" ariaLabel="Situação das tarefas delegadas" value={delegatedStatus} onChange={value => { setDelegatedStatus(value); setPage(1); setLoading(true); }} options={[{ value: 'pending', label: 'Pendentes' }, { value: 'done', label: 'Concluídas' }, { value: 'all', label: 'Todas' }]} /></div>}
        {clientId&&<div className="flex items-center justify-between rounded-xl bg-blue-50 p-3 text-sm text-blue-800"><span>Tarefas do cliente {initialClient?.nome||`#${clientId}`}</span><button type="button" onClick={()=>{setParams({});setInitialClient(null);setPage(1);}}>Remover filtro</button></div>}
        <form onSubmit={e=>{e.preventDefault();setSearch(query);setPage(1);setLoading(true);reload();}} className="flex gap-2"><input aria-label="Pesquisar tarefas" placeholder="Pesquisar pelo título da tarefa" className={`${inputClass} min-w-0 flex-1`} value={query} onChange={e=>setQuery(e.target.value)}/><button type="submit" aria-label="Pesquisar" className="rounded-xl border bg-white px-4"><Search size={18}/></button></form>
        {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error} <button type="button" onClick={() => { if (!options) setOptionsRevision(value => value + 1); reload(); }} className="underline">Tentar novamente</button></p>}
        {loading?<p role="status" className="p-8 text-center text-sm text-gray-500">Carregando tarefas…</p>:<div className="space-y-2">{data?.tasks.map(originalTask => { const patch = optimisticChanges.get(originalTask.id); const task = { ...originalTask, ...patch }; const taskBusy = busy || Boolean(patch); return <article key={task.id} aria-busy={Boolean(patch)} className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm lg:flex lg:gap-3 lg:p-4">
          <button type="button" disabled={taskBusy} aria-label={task.status==='DONE'?`Reabrir ${task.title}`:`Concluir ${task.title}`} onClick={()=>changeTask(task,{status:task.status==='DONE'?'TODO':'DONE'},task.status!=='DONE')} className={`mt-1 rounded-full ${task.status==='DONE'?'text-emerald-600':'text-gray-400 hover:text-primary'}`}>{task.status==='DONE'?<Check size={22}/>:<Circle size={22}/>}</button>
          <div className="min-w-0 flex-1 pr-9 lg:pr-0"><button type="button" disabled={taskBusy} onClick={()=>setEditor(task)} className="w-full text-left"><span className={`block break-words font-medium ${task.status==='DONE'?'text-gray-400 line-through':'text-slate-800'}`}>{task.title}</span><span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500"><span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-indigo-700"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-100 text-[9px] font-bold">{task.assignee.nome.charAt(0)}</span>{task.assignee.nome}</span>{task.client&&<span className="rounded-full bg-slate-100 px-2 py-1">{task.client.nome}</span>}{task.dueDate&&<span className={task.dueDate.slice(0,10)<today()&&task.status!=='DONE'?'font-semibold text-red-600':''}>{taskDateLabel(task.dueDate)}</span>}<span role={patch ? 'status' : undefined}>{patch ? (patch.remove ? 'Removendo…' : 'Salvando…') : statusLabels[task.status]}</span>{task.steps.length>0&&<span>{task.steps.filter(step=>step.done).length}/{task.steps.length} etapas</span>}</span></button>{task.property && <div className="mt-3"><TaskPropertyCard property={task.property} /></div>}</div>
          <div className="absolute right-2 top-2 lg:hidden"><button type="button" aria-label={`Ações de ${task.title}`} aria-expanded={openActionTaskId === task.id} onClick={()=>setOpenActionTaskId(current=>current===task.id?null:task.id)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"><MoreHorizontal size={20}/></button>{openActionTaskId === task.id && <div className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl">{canReorder && <><button type="button" disabled={busy || optimisticChanges.size > 0 || (data.page === 1 && data.tasks[0]?.id === task.id)} onClick={()=>{setOpenActionTaskId(null);movePublication(task,'up');}} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"><ArrowUp size={17}/> Subir na fila</button><button type="button" disabled={busy || optimisticChanges.size > 0 || (data.page === data.pages && data.tasks.at(-1)?.id === task.id)} onClick={()=>{setOpenActionTaskId(null);movePublication(task,'down');}} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"><ArrowDown size={17}/> Descer na fila</button></>}<button type="button" disabled={taskBusy} onClick={()=>{setOpenActionTaskId(null);changeTask(task,{important:!task.important});}} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"><Star size={17} fill={task.important?'currentColor':'none'} className={task.important?'text-amber-500':''}/>{task.important?'Remover importância':'Marcar importante'}</button><button type="button" disabled={taskBusy} onClick={()=>{setOpenActionTaskId(null);changeTask(task,{myDay:task.myDay?.slice(0,10)===today()?null:today()});}} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"><Sun size={17}/> {task.myDay?.slice(0,10)===today()?'Remover do meu dia':'Adicionar ao meu dia'}</button><button type="button" disabled={taskBusy} onClick={()=>{setOpenActionTaskId(null);changeTask(task,{remove:true},true);}} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"><Trash2 size={17}/> Excluir tarefa</button></div>}</div>
          <div className="hidden flex-wrap justify-end gap-2 lg:flex">{canReorder && <><button type="button" disabled={busy || optimisticChanges.size > 0 || (data.page === 1 && data.tasks[0]?.id === task.id)} aria-label={`Subir ${task.title} na fila`} onClick={() => movePublication(task, 'up')} className="text-gray-500 disabled:opacity-30"><ArrowUp size={18} /></button><button type="button" disabled={busy || optimisticChanges.size > 0 || (data.page === data.pages && data.tasks.at(-1)?.id === task.id)} aria-label={`Descer ${task.title} na fila`} onClick={() => movePublication(task, 'down')} className="text-gray-500 disabled:opacity-30"><ArrowDown size={18} /></button></>}<button type="button" disabled={taskBusy} aria-label={`Importância de ${task.title}`} aria-pressed={task.important} onClick={()=>changeTask(task,{important:!task.important})} className={task.important?'text-amber-500':'text-gray-300 hover:text-amber-500'}><Star size={19} fill={task.important?'currentColor':'none'}/></button><button type="button" disabled={taskBusy} aria-label={`Adicionar ${task.title} ao meu dia`} onClick={()=>changeTask(task,{myDay:task.myDay?.slice(0,10)===today()?null:today()})} className={task.myDay?.slice(0,10)===today()?'text-primary':'text-gray-300 hover:text-primary'}><Sun size={19}/></button><button type="button" disabled={taskBusy} aria-label={`Excluir ${task.title}`} onClick={()=>changeTask(task,{remove:true},true)} className="text-gray-300 hover:text-red-600"><Trash2 size={17}/></button></div>
        </article>; })}{!data?.tasks.length&&!error&&<div className="rounded-2xl border border-dashed bg-white p-10 text-center"><ListTodo className="mx-auto mb-3 text-primary" size={32}/><h4 className="font-semibold text-gray-800">Tudo tranquilo por aqui</h4><p className="mt-2 text-sm text-gray-500">Nenhuma tarefa nesta visualização. Crie uma tarefa ou ajuste os filtros.</p></div>}</div>}
        {data?.pages>1&&<div className="flex items-center justify-center gap-4"><button disabled={loading||data.page<=1} onClick={()=>{setPage(data.page-1);setLoading(true);}} aria-label="Página anterior"><ArrowLeft size={18}/></button><span className="text-sm">{data.page}/{data.pages}</span><button disabled={loading||data.page>=data.pages} onClick={()=>{setPage(data.page+1);setLoading(true);}} aria-label="Próxima página"><ArrowRight size={18}/></button></div>}
        {view !== 'delegated' && <form onSubmit={quickCreate} className="flex gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3"><input required disabled={creatingTask} maxLength={250} value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Adicionar uma tarefa e pressionar Enter" aria-label="Título da nova tarefa" className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none disabled:opacity-60"/><button disabled={creatingTask||!options||!newTitle.trim()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{creatingTask ? 'Adicionando…' : 'Adicionar'}</button></form>}
        {activeList&&(options.canManageAll||(!activeList.shared&&activeList.ownerId===options.userId))&&<button type="button" className="text-xs text-gray-500 underline" onClick={async()=>{if(!window.confirm('Excluir esta lista? As tarefas serão mantidas sem lista.'))return;try{await taskApi(`/lists/${activeList.id}`,{method:'DELETE'});setOptionsRevision(value => value + 1);filter('all');reload();}catch(err){toast.error(err.message);}}}>Excluir lista (manter tarefas)</button>}
      </main>
    </div>
    {editor&&options&&<TaskEditor key={editor.id||'new'} task={editor.new?null:editor} options={options} initialClient={initialClient} initialList={listId} initialDay={view === 'day'} initialSocial={view === 'social'} initialProperty={initialProperty} requireDelegation={Boolean(editor.new && view === 'delegated')} onClose={closeEditor} onSaved={reload}/>}
  </div>;
}
