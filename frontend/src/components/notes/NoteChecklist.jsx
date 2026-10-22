import { useRef, useState } from 'react';
import { Plus, X, ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';

export default function NoteChecklist({ items = [], onChange, disabled }) {
  const inputRefs = useRef(new Map());
  const [showCompleted, setShowCompleted] = useState(true);
  const update = (id, values) => onChange(items.map(item => item.id === id ? { ...item, ...values } : item));
  const add = () => { const id = crypto.randomUUID(); onChange([...items, { id, text: '', checked: false }]); requestAnimationFrame(() => inputRefs.current.get(id)?.focus()); };
  const pending = items.filter(item => !item.checked);
  const completed = items.filter(item => item.checked);
  const move = (group, index, direction) => { const next = [...items]; const from = items.indexOf(group[index]); const to = items.indexOf(group[index + direction]); [next[from], next[to]] = [next[to], next[from]]; onChange(next); };
  const rows = group => group.map((item, index) => <div key={item.id} className="note-checklist-row flex items-start gap-2 group">
      <input type="checkbox" disabled={disabled} checked={item.checked} onChange={event => update(item.id, { checked: event.target.checked })} aria-label={`Marcar ${item.text || 'item vazio'} como ${item.checked ? 'pendente' : 'concluído'}`} className="mt-3.5 h-4 w-4 accent-[#315b78] shrink-0" />
      <input ref={element => { if (element) inputRefs.current.set(item.id, element); else inputRefs.current.delete(item.id); }} aria-label={`Texto do item ${index + 1}`} value={item.text} maxLength={500} disabled={disabled} onChange={event => update(item.id, { text: event.target.value })} onKeyDown={event => { if (event.key === 'Enter' && !disabled && items.length < 100) { event.preventDefault(); add(); } }} placeholder="Item da lista" className={`w-full min-w-0 bg-transparent border-b border-[#172f4312] py-2.5 text-sm outline-none focus:border-[#315b78] ${item.checked ? 'line-through text-slate-400' : ''}`} />
      {!disabled && <div className="note-checklist-actions flex shrink-0"><button type="button" className="note-icon !w-8 !min-w-8" disabled={!index} onClick={() => move(group, index, -1)} aria-label={`Mover item ${index + 1} para cima`}><ArrowUp size={14} /></button><button type="button" className="note-icon !w-8 !min-w-8" disabled={index === group.length - 1} onClick={() => move(group, index, 1)} aria-label={`Mover item ${index + 1} para baixo`}><ArrowDown size={14} /></button><button type="button" className="note-icon !w-8 !min-w-8" onClick={() => onChange(items.filter(value => value.id !== item.id))} aria-label={`Remover item ${index + 1}`}><X size={16} /></button></div>}
    </div>);
  return <div className="note-checklist space-y-1">
    {rows(pending)}
    {!disabled && items.length < 100 && <button className="note-button !border-transparent !bg-transparent !text-slate-400" onClick={add}><Plus size={16} />Item da lista</button>}
    {completed.length > 0 && <section className="border-t border-slate-200/60 pt-2 mt-3"><button type="button" className="flex items-center gap-2 text-xs text-slate-400" aria-expanded={showCompleted} onClick={() => setShowCompleted(value => !value)}><ChevronDown size={14} className={showCompleted ? '' : '-rotate-90'} />{completed.length} {completed.length === 1 ? 'item concluído' : 'itens concluídos'}</button>{showCompleted && rows(completed)}</section>}
  </div>;
}
