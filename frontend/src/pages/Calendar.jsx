import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import Button from '../components/ui/Button';
import FancySelect from '../components/FancySelect';
import useMobileLayout from '../hooks/useMobileLayout';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarEvents,
  fetchCalendarStatus,
  fetchProperties,
  updateCalendarEvent,
} from '../services/api';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const inputClass = 'h-11 w-full rounded-xl border border-[#DDE4E8] bg-white px-3.5 text-sm text-slate-800 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10';

const dateKey = date => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateKey = value => {
  const [year, month, day] = String(value || '').split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const addDays = (date, amount) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const localDateTimeValue = value => {
  if (!value) return '';
  const date = new Date(value);
  return `${dateKey(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const nextVisitSlot = () => {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 90 * 60 * 1000);
  return { start: localDateTimeValue(start), end: localDateTimeValue(end) };
};

const eventStart = event => event.start?.dateTime ? new Date(event.start.dateTime) : parseDateKey(event.start?.date);
const eventEnd = event => event.end?.dateTime ? new Date(event.end.dateTime) : parseDateKey(event.end?.date);
const isAllDay = event => Boolean(event.start?.date);

const eventOccursOn = (event, day) => {
  const dayStart = parseDateKey(dateKey(day));
  const dayEnd = addDays(dayStart, 1);
  return eventStart(event) < dayEnd && eventEnd(event) > dayStart;
};

const eventTime = event => isAllDay(event)
  ? 'Dia inteiro'
  : eventStart(event).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const upcomingDateLabel = key => {
  const day = parseDateKey(key);
  const today = parseDateKey(dateKey(new Date()));
  const difference = Math.round((day - today) / (24 * 60 * 60 * 1000));
  const calendarDate = day.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  if (difference === 0) return `Hoje · ${calendarDate}`;
  if (difference === 1) return `Amanhã · ${calendarDate}`;
  const weekday = day.toLocaleDateString('pt-BR', { weekday: 'long' });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} · ${calendarDate}`;
};

const eventTone = title => {
  const normalized = String(title || '').toLocaleLowerCase('pt-BR');
  if (normalized.includes('visita')) return 'border-sky-200 bg-sky-50 text-sky-800';
  if (normalized.includes('engenharia')) return 'border-amber-200 bg-amber-50 text-amber-800';
  if (normalized.includes('capta')) return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (normalized.includes('folga')) return 'border-violet-200 bg-violet-50 text-violet-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
};

const EVENT_LEGEND = [
  { label: 'Visita', color: 'bg-sky-500' },
  { label: 'Captação', color: 'bg-emerald-500' },
  { label: 'Engenharia', color: 'bg-amber-500' },
  { label: 'Folga', color: 'bg-violet-500' },
  { label: 'Outros', color: 'bg-slate-400' },
];

const propertyLabel = property => [property.code, property.title].filter(Boolean).join(' · ');
const cleanPropertyTitle = value => String(value || '')
  .replace(/^\s*\d+(?:[.,]\d+)?\s*[-–]\s*/i, '')
  .replace(/\s*[-–]\s*\d+\s*(?:dorm(?:it[oó]rios?)?|quartos?).*$/i, '')
  .replace(/\s*,?\s*R\$\s*[\d.\s]+(?:,\d{2})?\s*$/i, '')
  .replace(/\s+/g, ' ')
  .trim();
const propertyVisitLocation = property => {
  const type = String(property?.propertyType || '').toLocaleLowerCase('pt-BR');
  const condominium = cleanPropertyTitle(property?.title);
  const neighborhood = String(property?.neighborhood || '').trim();
  return type.includes('apartamento') ? condominium || neighborhood : neighborhood || condominium;
};
const propertyVisitTitle = property => ['Visita', propertyVisitLocation(property)].filter(Boolean).join(' ');
const isAutomaticVisitTitle = title => /^Visita(?:\s*-\s*.*|\s+[^-()]*)?$/i.test(String(title || '').trim());
const isTimeExemptEvent = event => isAllDay(event) || String(event.title || '').toLocaleLowerCase('pt-BR').includes('folga');

const addMinutesToTime = (value, amount) => {
  const [hours, minutes] = String(value).split(':').map(Number);
  const total = Math.min(hours * 60 + minutes + amount, 23 * 60 + 45);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

function Field({ label, children, className = '' }) {
  return <label className={className}><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>{children}</label>;
}

function useCloseOnOutsideClick(ref, open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const close = event => {
      if (!ref.current?.contains(event.target)) onClose();
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [onClose, open, ref]);
}

function DatePickerField({ value, onChange, min }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => parseDateKey(value));
  const rootRef = useRef(null);
  useCloseOnOutsideClick(rootRef, open, () => setOpen(false));

  const firstDay = new Date(view.getFullYear(), view.getMonth(), 1);
  const calendarStart = addDays(firstDay, -firstDay.getDay());
  const days = Array.from({ length: 42 }, (_, index) => addDays(calendarStart, index));
  const selectedKey = value;
  const minimumKey = min || '';
  const today = dateKey(new Date());

  return <div ref={rootRef} className="relative">
    <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => { if (!open) setView(parseDateKey(value)); setOpen(current => !current); }} className={`${inputClass} flex items-center justify-between text-left font-semibold`}>
      <span>{parseDateKey(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')}</span>
      <CalendarDays className="h-4 w-4 text-slate-400" />
    </button>
    {open && <div role="dialog" aria-label="Escolher data" className="absolute left-0 top-full z-50 mt-2 w-[min(19rem,calc(100vw-3rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <strong className="px-2 text-sm capitalize text-slate-800">{MONTHS[view.getMonth()]} de {view.getFullYear()}</strong>
        <div className="flex gap-1"><button type="button" aria-label="Mês anterior" onClick={() => setView(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button><button type="button" aria-label="Próximo mês" onClick={() => setView(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button></div>
      </div>
      <div className="grid grid-cols-7">{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => <span key={`${day}-${index}`} className="py-1 text-center text-[10px] font-extrabold text-slate-400">{day}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-y-1">{days.map(day => {
        const key = dateKey(day);
        const selected = key === selectedKey;
        const isToday = key === today;
        const outside = day.getMonth() !== view.getMonth();
        const disabled = minimumKey && key < minimumKey;
        return <button key={key} type="button" disabled={disabled} onClick={() => { onChange(key); setOpen(false); }} className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition ${selected ? 'bg-primary text-white shadow-sm' : isToday ? 'bg-sky-100 text-primary' : outside ? 'text-slate-300 hover:bg-slate-50' : 'text-slate-700 hover:bg-slate-100'} disabled:cursor-not-allowed disabled:opacity-25`}>{day.getDate()}</button>;
      })}</div>
      <button type="button" onClick={() => { const key = dateKey(new Date()); if (!minimumKey || key >= minimumKey) onChange(key); setView(new Date()); setOpen(false); }} className="mt-2 rounded-lg px-2 py-1.5 text-xs font-bold text-primary hover:bg-primary/5">Hoje</button>
    </div>}
  </div>;
}

const TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const hours = String(Math.floor(index / 4)).padStart(2, '0');
  const minutes = String((index % 4) * 15).padStart(2, '0');
  return `${hours}:${minutes}`;
});

function TimePickerField({ value, onChange, options = TIME_OPTIONS }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selectedRef = useRef(null);
  useCloseOnOutsideClick(rootRef, open, () => setOpen(false));

  useEffect(() => {
    if (open) selectedRef.current?.scrollIntoView({ block: 'center' });
  }, [open]);

  return <div ref={rootRef} className="relative">
    <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)} className={`${inputClass} flex items-center justify-between text-left font-semibold`}>
      <span>{value}</span><Clock3 className="h-4 w-4 text-slate-400" />
    </button>
    {open && <div role="listbox" aria-label="Escolher horário" className="absolute left-0 top-full z-50 mt-2 max-h-64 w-full min-w-40 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl">
      {options.map(option => <button ref={option === value ? selectedRef : null} key={option} type="button" role="option" aria-selected={option === value} onClick={() => { onChange(option); setOpen(false); }} className={`block w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${option === value ? 'bg-primary text-white' : 'text-slate-700 hover:bg-slate-100'}`}>{option}</button>)}
    </div>}
  </div>;
}

function EventModal({ event, initialDate, initialTime, initialProperty, properties, events, onClose, onSaved, onDeleted }) {
  const slot = nextVisitSlot();
  const editingAllDay = event ? isAllDay(event) : false;
  const eventStartDate = event ? eventStart(event) : initialDate || parseDateKey(slot.start.slice(0, 10));
  const eventEndDate = event ? eventEnd(event) : addDays(eventStartDate, 1);
  const suggestedStart = initialTime || slot.start.slice(11);
  const suggestedEnd = addMinutesToTime(suggestedStart, 90);
  const [form, setForm] = useState(() => ({
    title: event?.title || (initialProperty ? propertyVisitTitle(initialProperty) : 'Visita'),
    propertyId: String(event?.propertyId || initialProperty?.id || ''),
    location: event?.location || initialProperty?.address || '',
    description: event?.description || '',
    allDay: editingAllDay,
    date: dateKey(eventStartDate),
    endDate: editingAllDay ? dateKey(addDays(eventEndDate, -1)) : dateKey(eventStartDate),
    startTime: event?.start?.dateTime ? localDateTimeValue(event.start.dateTime).slice(11) : suggestedStart,
    endTime: event?.end?.dateTime ? localDateTimeValue(event.end.dateTime).slice(11) : initialTime ? suggestedEnd : slot.end.slice(11),
    reminderMinutes: '30',
  }));
  const titleManuallyEditedRef = useRef(Boolean(event?.title) && !isAutomaticVisitTitle(event.title));
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const chooseStartTime = value => {
    setForm(current => ({ ...current, startTime: value, endTime: addMinutesToTime(value, 90) }));
  };
  const chooseProperty = value => {
    const property = properties.find(item => String(item.id) === String(value));
    setForm(current => ({
      ...current,
      propertyId: value,
      ...(property ? {
        title: titleManuallyEditedRef.current ? current.title : propertyVisitTitle(property),
        location: property.address || current.location,
      } : {}),
    }));
  };
  const submit = async submitEvent => {
    submitEvent.preventDefault();
    setSaving(true);
    try {
      const start = form.allDay ? form.date : new Date(`${form.date}T${form.startTime}`).toISOString();
      const end = form.allDay
        ? dateKey(addDays(parseDateKey(form.endDate || form.date), 1))
        : new Date(`${form.date}T${form.endTime}`).toISOString();
      const payload = { ...form, start, end, propertyId: form.propertyId || null };
      const saved = event?.id ? await updateCalendarEvent(event.id, payload) : await createCalendarEvent(payload);
      toast.success(event?.id ? 'Compromisso atualizado no Google Agenda.' : 'Visita adicionada ao Google Agenda.');
      onSaved(saved);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    setSaving(true);
    try {
      await deleteCalendarEvent(event.id);
      toast.success('Compromisso removido do Google Agenda.');
      onDeleted(event.id);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };
  const nearbyEvents = form.allDay || String(form.title).toLocaleLowerCase('pt-BR').includes('folga')
    ? []
    : events.filter(item => {
        if (item.id === event?.id || isTimeExemptEvent(item) || dateKey(eventStart(item)) !== form.date) return false;
        const candidateStart = new Date(`${form.date}T${form.startTime}`);
        return Math.abs(eventStart(item) - candidateStart) < 90 * 60 * 1000;
      });
  const copyForWhatsApp = async () => {
    const property = properties.find(item => String(item.id) === String(form.propertyId));
    const formattedDate = parseDateKey(form.date).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const schedule = form.allDay ? 'Dia inteiro' : `${form.startTime} às ${form.endTime}`;
    const message = [
      `📅 *${form.title || 'Compromisso'}*`,
      `🗓️ ${formattedDate}`,
      `⏰ ${schedule}`,
      property ? `🏠 ${propertyLabel(property)}` : '',
      form.location ? `📍 ${form.location}` : '',
      form.description ? `📝 ${form.description}` : '',
    ].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(message);
      toast.success('Informações copiadas para enviar pelo WhatsApp.');
    } catch {
      toast.error('Não foi possível copiar as informações.');
    }
  };

  return <div className="fixed inset-0 z-[9700] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
    <button type="button" aria-label="Fechar compromisso" className="absolute inset-0" onClick={onClose} />
    <form onSubmit={submit} className="mobile-safe-bottom relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-3xl">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
        <div><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-primary">Google Agenda</p><h2 className="mt-1 text-xl font-bold text-slate-900">{event ? 'Editar compromisso' : 'Agendar visita'}</h2></div>
        <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </header>
      <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <Field label="Imóvel" className="sm:col-span-2"><FancySelect searchable searchPlaceholder="Buscar por código, nome, bairro ou endereço..." ariaLabel="Imóvel da visita" value={form.propertyId} onChange={chooseProperty} placeholder="Sem imóvel vinculado" options={[{ value: '', label: 'Sem imóvel vinculado' }, ...properties.map(property => ({ value: String(property.id), label: propertyLabel(property), searchText: [property.code, property.title, property.neighborhood, property.city, property.address].filter(Boolean).join(' ') }))]} /></Field>
        <Field label="Título" className="sm:col-span-2"><input required maxLength={200} className={inputClass} value={form.title} onChange={e => { titleManuallyEditedRef.current = true; update('title', e.target.value); }} placeholder="Visita Bairro - Cliente (Responsável)" /></Field>
        <Field label="Data"><DatePickerField value={form.date} onChange={value => update('date', value)} /></Field>
        <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-slate-200 px-3.5 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.allDay} onChange={e => update('allDay', e.target.checked)} className="h-4 w-4 accent-primary" />Dia inteiro</label>
        {form.allDay ? <Field label="Último dia"><DatePickerField value={form.endDate} min={form.date} onChange={value => update('endDate', value)} /></Field> : <><Field label="Horário inicial"><TimePickerField value={form.startTime} onChange={chooseStartTime} options={TIME_OPTIONS.slice(0, -1)} /></Field><Field label="Horário final"><TimePickerField value={form.endTime} onChange={value => update('endTime', value)} /></Field></>}
        {nearbyEvents.length > 0 && <div role="alert" className="sm:col-span-2 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-bold">Horários muito próximos</p><p className="mt-0.5 text-xs leading-5">Existe {nearbyEvents.length === 1 ? 'outro compromisso' : `${nearbyEvents.length} outros compromissos`} com menos de 1h30 de diferença: {nearbyEvents.map(item => `${eventTime(item)} — ${item.title}`).join('; ')}.</p></div></div>}
        <Field label="Lembrete"><FancySelect ariaLabel="Antecedência do lembrete" value={form.reminderMinutes} onChange={value => update('reminderMinutes', value)} options={[{ value: '10', label: '10 minutos antes' }, { value: '30', label: '30 minutos antes' }, { value: '60', label: '1 hora antes' }, { value: '1440', label: '1 dia antes' }]} /></Field>
        <Field label="Local" className="sm:col-span-2"><input maxLength={500} className={inputClass} value={form.location} onChange={e => update('location', e.target.value)} placeholder="Endereço da visita" /></Field>
        <Field label="Observações" className="sm:col-span-2"><textarea rows={4} maxLength={4000} className={`${inputClass} h-auto resize-y py-3`} value={form.description} onChange={e => update('description', e.target.value)} placeholder="Cliente, corretor responsável e orientações para a visita" /></Field>
        {confirmingDelete && <div className="sm:col-span-2 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-semibold text-red-700">Remover definitivamente este compromisso da agenda?</p><div className="flex gap-2"><Button variant="secondary" size="sm" onClick={() => setConfirmingDelete(false)}>Voltar</Button><Button variant="danger" size="sm" loading={saving} onClick={remove}>Confirmar</Button></div></div>}
      </div>
      <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/95 px-5 py-4 backdrop-blur sm:px-6">
        <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={copyForWhatsApp}><Copy className="h-4 w-4" />Copiar para WhatsApp</Button>{event && !confirmingDelete && <Button variant="dangerSoft" onClick={() => setConfirmingDelete(true)}><Trash2 className="h-4 w-4" />Excluir</Button>}</div>
        <div className="flex gap-2"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" loading={saving} loadingLabel="Salvando...">{event ? 'Salvar alterações' : 'Agendar visita'}</Button></div>
      </footer>
    </form>
  </div>;
}

function AgendaEvent({ event, onClick, compact = false }) {
  const fullLabel = `${eventTime(event)} · ${event.title}${event.location ? ` · ${event.location}` : ''}`;
  return <button type="button" onClick={onClick} title={fullLabel} aria-label={fullLabel} className={`block w-full min-w-0 rounded-lg border px-2 py-1.5 text-left transition hover:brightness-95 ${eventTone(event.title)}`}>
    <span className={`block truncate font-bold ${compact ? 'text-[11px]' : 'text-sm'}`}>{!isAllDay(event) && <span className="mr-1 font-medium opacity-70">{eventTime(event)}</span>}{event.title}</span>
    {!compact && event.location && <span className="mt-1 flex items-center gap-1 truncate text-xs opacity-75"><MapPin className="h-3 w-3 shrink-0" />{event.location}</span>}
  </button>;
}

function DayEventsModal({ day, events, onClose, onSelect }) {
  return <div className="fixed inset-0 z-[9700] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
    <button type="button" aria-label="Fechar compromissos do dia" className="absolute inset-0" onClick={onClose} />
    <section className="mobile-safe-bottom relative max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-primary">Compromissos do dia</p><h2 className="mt-1 text-xl font-bold capitalize text-slate-900">{day.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</h2></div>
        <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </header>
      <div className="space-y-2">{events.map(event => <AgendaEvent key={event.id} event={event} onClick={() => onSelect(event)} />)}</div>
    </section>
  </div>;
}

const WEEK_START_HOUR = 7;
const WEEK_END_HOUR = 22;
const WEEK_HOUR_HEIGHT = 64;
const WEEK_HOURS = Array.from({ length: WEEK_END_HOUR - WEEK_START_HOUR }, (_, index) => WEEK_START_HOUR + index);
const minutesOfDay = date => date.getHours() * 60 + date.getMinutes();

function WeekView({ days, events, todayKey, onCreate, onEdit }) {
  const rangeStart = WEEK_START_HOUR * 60;
  const rangeEnd = WEEK_END_HOUR * 60;
  const totalHeight = WEEK_HOURS.length * WEEK_HOUR_HEIGHT;
  const now = new Date();

  return <div className="overflow-x-auto">
    <div className="min-w-[900px]">
      <div className="grid grid-cols-[54px_repeat(7,minmax(110px,1fr))] border-b border-slate-100 bg-white">
        <div />
        {days.map(day => {
          const today = dateKey(day) === todayKey;
          return <button key={dateKey(day)} type="button" onClick={() => onCreate(day)} className={`flex flex-col items-center gap-1 border-l border-slate-100 py-3 hover:bg-slate-50 ${today ? 'bg-sky-50/70' : ''}`}><span className="text-[10px] font-extrabold uppercase text-slate-400">{WEEKDAYS[day.getDay()]}</span><span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${today ? 'bg-primary text-white' : 'text-slate-700'}`}>{day.getDate()}</span></button>;
        })}
      </div>
      <div className="grid grid-cols-[54px_repeat(7,minmax(110px,1fr))] border-b border-slate-100 bg-slate-50/60">
        <div className="px-2 py-2 text-right text-[9px] font-bold uppercase text-slate-400">Dia</div>
        {days.map(day => {
          const allDayEvents = events.filter(event => isAllDay(event) && eventOccursOn(event, day));
          return <div key={dateKey(day)} className="min-h-10 space-y-1 border-l border-slate-100 p-1">{allDayEvents.map(event => <AgendaEvent key={event.id} event={event} compact onClick={() => onEdit(event)} />)}</div>;
        })}
      </div>
      <div className="grid grid-cols-[54px_repeat(7,minmax(110px,1fr))]">
        <div className="relative" style={{ height: totalHeight }}>{WEEK_HOURS.map(hour => <span key={hour} className="absolute right-2 -translate-y-2 text-[10px] font-semibold text-slate-400" style={{ top: (hour - WEEK_START_HOUR) * WEEK_HOUR_HEIGHT }}>{String(hour).padStart(2, '0')}:00</span>)}</div>
        {days.map(day => {
          const key = dateKey(day);
          const today = key === todayKey;
          const dayEvents = events.filter(event => !isAllDay(event) && eventOccursOn(event, day));
          const visibleEvents = dayEvents.filter(event => minutesOfDay(eventEnd(event)) > rangeStart && minutesOfDay(eventStart(event)) < rangeEnd);
          const nowMinutes = minutesOfDay(now);
          return <div key={key} className={`relative border-l border-slate-100 ${today ? 'bg-sky-50/35' : day.getDay() === 0 || day.getDay() === 6 ? 'bg-slate-50/60' : 'bg-white'}`} style={{ height: totalHeight, backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 63px, rgb(226 232 240 / 0.75) 64px)' }}>
            {WEEK_HOURS.map(hour => <button key={hour} type="button" aria-label={`Agendar em ${day.toLocaleDateString('pt-BR')} às ${hour}:00`} onClick={() => onCreate(day, `${String(hour).padStart(2, '0')}:00`)} className="absolute left-0 right-0 z-0 hover:bg-primary/5" style={{ top: (hour - WEEK_START_HOUR) * WEEK_HOUR_HEIGHT, height: WEEK_HOUR_HEIGHT }} />)}
            {visibleEvents.map(event => {
              const start = Math.max(minutesOfDay(eventStart(event)), rangeStart);
              const end = Math.min(minutesOfDay(eventEnd(event)), rangeEnd);
              const top = ((start - rangeStart) / 60) * WEEK_HOUR_HEIGHT;
              const height = Math.max(((end - start) / 60) * WEEK_HOUR_HEIGHT, 28);
              const conflict = dayEvents.some(other => other.id !== event.id && !isTimeExemptEvent(other) && Math.abs(eventStart(other) - eventStart(event)) < 90 * 60 * 1000);
              const label = `${eventTime(event)} · ${event.title}${event.location ? ` · ${event.location}` : ''}`;
              return <button key={event.id} type="button" title={label} aria-label={label} onClick={() => onEdit(event)} className={`absolute left-1 right-1 z-10 overflow-hidden rounded-lg border px-2 py-1 text-left text-[10px] font-bold leading-tight shadow-sm transition hover:z-20 hover:brightness-95 ${eventTone(event.title)} ${conflict ? 'ring-2 ring-amber-400' : ''}`} style={{ top, height }}><span className="block opacity-70">{eventTime(event)}</span><span className="block line-clamp-2">{event.title}</span></button>;
            })}
            {today && nowMinutes >= rangeStart && nowMinutes <= rangeEnd && <div className="pointer-events-none absolute left-0 right-0 z-30 h-px bg-red-500" style={{ top: ((nowMinutes - rangeStart) / 60) * WEEK_HOUR_HEIGHT }}><span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-500" /></div>}
          </div>;
        })}
      </div>
    </div>
  </div>;
}

function MobileWeekView({ days, events, todayKey, loading, onCreate, onEdit }) {
  if (loading) return <p className="p-10 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Atualizando agenda...</p>;
  return <div className="divide-y divide-slate-100">{days.map(day => {
    const dayEvents = events.filter(event => eventOccursOn(event, day));
    const today = dateKey(day) === todayKey;
    return <section key={dateKey(day)} className={today ? 'bg-sky-50/45' : 'bg-white'}>
      <header className="flex items-center justify-between gap-3 px-4 py-3"><div className="flex items-center gap-3"><span className={`flex h-10 w-10 flex-col items-center justify-center rounded-xl ${today ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'}`}><strong className="text-sm leading-none">{day.getDate()}</strong><span className="mt-0.5 text-[8px] font-bold uppercase">{WEEKDAYS[day.getDay()]}</span></span><div><h4 className="text-sm font-bold capitalize text-slate-800">{today ? 'Hoje' : day.toLocaleDateString('pt-BR', { weekday: 'long' })}</h4><p className="text-xs text-slate-400">{day.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</p></div></div><button type="button" onClick={() => onCreate(day)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-primary"><Plus className="h-4 w-4" /></button></header>
      <div className="space-y-2 px-4 pb-4">{dayEvents.length ? dayEvents.map(event => <AgendaEvent key={event.id} event={event} onClick={() => onEdit(event)} />) : <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">Sem compromissos</p>}</div>
    </section>;
  })}</div>;
}

function MobileMonthCalendar({ cursor, days, events, todayKey, loading, onCreate, onEdit }) {
  const defaultSelectedKey = cursor.getMonth() === new Date().getMonth() && cursor.getFullYear() === new Date().getFullYear()
    ? todayKey
    : dateKey(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  const [selectedKey, setSelectedKey] = useState(defaultSelectedKey);

  useEffect(() => {
    setSelectedKey(cursor.getMonth() === new Date().getMonth() && cursor.getFullYear() === new Date().getFullYear()
      ? todayKey
      : dateKey(new Date(cursor.getFullYear(), cursor.getMonth(), 1)));
  }, [cursor, todayKey]);

  if (loading) return <p className="p-10 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Atualizando agenda...</p>;

  const selectedDay = days.find(day => dateKey(day) === selectedKey) || parseDateKey(selectedKey);
  const selectedEvents = events.filter(event => eventOccursOn(event, selectedDay));
  const selectedIsToday = selectedKey === todayKey;

  return <div className="bg-slate-50/50">
    <div className="flex gap-3 overflow-x-auto border-b border-slate-100 bg-white px-3 py-2.5 no-scrollbar">
      {EVENT_LEGEND.map(item => <span key={item.label} className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-bold text-slate-500"><span className={`h-2 w-2 rounded-full ${item.color}`} />{item.label}</span>)}
    </div>
    <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
      {WEEKDAYS.map((day, index) => <div key={`${day}-${index}`} className={`py-2 text-center text-[9px] font-extrabold uppercase tracking-wide ${index === 0 || index === 6 ? 'text-slate-400' : 'text-slate-500'}`}>{day.slice(0, 1)}</div>)}
    </div>
    <div className="grid grid-cols-7 bg-slate-200/70 gap-px">
      {days.map(day => {
        const key = dateKey(day);
        const dayEvents = events.filter(event => eventOccursOn(event, day));
        const currentMonth = day.getMonth() === cursor.getMonth();
        const today = key === todayKey;
        const selected = key === selectedKey;
        return <div key={key} onClick={() => setSelectedKey(key)} className={`min-h-[76px] min-w-0 cursor-pointer p-1 transition ${currentMonth ? 'bg-white' : 'bg-slate-50'} ${selected ? 'relative z-[1] bg-sky-50 ring-2 ring-inset ring-primary/35' : ''}`}>
          <button type="button" onClick={event => { event.stopPropagation(); setSelectedKey(key); }} aria-label={`Ver ${day.toLocaleDateString('pt-BR')}`} className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold ${today ? 'bg-primary text-white shadow-sm' : currentMonth ? 'text-slate-700' : 'text-slate-300'}`}>{day.getDate()}</button>
          <div className="space-y-0.5">
            {dayEvents.slice(0, 2).map(event => <button key={event.id} type="button" onClick={click => { click.stopPropagation(); onEdit(event); }} title={event.title} className={`block w-full truncate rounded border px-1 py-0.5 text-left text-[8px] font-bold leading-3 ${eventTone(event.title)}`}>{event.title}</button>)}
            {dayEvents.length > 2 && <span className="block px-1 text-[8px] font-extrabold text-primary">+{dayEvents.length - 2}</span>}
          </div>
        </div>;
      })}
    </div>
    <section className="border-t border-slate-200 bg-white p-4">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-primary">{selectedIsToday ? 'Hoje' : 'Dia selecionado'}</p><h4 className="mt-0.5 truncate text-base font-bold capitalize text-slate-900">{selectedDay.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</h4><p className="text-xs text-slate-400">{selectedEvents.length ? `${selectedEvents.length} compromisso(s)` : 'Agenda livre'}</p></div>
        <button type="button" onClick={() => onCreate(selectedDay)} className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-white shadow-sm"><Plus className="h-4 w-4" />Agendar</button>
      </header>
      <div className="space-y-2">{selectedEvents.length ? selectedEvents.map(event => <AgendaEvent key={event.id} event={event} onClick={() => onEdit(event)} />) : <button type="button" onClick={() => onCreate(selectedDay)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-5 text-sm font-semibold text-slate-400"><CalendarDays className="h-4 w-4" />Adicionar compromisso neste dia</button>}</div>
    </section>
  </div>;
}

export default function CalendarPage() {
  const mobile = useMobileLayout();
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState('month');
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [weekCursor, setWeekCursor] = useState(() => new Date());
  const [events, setEvents] = useState([]);
  const [properties, setProperties] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState(null);
  const [expandedDay, setExpandedDay] = useState(null);
  const [initialDate, setInitialDate] = useState(null);
  const [initialTime, setInitialTime] = useState(null);
  const [initialPropertyId] = useState(() => searchParams.get('newProperty'));

  const grid = useMemo(() => {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = addDays(monthStart, -monthStart.getDay());
    const days = Array.from({ length: 42 }, (_, index) => addDays(start, index));
    return { start, end: addDays(start, 42), days };
  }, [cursor]);

  const week = useMemo(() => {
    const normalized = parseDateKey(dateKey(weekCursor));
    const start = addDays(normalized, -normalized.getDay());
    return { start, end: addDays(start, 7), days: Array.from({ length: 7 }, (_, index) => addDays(start, index)) };
  }, [weekCursor]);
  const visibleRange = viewMode === 'week' ? week : grid;

  useEffect(() => {
    Promise.all([fetchCalendarStatus(), fetchProperties()])
      .then(([status, propertyList]) => {
        setConfigured(Boolean(status.configured));
        const nextProperties = Array.isArray(propertyList) ? propertyList : [];
        setProperties(nextProperties);
        const property = initialPropertyId ? nextProperties.find(item => String(item.id) === initialPropertyId) : null;
        if (property) setEditor({ new: true, property });
      })
      .catch(requestError => setError(requestError.message));
  }, [initialPropertyId]);

  useEffect(() => {
    let active = true;
    fetchCalendarEvents(visibleRange.start.toISOString(), visibleRange.end.toISOString())
      .then(result => {
        if (!active) return;
        setEvents(Array.isArray(result.events) ? result.events : []);
        setError('');
        setConfigured(true);
      })
      .catch(requestError => {
        if (!active) return;
        setError(requestError.message);
        if (/configure/i.test(requestError.message)) setConfigured(false);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [revision, visibleRange.end, visibleRange.start]);

  const closeEditor = () => {
    setEditor(null);
    setInitialDate(null);
    setInitialTime(null);
    if (searchParams.has('newProperty')) {
      setSearchParams(current => {
        const next = new URLSearchParams(current);
        next.delete('newProperty');
        return next;
      }, { replace: true });
    }
  };
  const saved = event => {
    setEvents(current => [...current.filter(item => item.id !== event.id), event].sort((a, b) => eventStart(a) - eventStart(b)));
    closeEditor();
  };
  const removed = eventId => {
    setEvents(current => current.filter(item => item.id !== eventId));
    closeEditor();
  };
  const reload = () => {
    setLoading(true);
    setRevision(value => value + 1);
  };
  const changeViewMode = nextMode => {
    if ((viewMode === 'week') !== (nextMode === 'week')) setLoading(true);
    setViewMode(nextMode);
  };
  const goToPeriod = amount => {
    setLoading(true);
    if (viewMode === 'week') setWeekCursor(current => addDays(current, amount * 7));
    else setCursor(current => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };
  const goToToday = () => {
    const today = new Date();
    setLoading(true);
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
    setWeekCursor(today);
  };
  const createAt = (day, time = null) => {
    setInitialDate(day);
    setInitialTime(time);
    setEditor({ new: true });
  };
  const todayKey = dateKey(new Date());
  const visibleEvents = events.filter(event => eventEnd(event) > visibleRange.start && eventStart(event) < visibleRange.end);
  const upcoming = events.filter(event => eventEnd(event) >= new Date()).slice(0, 6);
  const upcomingGroups = Object.values(upcoming.reduce((groups, event) => {
    const key = dateKey(eventStart(event));
    if (!groups[key]) groups[key] = { key, events: [] };
    groups[key].events.push(event);
    return groups;
  }, {}));
  const periodTitle = viewMode === 'week'
    ? `${week.start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')} – ${addDays(week.end, -1).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')}`
    : `${MONTHS[cursor.getMonth()]} de ${cursor.getFullYear()}`;

  return <div className="mx-auto flex min-h-full max-w-[1600px] flex-col p-3 sm:p-4 lg:p-6">
    <section className="app-card mb-4 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between lg:p-5">
      <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Agenda compartilhada</p><h2 className="mt-1 text-2xl font-bold text-slate-900">Visitas e compromissos da equipe</h2><p className="mt-1 text-sm text-slate-500">Tudo o que for alterado aqui também será atualizado no Google Agenda.</p></div>
      <div className="flex gap-2"><Button variant="secondary" size="icon" aria-label="Atualizar agenda" onClick={reload}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button><Button onClick={() => createAt(new Date())}><Plus className="h-4 w-4" />Agendar visita</Button></div>
    </section>

    {!configured && <div role="alert" className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><p className="font-bold">Falta concluir a conexão com o Google Agenda</p><p className="mt-1 text-sm">Ative a Calendar API, compartilhe a agenda com a conta de serviço e configure <code className="font-bold">GOOGLE_CALENDAR_ID</code> no servidor.</p></div>}
    {error && configured && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><span>{error}</span><button type="button" className="font-bold underline" onClick={reload}>Tentar novamente</button></div>}

    <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="app-card min-w-0 overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-3 sm:p-4">
          <div className="flex items-center gap-2"><Button variant="secondary" size="sm" onClick={goToToday}>Hoje</Button><button type="button" onClick={() => goToPeriod(-1)} aria-label={viewMode === 'week' ? 'Semana anterior' : 'Mês anterior'} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><ChevronLeft className="h-5 w-5" /></button><button type="button" onClick={() => goToPeriod(1)} aria-label={viewMode === 'week' ? 'Próxima semana' : 'Próximo mês'} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><ChevronRight className="h-5 w-5" /></button></div>
          <h3 className="text-center text-base font-bold capitalize text-slate-900 sm:text-lg">{periodTitle}</h3>
          <div className="flex items-center gap-2"><span className="hidden rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500 sm:inline-flex">{visibleEvents.length} compromisso(s)</span><div className="inline-flex rounded-xl bg-slate-100 p-1">{mobile ? <><button type="button" onClick={() => changeViewMode('month')} className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${viewMode === 'month' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>Lista</button><button type="button" onClick={() => changeViewMode('calendar')} className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${viewMode === 'calendar' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>Calendário</button><button type="button" onClick={() => changeViewMode('week')} className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${viewMode === 'week' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>Semana</button></> : <><button type="button" onClick={() => changeViewMode('month')} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${viewMode === 'month' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>Mês</button><button type="button" onClick={() => changeViewMode('week')} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${viewMode === 'week' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>Semana</button></>}</div></div>
        </header>

        <div className="hidden flex-wrap items-center justify-end gap-x-4 gap-y-1 border-b border-slate-100 bg-white px-4 py-2 sm:flex">
          <span className="mr-auto text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Categorias</span>
          {EVENT_LEGEND.map(item => <span key={item.label} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500"><span className={`h-2 w-2 rounded-full ${item.color}`} />{item.label}</span>)}
        </div>

        {mobile ? viewMode === 'week'
          ? <MobileWeekView days={week.days} events={visibleEvents} todayKey={todayKey} loading={loading} onCreate={createAt} onEdit={setEditor} />
          : viewMode === 'calendar'
            ? <MobileMonthCalendar cursor={cursor} days={grid.days} events={visibleEvents} todayKey={todayKey} loading={loading} onCreate={createAt} onEdit={setEditor} />
            : <div className="divide-y divide-slate-100">{loading ? <p className="p-10 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Atualizando agenda...</p> : visibleEvents.length ? visibleEvents.map(event => <article key={event.id} className="flex gap-3 p-4"><div className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-slate-100 py-2"><strong className="text-lg text-slate-800">{eventStart(event).getDate()}</strong><span className="text-[10px] font-bold uppercase text-slate-400">{WEEKDAYS[eventStart(event).getDay()]}</span></div><div className="min-w-0 flex-1"><AgendaEvent event={event} onClick={() => setEditor(event)} />{event.htmlLink && <a href={event.htmlLink} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary">Abrir no Google <ExternalLink className="h-3 w-3" /></a>}</div></article>) : <p className="p-10 text-center text-sm text-slate-500">Nenhum compromisso neste mês.</p>}</div>
          : viewMode === 'week' ? <WeekView days={week.days} events={visibleEvents} todayKey={todayKey} onCreate={createAt} onEdit={setEditor} /> : <div>
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">{WEEKDAYS.map((day, index) => <div key={day} className={`px-2 py-2 text-center text-[10px] font-extrabold uppercase tracking-wide text-slate-400 ${index === 0 || index === 6 ? 'bg-slate-100/70' : ''}`}>{day}</div>)}</div>
          <div className="grid grid-cols-7">{grid.days.map(day => {
            const dayEvents = events.filter(event => eventOccursOn(event, day));
            const currentMonth = day.getMonth() === cursor.getMonth();
            const today = dateKey(day) === todayKey;
            const weekend = day.getDay() === 0 || day.getDay() === 6;
            return <div key={dateKey(day)} className={`group min-h-[118px] border-b border-r border-slate-100 p-1.5 ${today ? 'bg-sky-50/70 shadow-[inset_0_3px_0_0_rgb(14_165_233_/_0.45)]' : currentMonth ? weekend ? 'bg-slate-50/75' : 'bg-white' : 'bg-slate-100/60'}`}>
              <button type="button" onClick={() => { setInitialDate(day); setEditor({ new: true }); }} aria-label={`Agendar em ${day.toLocaleDateString('pt-BR')}`} className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${today ? 'bg-primary text-white' : currentMonth ? 'text-slate-700 group-hover:bg-slate-100' : 'text-slate-300'}`}>{day.getDate()}</button>
              <div className="space-y-1">{dayEvents.slice(0, 3).map(event => <AgendaEvent key={event.id} event={event} compact onClick={() => setEditor(event)} />)}{dayEvents.length > 3 && <button type="button" onClick={() => setExpandedDay({ day, events: dayEvents })} className="px-1 text-[10px] font-bold text-primary">+ {dayEvents.length - 3} compromisso(s)</button>}</div>
            </div>;
          })}</div>
        </div>}
      </section>

      <aside className="space-y-4">
        <section className="app-card p-4"><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Clock3 className="h-4 w-4" /></span><div><h3 className="font-bold text-slate-900">Próximos compromissos</h3><p className="text-xs text-slate-500">A partir de agora</p></div></div><div className="mt-4 space-y-4">{upcomingGroups.length ? upcomingGroups.map(group => <div key={group.key}><p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">{upcomingDateLabel(group.key)}</p><div className="space-y-2">{group.events.map(event => <AgendaEvent key={event.id} event={event} onClick={() => setEditor(event)} />)}</div></div>) : <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-400">Agenda livre.</p>}</div></section>
      </aside>
    </div>

    {editor && <EventModal event={editor.new ? null : editor} initialDate={initialDate} initialTime={initialTime} initialProperty={editor.property} properties={properties} events={events} onClose={closeEditor} onSaved={saved} onDeleted={removed} />}
    {expandedDay && <DayEventsModal day={expandedDay.day} events={expandedDay.events} onClose={() => setExpandedDay(null)} onSelect={event => { setExpandedDay(null); setEditor(event); }} />}
  </div>;
}
