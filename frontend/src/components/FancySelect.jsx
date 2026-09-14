import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function FancySelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Selecione...',
  className = '',
  disabled = false,
  ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex h-11 w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3.5 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 ${disabled ? 'cursor-not-allowed bg-gray-100 text-gray-400 opacity-70' : 'cursor-pointer hover:border-gray-300 hover:bg-gray-50/60'}`}
      >
        <span className={`truncate ${selected ? 'text-gray-800' : 'text-gray-500'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div role="listbox" aria-label={ariaLabel} className="absolute z-[70] mt-2 w-full overflow-hidden rounded-2xl border border-gray-200 bg-white/95 p-1.5 shadow-2xl backdrop-blur-xl">
          <div className="max-h-60 overflow-y-auto">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400">Sem opções</div>
            ) : (
              options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    type="button"
                    key={opt.value ?? opt.label}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange && onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`flex min-h-10 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-all ${isSelected ? 'bg-primary/10 font-semibold text-primary' : 'text-gray-800 hover:bg-gray-50'}`}
                  >
                    {isSelected ? <Check size={16} className="text-primary" /> : <span className="w-4" />}
                    <span className="truncate">{opt.label}</span>
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
