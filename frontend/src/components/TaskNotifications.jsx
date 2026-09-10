import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { toast } from 'sonner';
import { taskApi } from '../services/api';
import { taskDateLabel } from '../utils/taskDates';

export default function TaskNotifications() {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [revision, setRevision] = useState(0);
  const latest = useRef(null);
  const toastIds = useRef([]);
  const refresh = () => setRevision(value => value + 1);

  useEffect(() => {
    let disposed = false;
    let fetching = false;
    let controller;
    const load = async () => {
      if (document.hidden || fetching) return;
      fetching = true;
      controller = new AbortController();
      try {
        const result = await taskApi('/notifications', { signal: controller.signal });
        if (disposed) return;
        const newest = result.items[0]?.id || 0;
        if (latest.current !== null) {
          const fresh = result.items.filter(item => item.id > latest.current && !item.readAt);
          if (fresh.length) {
            const item = fresh[0];
            const toastId = toast.info(fresh.length === 1 ? (item.kind === 'COMPLETED' ? 'Tarefa concluída' : 'Nova tarefa para você') : `${fresh.length} novas notificações`, {
              description: item.kind === 'COMPLETED' ? `${item.actorName} concluiu “${item.task.title}”.` : `${item.actorName} atribuiu “${item.task.title}” a você.`,
              action: { label: 'Ver tarefa', onClick: async () => {
                try {
                  await taskApi(`/notifications/${item.id}/read`, { method: 'PATCH' });
                  setRevision(value => value + 1); setOpen(false); navigate(`/tasks?task=${item.taskId}`);
                } catch (err) { toast.error(err.message); }
              } },
              duration: 8000,
            });
            toastIds.current.push(toastId);
            if (toastIds.current.length > 50) toast.dismiss(toastIds.current.shift());
          }
        }
        latest.current = Math.max(latest.current || 0, newest);
        setData(result);
        setError('');
      } catch (err) {
        if (!disposed && err.name !== 'AbortError') setError('Não foi possível atualizar as notificações.');
      } finally { fetching = false; }
    };
    load();
    const timer = setInterval(load, 30000);
    document.addEventListener('visibilitychange', load);
    window.addEventListener('focus', load);
    return () => { disposed = true; clearInterval(timer); controller?.abort(); document.removeEventListener('visibilitychange', load); window.removeEventListener('focus', load); };
  }, [navigate, revision]);

  useEffect(() => () => toastIds.current.forEach(id => toast.dismiss(id)), []);
  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);

  const read = async item => {
    if (busy) return;
    setBusy(true);
    try {
      await taskApi(`/notifications/${item.id}/read`, { method: 'PATCH' });
      setOpen(false); refresh(); navigate(`/tasks?task=${item.taskId}`);
    } catch (err) { toast.error(err.message); refresh(); } finally { setBusy(false); }
  };
  const readAll = async () => {
    if (!data?.items.length || busy) return;
    setBusy(true);
    try { await taskApi('/notifications/read-all', { method: 'PATCH', body: { through: data.items[0].id } }); refresh(); }
    catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  const more = async () => {
    if (!data?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await taskApi(`/notifications?before=${data.nextCursor}`);
      setData(current => ({ ...result, items: [...new Map([...current.items, ...result.items].map(item => [item.id, item])).values()] }));
    } catch (err) { toast.error(err.message); } finally { setLoadingMore(false); }
  };
  return <div ref={rootRef} className="relative shrink-0">
    <button ref={buttonRef} type="button" aria-label={`Notificações${data?.unreadCount ? `: ${data.unreadCount} não lidas` : ''}`} aria-expanded={open} aria-controls="task-notifications"
      onClick={() => { setOpen(value => !value); if (!open) refresh(); }} className="relative rounded-xl p-3 text-gray-500 hover:bg-primary/5 hover:text-primary">
      <Bell size={21} />{data?.unreadCount > 0 && <span className="absolute -right-1 top-0 min-w-5 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-5 text-white">{data.unreadCount > 99 ? '99+' : data.unreadCount}</span>}
    </button>
    {open && <section id="task-notifications" aria-label="Notificações" className="fixed right-3 top-[68px] z-[60] w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl sm:absolute sm:right-0 sm:top-full">
      <header className="flex items-center justify-between border-b px-4 py-3"><h2 className="font-semibold text-gray-800">Notificações</h2><button type="button" aria-label="Fechar notificações" onClick={() => { setOpen(false); buttonRef.current?.focus(); }} className="rounded-lg p-1 text-gray-400"><X size={18} /></button></header>
      <p className="px-4 py-3 text-xs text-gray-500">O contador mostra avisos não lidos. Ler um aviso não conclui a tarefa; acompanhe as pendências em Tarefas.</p>
      {data?.unreadCount > 0 && <button type="button" disabled={busy} onClick={readAll} className="px-4 py-2 text-xs font-semibold text-primary disabled:opacity-50">Marcar todas como lidas</button>}
      {error && <p role="alert" className="px-4 py-3 text-sm text-red-600">{error} <button type="button" onClick={refresh} className="underline">Tentar novamente</button></p>}
      <div className="max-h-[60vh] overflow-y-auto">
        {!data && !error && <p role="status" className="p-5 text-sm text-gray-500">Carregando…</p>}
        {data && !data.items.length && <p className="p-5 text-sm text-gray-500">Nenhuma notificação por enquanto. As atribuições e conclusões das tarefas que você delegou aparecerão aqui.</p>}
        {data?.items.map(item => <button key={item.id} type="button" disabled={busy} onClick={() => read(item)} className={`block w-full border-t border-gray-100 px-4 py-3 text-left hover:bg-gray-50 disabled:opacity-50 ${!item.readAt ? 'bg-primary/5' : ''}`}>
          <span className={`block text-xs font-semibold ${!item.readAt ? 'text-primary' : 'text-gray-500'}`}>{item.kind === 'COMPLETED' ? 'Tarefa concluída' : 'Tarefa atribuída'} · {item.readAt ? 'Lida' : '● Não lida'}</span>
          <span className="mt-1 block break-words text-sm font-semibold text-gray-800">{item.task.title}</span>
          <span className="mt-1 block text-xs text-gray-500">{item.kind === 'COMPLETED' ? 'Concluída' : 'Atribuída'} por {item.actorName}</span>
          {item.task.client && <span className="mt-1 block break-words text-xs text-gray-500">Cliente: {item.task.client.nome}</span>}
          {item.task.dueDate && <span className="mt-1 block text-xs text-gray-500">Prazo: {taskDateLabel(item.task.dueDate)}</span>}
          <time dateTime={item.createdAt} className="mt-2 block text-[11px] text-gray-400">{new Date(item.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}</time>
        </button>)}
        {data?.nextCursor && <button type="button" disabled={loadingMore} onClick={more} className="w-full p-3 text-sm text-primary">{loadingMore ? 'Carregando…' : 'Ver anteriores'}</button>}
      </div>
    </section>}
  </div>;
}
