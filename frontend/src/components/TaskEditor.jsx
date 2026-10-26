import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TaskClientPicker from './TaskClientPicker';
import TaskPropertyPicker from './TaskPropertyPicker';
import { X, Plus, Circle, CheckCircle2, Star, Sun, CalendarDays, UserRound, Users, ListTodo, StickyNote, Clock, ChevronDown, Check, LockKeyhole } from 'lucide-react';
import { taskApi } from '../services/api';
import { taskToday, addTaskDays, taskDateLabel } from '../utils/taskDates';
import FancySelect from './FancySelect';

const field = 'w-full rounded-xl border border-gray-200 bg-white p-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10';
const dateValue = value => value?.slice(0, 10) || '';

function Action({ icon, label, active, expanded, onClick, children }) {
  const Icon = icon;
  return <section className={`relative first:rounded-t-2xl last:rounded-b-2xl ${expanded ? 'z-20 bg-slate-50/50' : 'z-0'}`}>
    <button type="button" onClick={onClick} aria-expanded={children ? expanded : undefined} aria-pressed={!children ? Boolean(active) : undefined}
      className={`flex min-h-12 w-full items-center gap-3 rounded-[inherit] px-4 py-3 text-left text-sm outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 ${active ? 'font-medium text-primary' : 'text-slate-600'}`}>
      <Icon size={18} className="shrink-0" /><span className="min-w-0 flex-1 break-words">{label}</span>
      {children ? <ChevronDown size={15} className={expanded ? 'rotate-180' : ''} /> : active ? <Check size={16} /> : null}
    </button>
    {children && expanded && <div className="space-y-3 border-t border-slate-100 p-4">{children}</div>}
  </section>;
}

