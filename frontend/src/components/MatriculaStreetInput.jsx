import { useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import { matchStreetSuggestions, normalizeStreetQuery } from '../utils/matriculaStreets';

export default function MatriculaStreetInput({ value, city, streets, onChange, inputClass }) {
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(-1);
  const catalog = useMemo(() => streets.map(street => ({ ...street, key: normalizeStreetQuery(street.name) })), [streets]);
  const suggestions = useMemo(() => matchStreetSuggestions(catalog, value, city), [catalog, value, city]);
  const open = focused && !dismissed && normalizeStreetQuery(value).length >= 2 && suggestions.length > 0;
  const activeIndex = active < suggestions.length ? active : -1;

  const select = name => {
    onChange(name);
    setActive(-1);
    setDismissed(true);
  };

  const handleKeyDown = event => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setDismissed(true);
      setActive(-1);
    } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && suggestions.length) {
      event.preventDefault();
      setDismissed(false);
      setActive(current => event.key === 'ArrowDown'
        ? (current + 1) % suggestions.length
        : (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === 'Enter') {
      if (open && activeIndex >= 0) {
        event.preventDefault();
        select(suggestions[activeIndex].name);
      } else {
        setDismissed(true);
      }
    }
  };

  return <div className="relative min-w-0">
    <label className="block text-sm font-medium text-gray-700" htmlFor="matricula-street">Rua ou avenida</label>
    <input id="matricula-street" role="combobox" aria-autocomplete="list" aria-expanded={open}
      aria-controls={open ? 'matricula-street-options' : undefined}
      aria-activedescendant={open && activeIndex >= 0 ? `matricula-street-option-${activeIndex}` : undefined}
      aria-describedby="matricula-street-hint" className={inputClass} value={value} maxLength={180}
      placeholder="Ex.: Rua Jatobá" autoComplete="off"
      onChange={event => { onChange(event.target.value); setDismissed(false); setActive(-1); }}
      onFocus={() => { setFocused(true); setDismissed(false); setActive(-1); }}
      onBlur={() => { setFocused(false); setActive(-1); }} onKeyDown={handleKeyDown} />
    {open && <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
      <p className="border-b border-gray-100 px-3 py-2 text-xs text-gray-500">Ruas da base · selecione para preencher</p>
      <ul id="matricula-street-options" role="listbox" aria-label="Sugestões de ruas">
        {suggestions.map((street, index) => <li key={street.name} role="presentation">
          <button type="button" role="option" id={`matricula-street-option-${index}`} aria-selected={activeIndex === index}
            tabIndex={-1} onPointerDown={event => event.preventDefault()} onClick={() => select(street.name)}
            className={`flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm ${activeIndex === index ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-50'}`}>
            <MapPin size={15} className="mt-0.5 shrink-0" /><span className="break-words">{street.name}</span>
          </button>
        </li>)}
      </ul>
    </div>}
    <p id="matricula-street-hint" className="mt-1.5 text-xs leading-5 text-gray-500">Digite ao menos 2 caracteres. Use as setas e Enter para selecionar; depois clique em Buscar ou pressione Enter novamente.</p>
  </div>;
}
