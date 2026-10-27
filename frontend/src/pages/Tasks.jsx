import useMobileLayout from '../hooks/useMobileLayout';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import TaskPropertyCard from '../components/TaskPropertyCard';
import { Check, Circle, Star, Sun, ListTodo, CalendarDays, Clock, Plus, Trash2, Users, UserRound, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, MoreHorizontal, StickyNote, LockKeyhole, PanelLeftClose, PanelLeftOpen, LayoutList, LayoutGrid, LoaderCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { taskApi } from '../services/api';
import TaskEditor from '../components/TaskEditor';
import FancySelect from '../components/FancySelect';
import SearchInput from '../components/SearchInput';
import { taskToday, taskDateLabel } from '../utils/taskDates';

const views = [['all','Tarefas',ListTodo],['day','Meu dia',Sun],['important','Importantes',Star],['overdue','Atrasadas',Clock],['planned','Planejadas',CalendarDays],['waiting','Aguardando retorno',UserRound],['social','Redes Sociais',Users],['delegated','Delegadas por mim',Users],['done','Concluídas',Check]];
const today = taskToday;
const statusLabels = { TODO: 'Pendente', IN_PROGRESS: 'Pendente', WAITING: 'Aguardando retorno', DONE: 'Concluída' };
const inputClass = 'rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary';
const summaryKey = { all: 'all', day: 'myDay', important: 'important', overdue: 'overdue', planned: 'planned', waiting: 'waiting', social: 'social', delegated: 'delegated', done: 'done' };
const taskVisual = task => {
  if (task.status === 'DONE') return { badge: 'bg-emerald-50 text-emerald-800', dot: 'bg-emerald-500', label: 'Concluída' };
  const due = task.dueDate?.slice(0, 10);
  if (due && due < today()) return { badge: 'bg-rose-50 text-rose-700', dot: 'bg-red-500', label: 'Atrasada' };
  if (due === today()) return { badge: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500', label: 'Vence hoje' };
  if (task.status === 'WAITING') return { badge: 'bg-[#F4EDDE] text-[#765B2D]', dot: 'bg-orange-400', label: 'Aguardando retorno' };
  if (task.isPrivate) return { badge: 'bg-slate-100 text-slate-600', dot: 'bg-violet-500', label: 'Pendente' };
  if (due) return { badge: 'bg-sky-50 text-sky-800', dot: 'bg-sky-500', label: 'Planejada' };
  return { badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400', label: statusLabels[task.status] };
};

export default function Tasks() {
  const [params, setParams] = useSearchParams();
  const mobile = useMobileLayout();
  const [showTaskLists, setShowTaskLists] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [taskLayout, setTaskLayout] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem('motive-task-layout') === 'list' ? 'list' : 'grid');
  const [openActionTaskId, setOpenActionTaskId] = useState(null);
  useEffect(() => {
    if (openActionTaskId == null) return undefined;
    const closeOutside = event => {
      const actions = document.getElementById(`task-actions-trigger-${openActionTaskId}`)?.closest('[data-task-actions]');
      if (!actions?.contains(event.target)) setOpenActionTaskId(null);
    };
    const closeOnEscape = event => {
      if (event.key !== 'Escape') return;
      setOpenActionTaskId(null);
      document.getElementById(`task-actions-trigger-${openActionTaskId}`)?.focus();
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openActionTaskId]);
  const clientId = params.get('client') || '';
  const linkedTaskId = params.get('task') || '';
  const [options, setOptions] = useState(null);
  const [view, setView] = useState(() => views.some(item => item[0] === params.get('view')) ? params.get('view') : 'all');
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
  useEffect(() => {
    const term = query.trim();
    if (term === search) return undefined;
    const timer = setTimeout(() => { setSearch(term); setPage(1); }, 250);
    return () => clearTimeout(timer);
  }, [query, search]);
  const [revision, setRevision] = useState(0);
  const [optionsRevision, setOptionsRevision] = useState(0);
  const pendingChanges = useRef(new Map());
  const reloadAfterConflict = useRef(false);
  const mutationRevision = useRef(0);
  const mounted = useRef(true);
  const [optimisticChanges, setOptimisticChanges] = useState(new Map());
  const [stepSaveFeedback, setStepSaveFeedback] = useState(new Map());
  const stepFeedbackTimers = useRef(new Map());
  useEffect(() => {
    const feedbackTimers = stepFeedbackTimers.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      feedbackTimers.forEach(timer => window.clearTimeout(timer));
      feedbackTimers.clear();
    };
  }, []);
  useEffect(() => {
    const refresh = () => { if (!document.hidden) { setRevision(value => value + 1); setOptionsRevision(value => value + 1); } };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);
  const [currentDay, setCurrentDay] = useState(taskToday);
  useEffect(() => { const timer = setInterval(() => setCurrentDay(taskToday()), 60000); return () => clearInterval(timer); }, []);
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryRevision, setSummaryRevision] = useState(0);
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
    taskApi(`/${encodeURIComponent(linkedTaskId)}`, { signal: controller.signal }).then(async task => {
      setEditor({ ...task, isNew: false });
      await taskApi(`/notifications/task/${task.id}/read`, { method: 'PATCH' }).catch(() => {});
      window.dispatchEvent(new Event('motive:task-notifications-changed'));
    }).catch(err => {
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
    setLoading(true);
    const controller = new AbortController();
    const startedAtRevision = mutationRevision.current;
    const filters = new URLSearchParams({ view, ...(view === 'social' ? { status: socialDone ? 'done' : 'pending', order: socialOrder } : {}), ...(view === 'delegated' ? { status: delegatedStatus } : {}), page: String(page), ...(listId ? { listId } : {}), ...(assigneeId ? { assigneeId } : {}), ...(clientId ? { clientId } : {}), ...(search ? { q:search } : {}) });
    const isCurrent = () => !controller.signal.aborted && startedAtRevision === mutationRevision.current;
    taskApi(`?${filters}`, { signal:controller.signal }).then(result => { if (isCurrent()) { setData(result); setError(''); } }).catch(err => { if (isCurrent()) setError(err.message); }).finally(() => { if (isCurrent()) setLoading(false); });
    return () => controller.abort();
  }, [view, listId, assigneeId, clientId, search, page, revision, currentDay, delegatedStatus, socialDone, socialOrder]);
  useEffect(() => {
    const controller = new AbortController();
    taskApi('/summary', { signal: controller.signal }).then(setSummary).catch(() => {});
    return () => controller.abort();
  }, [revision, currentDay, optionsRevision, summaryRevision]);
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
    if (currentSearch && !`${task.title} ${task.notes || ''}`.toLocaleLowerCase('pt-BR').includes(currentSearch.toLocaleLowerCase('pt-BR'))) return false;
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
  const openTask = task => {
    setEditor({ ...task, isNew: false });
    if (!task.isNew) return;
    setData(current => current ? { ...current, tasks: current.tasks.map(item => item.id === task.id ? { ...item, isNew: false } : item) } : current);
    taskApi(`/notifications/task/${task.id}/read`, { method: 'PATCH' }).then(() => {
      setSummaryRevision(value => value + 1);
      window.dispatchEvent(new Event('motive:task-notifications-changed'));
    }).catch(() => {});
  };
  const showStepFeedback = (taskId, feedback) => {
    window.clearTimeout(stepFeedbackTimers.current.get(taskId));
    stepFeedbackTimers.current.delete(taskId);
    setStepSaveFeedback(current => {
      const next = new Map(current);
      if (feedback) next.set(taskId, feedback);
      else next.delete(taskId);
      return next;
    });
    if (!feedback) return;
    const timer = window.setTimeout(() => {
      stepFeedbackTimers.current.delete(taskId);
      if (mounted.current) setStepSaveFeedback(current => {
        const next = new Map(current);
        next.delete(taskId);
        return next;
      });
    }, feedback === 'saved' ? 2500 : 5000);
    stepFeedbackTimers.current.set(taskId, timer);
  };
  const changeTask = async (task, patch, undo = false) => {
    if (busy || pendingChanges.current.has(task.id)) return;
    const updatesSteps = Array.isArray(patch.steps);
    if (updatesSteps) showStepFeedback(task.id, null);
    const startedQueryKey = queryKeyRef.current;
    mutationRevision.current += 1;
    pendingChanges.current.set(task.id, patch);
    setOptimisticChanges(new Map(pendingChanges.current));
    try {
      const saved = await taskApi(`/${task.id}`, { method:'PATCH', body:{...patch,version:task.version} });
      window.dispatchEvent(new Event('motive:task-notifications-changed'));
      if (!mounted.current) return;
      if (updatesSteps) showStepFeedback(task.id, 'saved');
      setSummaryRevision(value => value + 1);
      if (startedQueryKey === queryKeyRef.current) reconcileTask(saved);
      else reload();
      if (undo) toast.success(patch.remove ? 'Tarefa removida.' : 'Tarefa concluída.', { action:{label:'Desfazer',onClick:async () => {
        if (!mounted.current) return;
        await changeTask(saved, patch.remove ? {restore:true} : {status:task.status});
      } } });
    } catch(err) {
      if (mounted.current) {
        if (updatesSteps) showStepFeedback(task.id, 'error');
        toast.error(err.message);
        if (err.status === 409) reloadAfterConflict.current = true;
      }
    } finally {
      pendingChanges.current.delete(task.id);
      if (mounted.current) {
        setOptimisticChanges(new Map(pendingChanges.current));
        if (reloadAfterConflict.current && !pendingChanges.current.size) {
          reloadAfterConflict.current = false;
          reload();
        }
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
      setSummaryRevision(value => value + 1);
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
  const compactSidebar = sidebarCollapsed && !mobile;
  const indexedTasks = (data?.tasks || []).map((task, index) => ({ task, index }));
  const taskColumns = taskLayout === 'grid'
    ? [indexedTasks.filter(item => item.index % 2 === 0), indexedTasks.filter(item => item.index % 2 === 1)]
    : [indexedTasks];
  const changeTaskLayout = layout => {
    setTaskLayout(layout);
    window.localStorage.setItem('motive-task-layout', layout);
  };
  const canReorder = view === 'social' && socialOrder === 'manual' && !socialDone && options?.canManageAll && !assigneeId && !clientId && !search;
  const movePublication = async (task, direction) => {
    if (busy || pendingChanges.current.size) return;
    setBusy(true);
    try { await taskApi(`/${task.id}/social-order`, { method: 'PATCH', body: { version: task.version, direction } }); }
    catch (err) { toast.error(err.message); }
    finally { setBusy(false); reload(); }
  };
  return <div className="task-page mx-auto max-w-[1500px] p-3 sm:p-4 md:p-7">
    <div className="mb-3 flex items-center justify-between gap-3"><div className="min-w-0">{mobile ? <h2 className="truncate text-base font-semibold text-slate-900">{activeList?.name || views.find(item => item[0] === view)?.[1]}</h2> : <p className="text-sm text-slate-500">{options?.canManageAll ? 'Tarefas da equipe' : 'Minhas tarefas'}</p>}</div><button type="button" disabled={!options} onClick={()=>setEditor({new:true})} className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40 lg:px-4"><Plus size={18}/> {view === 'social' ? 'Nova publicação' : 'Nova tarefa'}</button></div>
    {mobile && <button type="button" aria-expanded={showTaskLists} aria-controls="task-lists" onClick={() => setShowTaskLists(value => !value)} className="mb-3 flex min-h-10 w-full items-center justify-between rounded-xl border bg-white px-3 py-2 text-left text-sm font-semibold text-primary"><span>Lista e visualização</span><span>{showTaskLists ? 'Fechar' : 'Trocar'}</span></button>}
    <div className={`grid gap-5 ${compactSidebar ? 'lg:grid-cols-[72px_minmax(0,1fr)]' : 'lg:grid-cols-[230px_minmax(0,1fr)]'}`}>
      <aside id="task-lists" hidden={mobile && !showTaskLists} className={`self-start rounded-2xl border border-gray-200 bg-white transition-all ${compactSidebar ? 'p-2' : 'p-3'}`}>
        <button type="button" onClick={() => setSidebarCollapsed(value => !value)} className={`mb-2 hidden w-full items-center rounded-xl p-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-primary lg:flex ${compactSidebar ? 'justify-center' : 'justify-between'}`} aria-label={compactSidebar ? 'Expandir painel de tarefas' : 'Recolher painel de tarefas'}>{!compactSidebar&&<span>Navegação</span>}{compactSidebar?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}</button>
        <nav aria-label="Listas de tarefas" className="space-y-1">{views.filter(item => item[0] !== 'delegated' || options?.canManageAll).map(item=>{const [key,label,Icon]=item; const count=summary?.[summaryKey[key]]; return <button key={key} type="button" title={compactSidebar?label:undefined} onClick={()=>filter(key)} className={`flex w-full items-center rounded-xl py-3 text-sm ${compactSidebar?'justify-center px-2':'gap-3 px-3'} ${view===key&&!listId?'bg-primary/10 font-semibold text-primary':'text-gray-600 hover:bg-gray-50'}`}><Icon size={18} className="shrink-0"/>{!compactSidebar&&<><span className="min-w-0 flex-1 text-left">{label}</span>{count>0&&<span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${key==='overdue'?'bg-red-100 text-red-700':'bg-slate-100 text-slate-500'}`}>{count}</span>}</>}</button>;})}</nav>
        {!compactSidebar&&<div className="mt-4 border-t pt-4"><p className="mb-2 px-3 text-xs font-semibold uppercase text-gray-400">Suas listas</p>{options?.lists.map(list=><button key={list.id} type="button" onClick={()=>filter('all',String(list.id))} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${listId===String(list.id)?'bg-primary/10 text-primary':'text-gray-600'}`}>{list.shared?<Users size={15}/>:<ListTodo size={15}/>}<span className="truncate">{list.name}</span></button>)}<button type="button" onClick={()=>setListForm(!listForm)} className="mt-2 flex items-center gap-2 px-3 py-2 text-sm font-semibold text-primary"><Plus size={16}/> Criar lista</button>{listForm&&<form onSubmit={createList} className="space-y-2 p-2"><input required maxLength={80} aria-label="Nome da lista" value={newList} onChange={e=>setNewList(e.target.value)} placeholder="Nome da lista" className={`${inputClass} w-full`}/>{options?.canManageAll&&<label className="flex gap-2 text-xs"><input type="checkbox" checked={shared} onChange={e=>setShared(e.target.checked)}/> Compartilhar com a equipe</label>}<button disabled={busy} className="rounded-lg bg-primary px-3 py-2 text-xs text-white">Criar</button></form>}</div>}
      </aside>
      <main className="min-w-0 space-y-4">
        <div className="flex items-center justify-between gap-3"><h3 className="hidden text-xl font-bold text-slate-800 lg:block">{activeList?.name||views.find(item=>item[0]===view)?.[1]} <span className="text-sm font-normal text-gray-400">{!loading&&data?`(${data.total})`:''}</span></h3>{mobile && !loading && data && <p className="text-xs font-semibold text-gray-500">{data.total} tarefa(s)</p>}<div className="hidden items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm xl:flex" role="group" aria-label="Visualização das tarefas"><button type="button" onClick={()=>changeTaskLayout('list')} aria-pressed={taskLayout==='list'} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${taskLayout==='list'?'bg-primary text-white shadow-sm':'text-slate-500 hover:bg-slate-50'}`}><LayoutList size={15}/>Lista</button><button type="button" onClick={()=>changeTaskLayout('grid')} aria-pressed={taskLayout==='grid'} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${taskLayout==='grid'?'bg-primary text-white shadow-sm':'text-slate-500 hover:bg-slate-50'}`}><LayoutGrid size={15}/>Grade</button></div></div>
        {view === 'social' && <div className="space-y-3 rounded-xl bg-primary/5 p-3"><p className="text-sm text-gray-600">Organize a fila de publicações e as datas previstas.</p><div className="flex flex-wrap gap-3"><FancySelect className="min-w-48" size="compact" ariaLabel="Ordenar publicações" value={socialOrder} onChange={value => { setSocialOrder(value); setPage(1); setLoading(true); }} options={[{ value: 'date', label: 'Data prevista' }, { value: 'manual', label: 'Ordem da fila' }]} /><button type="button" aria-expanded={socialDone} onClick={() => { setSocialDone(value => !value); setPage(1); setLoading(true); }} className="text-sm font-semibold text-primary">{socialDone ? 'Voltar às pendentes' : 'Mostrar concluídas'}</button></div>{socialOrder === 'manual' && options?.canManageAll && !socialDone && <p className="text-xs text-gray-500">Use as setas para ordenar a fila da equipe. Remova os filtros para habilitar a ordenação.</p>}</div>}
        {view === 'delegated' && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary/5 p-3"><p className="text-sm text-gray-600">Demandas que você atribuiu a outras pessoas.</p><FancySelect className="min-w-44" size="compact" ariaLabel="Situação das tarefas delegadas" value={delegatedStatus} onChange={value => { setDelegatedStatus(value); setPage(1); setLoading(true); }} options={[{ value: 'pending', label: 'Pendentes' }, { value: 'done', label: 'Concluídas' }, { value: 'all', label: 'Todas' }]} /></div>}
        {clientId&&<div className="flex items-center justify-between rounded-xl bg-blue-50 p-3 text-sm text-blue-800"><span>Tarefas do cliente {initialClient?.nome||`#${clientId}`}</span><button type="button" onClick={()=>{setParams({});setInitialClient(null);setPage(1);}}>Remover filtro</button></div>}
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <SearchInput className="flex-1" label="Pesquisar tarefas" placeholder="Pesquisar por título ou anotação" value={query} onChange={setQuery} onClear={() => { setQuery(''); setSearch(''); setPage(1); }} onSubmit={() => { setSearch(query.trim()); setPage(1); }} />
          {options?.canManageAll && view !== 'day' && <FancySelect className={mobile ? 'w-full' : 'min-w-52 border-l border-slate-100 pl-2'} size="compact" ariaLabel="Filtrar responsável" value={String(assigneeId)} onChange={value => { setAssigneeId(value); setPage(1); setLoading(true); }} placeholder="Toda a equipe" options={[{ value: '', label: 'Toda a equipe' }, ...options.users.map(user => ({ value: String(user.id), label: `${user.id === options.userId ? 'Minhas tarefas' : user.nome}${!user.isActive ? ' (inativo)' : ''}` }))]} />}
        </div>
        {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error} <button type="button" onClick={() => { if (!options) setOptionsRevision(value => value + 1); reload(); }} className="underline">Tentar novamente</button></p>}
        {loading?<p role="status" className="p-8 text-center text-sm text-gray-500">Carregando tarefas…</p>:<div className={taskLayout==='grid'?'flex flex-col gap-2 xl:grid xl:grid-cols-2 xl:items-start xl:gap-3':''}>{taskColumns.map((column,columnIndex)=><div key={columnIndex} className={taskLayout==='grid'?'contents xl:block xl:space-y-3':'space-y-2'}>{column.map(({task:originalTask,index:taskIndex}) => { const patch = optimisticChanges.get(originalTask.id); const task = { ...originalTask, ...patch }; const taskBusy = busy || Boolean(patch); const visual = taskVisual(task); const savingSteps = Array.isArray(patch?.steps); const stepFeedback = savingSteps ? 'saving' : stepSaveFeedback.get(task.id); return <article key={task.id} style={taskLayout === 'grid' ? { order: taskIndex } : undefined} aria-busy={Boolean(patch)} className="group relative grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:shadow-md sm:p-3.5">
          <button type="button" disabled={taskBusy} aria-label={task.status === 'DONE' ? `Reabrir ${task.title}` : `Concluir ${task.title}`} onClick={() => changeTask(task, { status: task.status === 'DONE' ? 'TODO' : 'DONE' }, task.status !== 'DONE')} className={`mt-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${task.status === 'DONE' ? 'text-emerald-600' : 'text-slate-500 hover:text-primary'}`}>
            {task.status === 'DONE' ? <Check size={22} /> : <Circle size={22} />}
          </button>
          <div className="min-w-0">
            <div className="flex items-start gap-2">
              <button type="button" disabled={taskBusy} onClick={() => openTask(task)} className="min-w-0 flex-1 rounded-md py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                <span className={`break-words text-[15px] font-semibold leading-6 ${task.status === 'DONE' ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                  {task.title}{task.isNew && <span className="ml-2 inline-block rounded-full bg-sky-100 px-2 py-0.5 align-middle text-[9px] font-extrabold uppercase leading-4 tracking-wide text-sky-700 no-underline">Nova</span>}
                </span>
              </button>
              <div data-task-actions className="relative flex shrink-0 items-center gap-0.5">
                {canReorder && <div className="hidden items-center lg:flex">
                  <button type="button" disabled={busy || optimisticChanges.size > 0 || (data.page === 1 && data.tasks[0]?.id === task.id)} aria-label={`Subir ${task.title} na fila`} onClick={() => movePublication(task, 'up')} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"><ArrowUp size={17} /></button>
                  <button type="button" disabled={busy || optimisticChanges.size > 0 || (data.page === data.pages && data.tasks.at(-1)?.id === task.id)} aria-label={`Descer ${task.title} na fila`} onClick={() => movePublication(task, 'down')} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"><ArrowDown size={17} /></button>
                </div>}
                <button type="button" disabled={taskBusy} aria-label={`Importância de ${task.title}`} aria-pressed={task.important} onClick={() => changeTask(task, { important: !task.important })} className={`flex h-8 w-8 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 hover:bg-amber-50 ${task.important ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}><Star size={18} fill={task.important ? 'currentColor' : 'none'} /></button>
                <button type="button" disabled={taskBusy} aria-label={`${task.myDay?.slice(0, 10) === today() ? 'Remover' : 'Adicionar'} ${task.title} ${task.myDay?.slice(0, 10) === today() ? 'do' : 'ao'} meu dia`} onClick={() => changeTask(task, { myDay: task.myDay?.slice(0, 10) === today() ? null : today() })} className={`hidden h-8 w-8 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 hover:bg-primary/5 sm:flex ${task.myDay?.slice(0, 10) === today() ? 'text-primary' : 'text-slate-400 hover:text-primary'}`}><Sun size={18} /></button>
                <button id={`task-actions-trigger-${task.id}`} type="button" disabled={taskBusy} aria-label={`Ações de ${task.title}`} aria-expanded={openActionTaskId === task.id} aria-controls={`task-actions-${task.id}`} onClick={() => setOpenActionTaskId(current => current === task.id ? null : task.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"><MoreHorizontal size={19} /></button>
                {openActionTaskId === task.id && <div id={`task-actions-${task.id}`} role="group" aria-label={`Ações de ${task.title}`} className="absolute right-0 top-9 z-20 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                  {canReorder && <div className="lg:hidden">
                    <button type="button" disabled={busy || optimisticChanges.size > 0 || (data.page === 1 && data.tasks[0]?.id === task.id)} onClick={() => { setOpenActionTaskId(null); movePublication(task, 'up'); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ArrowUp size={17} />Subir na fila</button>
                    <button type="button" disabled={busy || optimisticChanges.size > 0 || (data.page === data.pages && data.tasks.at(-1)?.id === task.id)} onClick={() => { setOpenActionTaskId(null); movePublication(task, 'down'); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ArrowDown size={17} />Descer na fila</button>
                  </div>}
                  <button type="button" disabled={taskBusy} onClick={() => { setOpenActionTaskId(null); changeTask(task, { myDay: task.myDay?.slice(0, 10) === today() ? null : today() }); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-50 sm:hidden"><Sun size={17} />{task.myDay?.slice(0, 10) === today() ? 'Remover do meu dia' : 'Adicionar ao meu dia'}</button>
                  <button type="button" disabled={taskBusy} aria-label={`Excluir ${task.title}`} onClick={() => { setOpenActionTaskId(null); changeTask(task, { remove: true }, true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"><Trash2 size={17} />Excluir tarefa</button>
                </div>}
              </div>
            </div>
            <button type="button" disabled={taskBusy} onClick={() => openTask(task)} className="mt-1 block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
              <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 font-medium text-slate-600"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[9px] font-semibold text-indigo-700">{task.assignee.nome.charAt(0)}</span><span className="truncate" title={task.assignee.nome}>{task.assignee.nome}</span></span>
                {task.client && <span className="truncate" title={task.client.nome}>{task.client.nome}</span>}
              </span>
              <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span role={patch && !savingSteps ? 'status' : undefined} className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${visual.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${visual.dot}`} />{patch && !savingSteps ? (patch.remove ? 'Removendo…' : 'Salvando…') : visual.label}</span>
                {task.dueDate && <span className={`inline-flex items-center gap-1 ${task.dueDate.slice(0, 10) < today() && task.status !== 'DONE' ? 'font-medium text-red-600' : 'text-slate-500'}`}><CalendarDays size={12} />{taskDateLabel(task.dueDate)}</span>}
                {task.isPrivate && <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700"><LockKeyhole size={12} />Pessoal</span>}
              </span>
              {task.notes?.trim() && <span className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-slate-500"><StickyNote size={13} className="mt-0.5 shrink-0 text-slate-400" /><span className="line-clamp-2 whitespace-pre-line">{task.notes.trim()}</span></span>}
            </button>
            {task.steps.length > 0 && <section aria-label={`Subtarefas de ${task.title}`} className="mt-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <div className="mb-2 flex min-h-4 flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <p className="text-[11px] font-semibold text-slate-500">Subtarefas <span aria-hidden="true" className="px-0.5 text-slate-400">·</span> {task.steps.filter(step => step.done).length} de {task.steps.length}</p>
                <span role="status" aria-live="polite" aria-atomic="true" className={`inline-flex items-center gap-1 text-[10px] font-medium ${stepFeedback === 'error' ? 'text-red-600' : stepFeedback === 'saved' ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {stepFeedback && <span className="sr-only">{task.title}: </span>}
                  {stepFeedback === 'saving' && <><LoaderCircle aria-hidden="true" size={12} className="motion-safe:animate-spin" />Salvando…</>}
                  {stepFeedback === 'saved' && <><Check aria-hidden="true" size={12} />Salvo</>}
                  {stepFeedback === 'error' && <><AlertCircle aria-hidden="true" size={12} />Não salvo</>}
                </span>
              </div>
              <div role="progressbar" aria-label={`Progresso das subtarefas de ${task.title}`} aria-valuemin={0} aria-valuemax={task.steps.length} aria-valuenow={task.steps.filter(step => step.done).length} className="mb-3 h-1 overflow-hidden rounded-full bg-slate-200/80">
                <div className={`h-full rounded-full transition-[width] ${task.steps.every(step => step.done) ? 'bg-emerald-500' : 'bg-primary/70'}`} style={{ width: `${task.steps.filter(step => step.done).length / task.steps.length * 100}%` }} />
              </div>
              <ul className="space-y-2">
                {task.steps.map((step, index) => <li key={index}>
                  <label className={`flex min-h-9 items-start gap-2 rounded-lg px-1 py-1.5 text-[13px] leading-5 transition ${taskBusy ? 'cursor-wait opacity-60' : 'cursor-pointer hover:bg-white/70'}`}>
                    <input type="checkbox" aria-label={`${step.done ? 'Reabrir' : 'Concluir'} subtarefa ${step.title}`} checked={step.done} disabled={taskBusy} onChange={event => changeTask(task, { steps: task.steps.map((item, itemIndex) => itemIndex === index ? { ...item, done: event.target.checked } : item) })} className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-wait" />
                    <span className={`min-w-0 break-words ${step.done ? 'text-slate-500 line-through' : 'text-slate-700'}`}>{step.title}</span>
                  </label>
                </li>)}
              </ul>
            </section>}
            {task.property && <div className="mt-3"><TaskPropertyCard property={task.property} compact /></div>}
          </div>
        </article>; })}</div>)}{!data?.tasks.length&&!error&&<div className="rounded-2xl border border-dashed bg-white p-10 text-center xl:col-span-2"><ListTodo className="mx-auto mb-3 text-primary" size={32}/><h4 className="font-semibold text-gray-800">Tudo tranquilo por aqui</h4><p className="mt-2 text-sm text-gray-500">Nenhuma tarefa nesta visualização. Crie uma tarefa ou ajuste os filtros.</p></div>}</div>}
        {data?.pages>1&&<div className="flex items-center justify-center gap-4"><button disabled={loading||data.page<=1} onClick={()=>{setPage(data.page-1);setLoading(true);}} aria-label="Página anterior"><ArrowLeft size={18}/></button><span className="text-sm">{data.page}/{data.pages}</span><button disabled={loading||data.page>=data.pages} onClick={()=>{setPage(data.page+1);setLoading(true);}} aria-label="Próxima página"><ArrowRight size={18}/></button></div>}
        {view !== 'delegated' && <form onSubmit={quickCreate} className="flex gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3"><input required disabled={creatingTask} maxLength={250} value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Adicionar uma tarefa e pressionar Enter" aria-label="Título da nova tarefa" className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none disabled:opacity-60"/><button disabled={creatingTask||!options||!newTitle.trim()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{creatingTask ? 'Adicionando…' : 'Adicionar'}</button></form>}
        {activeList&&(options.canManageAll||(!activeList.shared&&activeList.ownerId===options.userId))&&<button type="button" className="text-xs text-gray-500 underline" onClick={async()=>{if(!window.confirm('Excluir esta lista? As tarefas serão mantidas sem lista.'))return;try{await taskApi(`/lists/${activeList.id}`,{method:'DELETE'});setOptionsRevision(value => value + 1);filter('all');reload();}catch(err){toast.error(err.message);}}}>Excluir lista (manter tarefas)</button>}
      </main>
    </div>
    {editor&&options&&<TaskEditor key={editor.id||'new'} task={editor.new?null:editor} options={options} initialClient={initialClient} initialList={listId} initialDay={view === 'day'} initialSocial={view === 'social'} initialProperty={initialProperty} requireDelegation={Boolean(editor.new && view === 'delegated')} onClose={closeEditor} onSaved={reload}/>}
  </div>;
}