export default function TaskEditor({ task, options, initialClient, initialList, initialDay = false, initialSocial = false, initialProperty = null, requireDelegation = false, onClose, onSaved }) {
  const navigate = useNavigate();
  const dialogRef = useRef(null);
  const titleRef = useRef(null);
  const [form, setForm] = useState(() => ({ title: task?.title || (initialProperty ? `Publicar ${initialProperty.title}`.slice(0, 250) : ''), category: task?.category || (initialSocial ? 'SOCIAL' : 'GENERAL'), propertyId: task?.propertyId || initialProperty?.id || null, notes: task?.notes || '', status: task?.status || 'TODO', important: task?.important || false,
    assigneeId: task?.assigneeId || (requireDelegation ? '' : options.userId), clientId: task?.clientId || initialClient?.id || '', listId: task?.listId || initialList || '', dueDate: dateValue(task?.dueDate), myDay: task ? dateValue(task.myDay) : initialDay ? taskToday() : '', steps: task?.steps || [], isPrivate: task ? Boolean(task.isPrivate) : !initialSocial }));
  useLayoutEffect(() => {
    const title = titleRef.current;
    if (!title) return undefined;
    const resizeTitle = () => {
      const style = window.getComputedStyle(title);
      const lineHeight = Number.parseFloat(style.lineHeight) || 28;
      const padding = (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0);
      const maximum = lineHeight * 3 + padding;
      title.style.height = 'auto';
      title.style.height = `${Math.min(Math.max(title.scrollHeight, lineHeight * 2 + padding), maximum)}px`;
      title.style.overflowY = title.scrollHeight > maximum ? 'auto' : 'hidden';
    };
    resizeTitle();
    window.addEventListener('resize', resizeTitle);
    return () => window.removeEventListener('resize', resizeTitle);
  }, [form.title]);
  const [expanded, setExpanded] = useState(requireDelegation ? 'assignee' : initialProperty || task?.property ? 'property' : '');
  const [customDate, setCustomDate] = useState(false);
  const [today, setToday] = useState(taskToday);
  useEffect(() => {
    const timer = setInterval(() => setToday(taskToday()), 60000);
    return () => clearInterval(timer);
  }, []);

  const [client, setClient] = useState(task?.client || initialClient || null);
  const [property, setProperty] = useState(task?.property || initialProperty);
  const social = form.category === 'SOCIAL';
  const editingTaskId = task?.id;
  const [publicationCheck, setPublicationCheck] = useState(null);
  const [approvedDuplicates, setApprovedDuplicates] = useState('');
  const [checkError, setCheckError] = useState('');
  const needsDuplicateCheck = social && Boolean(form.propertyId) && (!task || task.propertyId !== form.propertyId);
  const duplicateSignature = check => `${check?.property.id}:${check?.tasks.map(item => `${item.id}:${item.version}`).sort().join(',')}`;
  useEffect(() => {
    if (!social || !form.propertyId) { setPublicationCheck(null); return; }
    const controller = new AbortController();
    const refreshProperty = async () => {
      if (document.hidden) return;
      try {
        const result = await taskApi(`/properties/${form.propertyId}/publication-check${editingTaskId ? `?exclude=${editingTaskId}` : ''}`, { signal: controller.signal });
        if (!controller.signal.aborted) { setProperty(result.property); setPublicationCheck(result); setCheckError(''); }
      } catch (err) { if (!controller.signal.aborted) setCheckError(err.message); }
    };
    setPublicationCheck(null); setApprovedDuplicates(''); setCheckError('');
    refreshProperty();
    window.addEventListener('focus', refreshProperty);
    return () => { controller.abort(); window.removeEventListener('focus', refreshProperty); };
  }, [social, form.propertyId, editingTaskId]);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [stepTitle, setStepTitle] = useState('');
  useEffect(() => {
    const handler = event => {
      if (event.key === 'Escape' && !saving) onClose();
      if (event.key === 'Tab') {
        const nodes = dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]');
        if (!nodes?.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, saving]);
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const toggle = name => setExpanded(current => current === name ? '' : name);
  const completed = form.status === 'DONE';
  const completedSteps = form.steps.filter(step => step.done).length;
  const stepProgress = form.steps.length ? completedSteps / form.steps.length * 100 : 0;
  const assignee = options.users.find(user => user.id === Number(form.assigneeId));

  const list = options.lists.find(item => item.id === Number(form.listId));
  const inMyDay = form.myDay === today;
  const ownTask = Number(form.assigneeId) === options.userId;
  const canChangePrivacy = !task || task.createdById === options.userId;
  const selectDate = value => { set('dueDate', value); setExpanded(''); setCustomDate(false); };
  const addStep = () => {
    if (stepTitle.trim() && form.steps.length < 100) { set('steps', [...form.steps, { title: stepTitle.trim(), done: false }]); setStepTitle(''); }
  };
  const save = async event => {
    event.preventDefault();
    if (!form.assigneeId) { setError('Selecione quem vai cumprir a tarefa.'); setExpanded('assignee'); return; }
    setSaving(true); setError('');
    try {
      if (needsDuplicateCheck) {
        const result = await taskApi(`/properties/${form.propertyId}/publication-check${task ? `?exclude=${task.id}` : ''}`);
        setProperty(result.property); setPublicationCheck(result); setCheckError('');
        if (result.tasks.length && approvedDuplicates !== duplicateSignature(result)) return;
      }
      const body = { ...form, assigneeId: Number(form.assigneeId), listId: form.listId ? Number(form.listId) : null,
        dueDate: form.dueDate || null, myDay: form.myDay || null, ...(task ? { version: task.version } : {}) };
      if (options.canReadClients) body.clientId = form.clientId ? Number(form.clientId) : null;
      else delete body.clientId;
      const saved = await taskApi(task ? `/${task.id}` : '', { method: task ? 'PATCH' : 'POST', body });
      onSaved(saved); onClose();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/40" role="presentation">
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="task-editor-title" className="mobile-safe-bottom flex h-full w-full max-w-md flex-col bg-slate-50 shadow-2xl">
      <header className="flex items-center justify-between px-5 py-4"><h2 id="task-editor-title" className="text-sm font-semibold text-gray-600">{social ? (task ? 'Publicação' : 'Nova publicação') : task ? 'Sua tarefa' : 'Nova tarefa'}</h2><button type="button" onClick={onClose} disabled={saving} aria-label="Fechar detalhes" className="rounded-lg p-2 text-gray-400 hover:bg-gray-200"><X size={19} /></button></header>
      <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
        <fieldset disabled={saving} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-5">
          {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700"><p>{error}</p>{task && <button type="button" className="mt-2 underline" onClick={() => { onSaved(); onClose(); }}>Fechar e atualizar lista</button>}</div>}
          {needsDuplicateCheck && checkError && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Não foi possível verificar a fila: {checkError} Vamos tentar novamente ao salvar.</p>}
          {needsDuplicateCheck && publicationCheck?.property.id === form.propertyId && publicationCheck.tasks.length > 0 && <section aria-label="Publicações já na fila" className="rounded-xl border border-amber-300 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-amber-900">Este imóvel já tem publicação pendente.</p><p className="mt-1 text-xs text-amber-800">Confira as tarefas disponíveis para o seu acesso:</p>
            <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">{publicationCheck.tasks.map(item => <li key={item.id}><button type="button" onClick={() => { onClose(); navigate(`/tasks?view=social&task=${item.id}`); }} className="w-full rounded-lg bg-white p-2 text-left text-sm text-gray-700"><span className="block font-semibold">{item.title}</span><span className="block text-xs">{item.assignee.nome} · {item.dueDate ? taskDateLabel(item.dueDate) : 'Sem data prevista'}</span><span className="text-xs font-semibold text-primary underline">Abrir tarefa existente</span></button></li>)}</ul>
            {approvedDuplicates === duplicateSignature(publicationCheck) ? <p className="mt-3 text-xs text-amber-900">Você optou por criar outra publicação. Clique em Salvar para confirmar.</p> : <button type="button" onClick={() => setApprovedDuplicates(duplicateSignature(publicationCheck))} className="mt-3 text-sm font-semibold text-amber-900 underline">{task ? 'Manter este vínculo mesmo assim' : 'Criar outra publicação mesmo assim'}</button>}
          </section>}
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <button type="button" onClick={() => set('status', completed ? 'TODO' : 'DONE')} aria-label={completed ? 'Marcar como pendente' : 'Concluir tarefa'} aria-pressed={completed} className={`mt-2 ${completed ? 'text-emerald-600' : 'text-gray-400 hover:text-primary'}`}>{completed ? <CheckCircle2 size={22} /> : <Circle size={22} />}</button>
              <textarea ref={titleRef} autoFocus aria-label="Título da tarefa" required maxLength={250} rows={2} placeholder="O que precisa ser feito?" className={`min-w-0 flex-1 resize-none rounded-lg py-2 text-lg font-semibold leading-7 outline-none focus:ring-2 focus:ring-primary/20 ${completed ? 'text-slate-500 line-through' : 'text-slate-800'}`} value={form.title} onChange={e => set('title', e.target.value)} onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }} />
              <button type="button" aria-label="Marcar como importante" aria-pressed={form.important} onClick={() => set('important', !form.important)} className={`mt-2 ${form.important ? 'text-amber-500' : 'text-gray-400'}`}><Star size={20} fill={form.important ? 'currentColor' : 'none'} /></button>
            </div>
            {!social && <section aria-label="Subtarefas" className="mt-4 rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-600">Subtarefas <span aria-hidden="true">·</span> {completedSteps} de {form.steps.length}</p>
              {form.steps.length > 0 && <div role="progressbar" aria-label="Progresso das subtarefas" aria-valuemin={0} aria-valuemax={form.steps.length} aria-valuenow={completedSteps} aria-valuetext={`${completedSteps} de ${form.steps.length} concluídas`} className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full rounded-full transition-[width] ${completedSteps === form.steps.length ? 'bg-emerald-500' : 'bg-primary/70'}`} style={{ width: `${stepProgress}%` }} />
              </div>}
              {form.steps.length > 0 && <ul className="mt-3 space-y-1">{form.steps.map((step,index) => <li key={index} className="flex items-start gap-2">
                <label className="flex min-h-9 min-w-0 flex-1 cursor-pointer items-start gap-2.5 py-1.5 text-sm leading-5">
                  <input type="checkbox" aria-label={`${step.done ? 'Reabrir' : 'Concluir'} subtarefa ${step.title}`} checked={step.done} onChange={e => set('steps', form.steps.map((item,i) => i === index ? { ...item, done: e.target.checked } : item))} className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-primary focus:ring-2 focus:ring-primary/20" />
                  <span className={`min-w-0 flex-1 break-words ${step.done ? 'text-slate-500 line-through' : 'text-slate-700'}`}>{step.title}</span>
                </label>
                <button type="button" aria-label={`Remover subtarefa ${step.title}`} onClick={() => set('steps', form.steps.filter((_,i) => i !== index))} className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 outline-none transition hover:bg-white hover:text-red-600 focus-visible:ring-2 focus-visible:ring-primary/20"><X size={14} /></button>
              </li>)}</ul>}
              <div className="mt-2 flex items-center gap-2 border-t border-slate-200/70 pt-2"><button type="button" aria-label="Adicionar subtarefa" disabled={!stepTitle.trim() || form.steps.length >= 100} onClick={addStep} className="rounded-lg p-1 text-primary disabled:text-slate-300"><Plus size={18} /></button><input className="min-w-0 flex-1 rounded-lg bg-transparent py-2 text-sm outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20" aria-label="Nova subtarefa" placeholder="Adicionar subtarefa" maxLength={250} value={stepTitle} onChange={e => setStepTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addStep(); } }} /></div>
            </section>}
          </section>
          <section aria-label="Detalhes da tarefa" className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          <Action icon={Sun} active={inMyDay} label={ownTask ? inMyDay ? 'Adicionada ao Meu dia' : 'Adicionar ao Meu dia' : inMyDay ? `No dia de ${assignee?.nome || 'responsável'}` : `Adicionar ao dia de ${assignee?.nome || 'responsável'}`} onClick={() => set('myDay', inMyDay ? '' : today)} />
          <Action icon={CalendarDays} active={Boolean(form.dueDate)} label={form.dueDate ? `${social ? 'Publicação prevista' : 'Prazo'}: ${taskDateLabel(form.dueDate, today)}` : social ? 'Data prevista da publicação' : 'Adicionar prazo'} expanded={expanded === 'date'} onClick={() => toggle('date')}>
            <div className="space-y-1">{[['Hoje', today], ['Amanhã', addTaskDays(today, 1)], ['Próxima semana', addTaskDays(today, 7)]].map(([label, value]) => <button key={label} type="button" onClick={() => selectDate(value)} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:bg-primary/5"><span>{label}</span><span className="text-xs text-gray-400">{new Date(`${value}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span></button>)}
              <button type="button" onClick={() => setCustomDate(!customDate)} aria-expanded={customDate} className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-primary hover:bg-primary/5">Escolher uma data</button>
              {customDate && <label className="block px-3 text-xs text-gray-500">{social ? 'Data prevista da publicação' : 'Data do prazo'}<input type="date" className={`${field} mt-1`} value={form.dueDate} onChange={e => set('dueDate', e.target.value)} /></label>}
              {form.dueDate && <button type="button" onClick={() => selectDate('')} className="w-full border-t px-3 pt-3 text-left text-sm text-red-600">Remover prazo</button>}
            </div>
          </Action>
          <Action icon={UserRound} label={assignee?.nome ? `Responsável: ${assignee.nome}` : 'Atribuir responsável'} expanded={expanded === 'assignee'} onClick={() => toggle('assignee')}>
            <FancySelect inlineMenu ariaLabel="Responsável" value={String(form.assigneeId)} disabled={!options.canManageAll} placeholder="Selecione quem vai cumprir" options={options.users.filter(user => !requireDelegation || user.id !== options.userId).map(user => ({ value: String(user.id), label: `${user.nome}${!user.isActive ? ' (inativo)' : ''}`, disabled: !user.isActive }))} onChange={value => { const nextId = Number(value); setForm(current => ({ ...current, assigneeId: nextId, isPrivate: nextId === options.userId ? current.isPrivate : false, listId: options.lists.some(item => item.id === Number(current.listId) && (item.shared || item.ownerId === nextId)) ? current.listId : '' })); setExpanded(''); }} />
            {!options.canManageAll && <p className="text-xs text-gray-500">Você acompanha as tarefas atribuídas a você.</p>}
          </Action>
          {!social && ownTask && canChangePrivacy && <Action icon={form.isPrivate ? LockKeyhole : Users} active={form.isPrivate} label={form.isPrivate ? 'Pessoal · somente você pode visualizar' : 'Equipe · administradores podem visualizar'} onClick={() => set('isPrivate', !form.isPrivate)} />}
          {social && <Action icon={ListTodo} active={Boolean(property)} label={property ? 'Imóvel vinculado' : 'Vincular imóvel (opcional)'} expanded={expanded === 'property'} onClick={() => toggle('property')}>
            <TaskPropertyPicker property={property} onSelect={item => { setProperty(item); set('propertyId', item?.id || null); }} />
          </Action>}
          {!social && options.canReadClients && <Action icon={Users} active={Boolean(form.clientId)} label={client ? `Cliente: ${client.nome}` : 'Vincular cliente'} expanded={expanded === 'client'} onClick={() => toggle('client')}>
            <TaskClientPicker client={client} onSelect={item => { setClient(item); set('clientId', item?.id || ''); }} />
          </Action>}
          {!social && <Action icon={ListTodo} label={list ? `Lista: ${list.name}` : 'Adicionar a uma lista'} expanded={expanded === 'list'} onClick={() => toggle('list')}>
            <FancySelect inlineMenu ariaLabel="Lista" value={String(form.listId)} onChange={value => { set('listId', value); setExpanded(''); }} placeholder="Sem lista" options={[{ value: '', label: 'Sem lista' }, ...options.lists.filter(item => item.shared || item.ownerId === Number(form.assigneeId)).map(item => ({ value: String(item.id), label: `${item.name}${item.shared ? ' · Equipe' : ' · Pessoal'}` }))]} />
          </Action>}
          {!completed && !social && <Action icon={Clock} label="Aguardando retorno" active={form.status === 'WAITING'} onClick={() => set('status', form.status === 'WAITING' ? 'TODO' : 'WAITING')} />}
          {!social && <Action icon={StickyNote} active={Boolean(form.notes)} label={form.notes ? 'Anotação adicionada' : 'Adicionar anotação'} expanded={expanded === 'notes'} onClick={() => toggle('notes')}>
            <textarea aria-label="Anotação" className={field} rows={4} maxLength={10000} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Escreva algo sobre esta tarefa…" />
          </Action>}
          </section>
        </fieldset>
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-200 bg-white px-5 py-4"><span className="text-xs text-gray-400">{task ? `Criada em ${new Date(task.createdAt).toLocaleDateString('pt-BR')}` : 'Só o título é obrigatório.'}</span><button type="submit" disabled={saving} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar'}</button></footer>
      </form>
    </section>
  </div>;
}
