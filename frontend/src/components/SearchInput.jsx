import { Search, X } from 'lucide-react';
import { useRef } from 'react';
import { controlClass } from './ui/styles';

export default function SearchInput({ value, onChange, onClear, onSubmit, label, placeholder, id, className = '' }) {
  const inputRef = useRef(null);
  return <div className={`relative min-w-0 ${className}`}>
    <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
    <input ref={inputRef} id={id} type="text" aria-label={label} placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && onSubmit) { event.preventDefault(); onSubmit(); } }} className={`${controlClass} pl-10 pr-12`} />
    {value && <button type="button" aria-label="Limpar busca" onClick={() => { onClear(); inputRef.current?.focus(); }} className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"><X size={17} /></button>}
  </div>;
}
