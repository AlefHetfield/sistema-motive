import { taskToday } from '../utils/taskDates';

export default function ClientAgeAvatar({ createdAt, compact = false, large = false }) {
  const now = new Date();
  const created = createdAt ? new Date(createdAt) : null;
  const valid = created && !Number.isNaN(created.getTime()) && created <= now;
  const days = valid
    ? Math.round((Date.parse(`${taskToday(now)}T00:00:00Z`) - Date.parse(`${taskToday(created)}T00:00:00Z`)) / 86400000)
    : null;
  const label = days === null ? '—' : days === 0 ? 'Hoje' : `${days}d`;
  const colors = days === null ? 'bg-slate-100 text-slate-600'
    : days <= 30 ? 'bg-green-100 text-green-800'
    : days <= 45 ? 'bg-yellow-100 text-yellow-800'
    : days <= 60 ? 'bg-orange-100 text-orange-800'
    : 'bg-red-100 text-red-800';
  const description = days === null
    ? 'Data de cadastro não disponível'
    : `Cadastrado ${days === 0 ? 'hoje' : `há ${days} ${days === 1 ? 'dia' : 'dias'}`} · ${created.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;

  return (
    <div
      title={description}
      aria-label={description}
      className={`flex ${compact ? 'h-8 w-8' : large ? 'h-11 w-11' : 'h-9 w-9'} shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums ${colors}`}
    >
      {label}
    </div>
  );
}
