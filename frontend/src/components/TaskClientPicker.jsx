import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { taskApi } from '../services/api';

export default function TaskClientPicker({ client, onSelect }) {
  const listId = useId();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(-1);
  const term = query.trim();

  useEffect(() => {
    if (!open || term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const found = await taskApi(`/clients?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        if (!controller.signal.aborted) setResults(found);
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, term, open]);

  const search = value => {
    setQuery(value); setResults([]); setActive(-1); setError('');
    setLoading(value.trim().length >= 2); setOpen(true);
  };
  const select = item => {
    onSelect(item); setQuery(''); setResults([]); setOpen(false); setActive(-1); setLoading(false);
    inputRef.current?.focus();
  };
  const showResults = open && term.length >= 2;
  return <div className="space-y-3" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActive(-1); }
  }}>
    <input ref={inputRef} role="combobox" aria-label="Pesquisar cliente" aria-autocomplete="list" aria-expanded={showResults}
      aria-controls={showResults ? listId : undefined} aria-activedescendant={showResults && active >= 0 ? `${listId}-${active}` : undefined}
      autoComplete="off" maxLength={200} placeholder={client ? 'Buscar outro cliente…' : 'Digite o nome do cliente…'}
      className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
      value={query} onChange={event => search(event.target.value)} onFocus={() => { if (!open && term.length >= 2) search(query); }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); setActive(-1); }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          if (!open) { search(query); return; }
          if (results.length) setActive(index => event.key === 'ArrowDown' ? (index + 1) % results.length : (index <= 0 ? results.length : index) - 1);
        }
        if (event.key === 'Enter') { event.preventDefault(); if (showResults && active >= 0 && results[active]) select(results[active]); }
      }} />
    {showResults && <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <ul id={listId} role="listbox" aria-label="Clientes encontrados" aria-busy={loading} className="max-h-52 overflow-y-auto">
        {results.map((item, index) => <li key={item.id} id={`${listId}-${index}`} role="option" aria-selected={active === index}
          className={`cursor-pointer px-3 py-2.5 text-sm hover:bg-primary/5 ${active === index ? 'bg-primary/10 text-primary' : 'text-gray-700'}`}
          onMouseDown={event => event.preventDefault()} onClick={() => select(item)}
          ref={element => { if (element && active === index) element.scrollIntoView({ block: 'nearest' }); }}>
          <span className="block break-words font-medium">{item.nome}</span><span className="text-xs text-gray-400">Cliente #{item.id}</span>
        </li>)}
      </ul>
      <p role="status" className="px-3 py-2 text-xs text-gray-500">{loading ? 'Buscando clientes…' : error || (results.length ? `${results.length} sugestão(ões). Selecione um cliente ou refine o nome.` : 'Nenhum cliente encontrado.')}</p>
    </div>}
    {!showResults && <p className="text-xs text-gray-500">Digite pelo menos 2 letras para buscar.</p>}
    {client && <div className="flex items-center gap-2 rounded-xl bg-primary/5 px-3 py-2.5">
      <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium text-gray-700">{client.nome}</p>
        <Link className="text-xs text-primary underline" to={`/clients?client=${client.id}`}>Abrir ficha do cliente</Link></div>
      <button type="button" aria-label="Remover cliente vinculado" onClick={() => onSelect(null)} className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-red-600"><X size={16} /></button>
    </div>}
  </div>;
}
