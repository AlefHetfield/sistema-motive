import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListTodo, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { taskApi } from '../services/api';
import { taskToday, addTaskDays, taskDateLabel } from '../utils/taskDates';

export default function ClientTasks({ clientId, clientName }) {
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  const [options, setOptions] = useState(null);
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  useEffect(()=>{
    const controller=new AbortController();
    taskApi(`?clientId=${clientId}`,{signal:controller.signal}).then(result => { setData(result); setError(''); }).catch(err=>{if(!controller.signal.aborted)setError(err.message);});
    return()=>controller.abort();
  },[clientId, revision]);
  useEffect(() => {
    if (!creating) return;
    const controller = new AbortController();
    taskApi('/options', { signal: controller.signal }).then(result => {
      setOptions(result);
      if (!result.canManageAll) setAssigneeId(String(result.userId));
    }).catch(err => { if (!controller.signal.aborted) setFormError(err.message); });
    return () => controller.abort();
  }, [creating]);
  const create = async event => {
    event.preventDefault();
    if (saving || !options) return;
    setSaving(true); setFormError('');
    try {
      await taskApi('', { method: 'POST', body: { title, assigneeId: Number(assigneeId), clientId, dueDate: dueDate || null } });
      setTitle(''); setDueDate(''); setAssigneeId(''); setCreating(false); setRevision(value => value + 1);
      toast.success('Tarefa criada e vinculada ao cliente.');
    } catch (err) { setFormError(err.message); } finally { setSaving(false); }
  };
  const field = 'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary';
  return <section className="rounded-2xl border border-gray-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-semibold text-gray-800"><ListTodo size={18}/> Tarefas vinculadas</h3>
      <button type="button" onClick={() => { setCreating(true); setFormError(''); }} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"><Plus size={16} /> Criar tarefa</button>
    </div>
    {creating && <form onSubmit={create} className="mt-4 space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
      <p className="text-xs text-gray-500">Cliente vinculado: <strong>{clientName || `#${clientId}`}</strong></p>
      {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
      <fieldset disabled={saving || !options} className="space-y-3">
        <label className="block text-xs font-medium text-gray-600">O que precisa ser feito?<input autoFocus required maxLength={250} className={field} placeholder="Ex.: Solicitar FGTS" value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label className="block text-xs font-medium text-gray-600">Responsável<select required disabled={!options?.canManageAll} className={field} value={assigneeId} onChange={e => setAssigneeId(e.target.value)}><option value="">Selecione quem vai cumprir</option>{options?.users.filter(user => user.isActive).map(user => <option key={user.id} value={user.id}>{user.nome}{user.id === options.userId ? ' (eu)' : ''}</option>)}</select></label>
        <div><p className="text-xs font-medium text-gray-600">Prazo (opcional)</p><div className="mt-2 flex flex-wrap gap-2">{[['Hoje', 0], ['Amanhã', 1], ['Próxima semana', 7]].map(([label, days]) => <button key={label} type="button" onClick={() => setDueDate(addTaskDays(taskToday(), days))} className="rounded-lg border bg-white px-2 py-1 text-xs text-primary">{label}</button>)}</div>
          <input type="date" aria-label="Prazo da tarefa" className={field} value={dueDate} onChange={e => setDueDate(e.target.value)} />{dueDate && <div className="mt-1 flex items-center justify-between text-xs text-gray-500"><span>{taskDateLabel(dueDate)}</span><button type="button" onClick={() => setDueDate('')} className="text-red-600">Remover prazo</button></div>}
        </div>
      </fieldset>
      <div className="flex items-center justify-end gap-3"><button type="button" disabled={saving} onClick={() => setCreating(false)} className="text-sm text-gray-500">Cancelar</button><button type="submit" disabled={saving || !options} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Criando…' : !options ? 'Carregando…' : 'Criar tarefa'}</button></div>
    </form>}
    {error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : !data ? <p className="mt-3 text-sm text-gray-400">Carregando…</p> : <><p className="mt-3 text-sm text-gray-500">{data.total} pendente(s)</p><ul className="mt-2 space-y-2">{data.tasks.slice(0,5).map(task => <li key={task.id} className="rounded-lg bg-gray-50 p-2 text-sm"><Link to={`/tasks?client=${clientId}&task=${task.id}`} className="block"><span className="block break-words font-medium text-gray-700">{task.title}</span><span className="mt-1 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-700">{task.assignee.nome}</span>{task.dueDate && <span className="text-gray-500">{taskDateLabel(task.dueDate)}</span>}</span></Link></li>)}</ul></>}
    <Link className="mt-3 inline-block text-sm font-semibold text-primary" to={`/tasks?client=${clientId}`}>Ver todas as tarefas do cliente</Link>
  </section>;
}
