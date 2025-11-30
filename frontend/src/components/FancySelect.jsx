import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function FancySelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Selecione...',
  className = '',
  disabled = false,
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
        className={`w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary focus:bg-white transition-all flex items-center justify-between ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-gray-300'}`}
      >
        <span className={`truncate ${selected ? 'text-gray-800' : 'text-gray-500'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full bg-white/95 backdrop-blur-xl border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
          <div className="max-h-60 overflow-y-auto py-1">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400">Sem opções</div>
            ) : (
              options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    type="button"
                    key={opt.value ?? opt.label}
                    onClick={() => {
                      onChange && onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-all ${isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-gray-50 text-gray-800'}`}
                  >
                    {isSelected ? <Check size={16} className="text-primary" /> : <span className="w-4" />}
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })
            )}
          </div>
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 text-right">
            <button
              type="button"
              onClick={() => {
                onChange && onChange('');
                setOpen(false);
              }}
              className="text-xs px-2.5 py-1.5 rounded-lg text-gray-700 hover:bg-gray-200 transition"
            >
              Limpar seleção
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
