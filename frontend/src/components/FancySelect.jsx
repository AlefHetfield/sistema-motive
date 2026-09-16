import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

function normalizeTypeahead(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

export default function FancySelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Selecione...',
  className = '',
  disabled = false,
  ariaLabel,
  size = 'default',
  typeahead = false,
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const containerRef = useRef(null);
  const selectedOptionRef = useRef(null);
  const typeBufferRef = useRef('');
  const typeTimerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    selectedOptionRef.current?.scrollIntoView({ block: 'nearest' });
  }, [open, value]);

  useEffect(() => () => {
    if (typeTimerRef.current) window.clearTimeout(typeTimerRef.current);
  }, []);

  const selected = options.find((option) => option.value === value);

  const toggleOpen = () => {
    if (!open) {
      const rect = containerRef.current?.getBoundingClientRect();
      setDropUp(Boolean(rect && window.innerHeight - rect.bottom < 280 && rect.top > 280));
    }
    setOpen((current) => !current);
  };

  const chooseByKeyboard = (event) => {
    if (!typeahead || disabled || event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
    const character = normalizeTypeahead(event.key);
    if (!character) return;

    event.preventDefault();
    if (typeTimerRef.current) window.clearTimeout(typeTimerRef.current);
    typeBufferRef.current += character;

    let match = options.find((option) => !option.disabled && normalizeTypeahead(option.label).startsWith(typeBufferRef.current));
    if (!match && typeBufferRef.current.length > 1) {
      typeBufferRef.current = character;
      match = options.find((option) => !option.disabled && normalizeTypeahead(option.label).startsWith(character));
    }

    if (match) onChange?.(match.value);
    typeTimerRef.current = window.setTimeout(() => {
      typeBufferRef.current = '';
    }, 800);
  };

  const moveSelection = (direction) => {
    const enabledOptions = options.filter((option) => !option.disabled);
    if (!enabledOptions.length) return;
    const currentIndex = enabledOptions.findIndex((option) => option.value === value);
    const nextIndex = currentIndex < 0 ? 0 : Math.min(Math.max(currentIndex + direction, 0), enabledOptions.length - 1);
    onChange?.(enabledOptions[nextIndex].value);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) setOpen(true);
            moveSelection(event.key === 'ArrowDown' ? 1 : -1);
            return;
          }
          chooseByKeyboard(event);
        }}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between rounded-xl border border-[#DDE4E8] bg-white text-sm shadow-[0_1px_2px_rgba(23,47,67,0.04)] outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 ${size === 'compact' ? 'h-10 px-3' : 'h-11 px-3.5'} ${disabled ? 'cursor-not-allowed bg-gray-100 text-gray-400 opacity-70' : 'cursor-pointer hover:border-[#BAC9D2] hover:bg-slate-50/60'}`}
      >
        <span className={`truncate ${selected ? 'text-gray-800' : 'text-gray-500'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div role="listbox" aria-label={ariaLabel} className={`absolute z-[70] min-w-full overflow-hidden rounded-2xl border border-[#DDE4E8] bg-white/95 p-1.5 shadow-[0_18px_45px_rgba(23,47,67,0.18)] backdrop-blur-xl ${dropUp ? 'bottom-full mb-2' : 'mt-2'}`}>
          <div className="max-h-60 overflow-y-auto">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400">Sem opções</div>
            ) : (
              options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    ref={isSelected ? selectedOptionRef : null}
                    type="button"
                    key={option.value ?? option.label}
                    role="option"
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    onClick={() => {
                      if (option.disabled) return;
                      onChange?.(option.value);
                      setOpen(false);
                    }}
                    className={`flex min-h-10 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-all ${option.disabled ? 'cursor-not-allowed text-gray-300' : isSelected ? 'bg-primary/10 font-semibold text-primary' : 'text-gray-800 hover:bg-slate-50'}`}
                  >
                    {isSelected ? <Check size={16} className="text-primary" /> : <span className="w-4" />}
                    <span className="truncate">{option.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
