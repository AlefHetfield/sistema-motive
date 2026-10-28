import { CalendarClock } from 'lucide-react';
import { engineeringValidity } from '../../../../shared/engineeringValidity';
import { engineeringDate } from './engineeringForm';

const tones = {
  valid: 'bg-emerald-50 text-emerald-700',
  soon: 'bg-amber-50 text-amber-800',
  expired: 'bg-red-50 text-red-700',
  undefined: 'bg-slate-100 text-slate-500',
};

export default function EngineeringValidity({ date, today, showDate = true }) {
  const { expiresOn, daysRemaining, state } = engineeringValidity(date, today);
  const count = Math.abs(daysRemaining);
  const days = `${count} ${count === 1 ? 'dia' : 'dias'}`;
  const label = !expiresOn ? 'Vencimento não definido' : daysRemaining < 0 ? `Vencida há ${days}` : daysRemaining === 0 ? 'Vence hoje' : `${daysRemaining === 1 ? 'Falta' : 'Faltam'} ${days}`;
  return <div className="space-y-1.5">
    {showDate && expiresOn && <time dateTime={expiresOn} className="block text-xs font-medium text-slate-700">{engineeringDate(expiresOn)}</time>}
    <span className={`inline-flex max-w-full items-start gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium leading-4 ${tones[state]}`}>
      <CalendarClock size={13} aria-hidden="true" className="mt-0.5 shrink-0" /><span>{label}</span>
    </span>
  </div>;
}
