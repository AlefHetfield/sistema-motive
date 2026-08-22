import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Loader2, MapPin, Search } from 'lucide-react';
import { loadGoogleMaps } from '../../lib/googleMaps';

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();

const predictionText = value => value?.text || value?.toString?.() || '';

export default function PropertyAddressSearch({
  value,
  onChange,
  properties = [],
  onSelectProperty,
  onSelectAddress,
  placeholder = 'Buscar endereço ou imóvel...',
  autoFocus = false,
}) {
  const rootRef = useRef(null);
  const requestRef = useRef(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [googleResults, setGoogleResults] = useState([]);
  const [placesUnavailable, setPlacesUnavailable] = useState(false);

  const localResults = useMemo(() => {
    const query = normalize(value);
    if (query.length < 2) return [];
    return properties.filter(property => normalize([
      property.code,
      property.title,
      property.address,
      property.neighborhood,
      property.city,
    ].filter(Boolean).join(' ')).includes(query)).slice(0, 5);
  }, [properties, value]);

  useEffect(() => {
    const close = event => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  useEffect(() => {
    const query = value.trim();
    const requestId = ++requestRef.current;
    if (!isOpen || query.length < 3) {
      setGoogleResults([]);
      setIsSearching(false);
      return undefined;
    }

    setIsSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        await loadGoogleMaps();
        const { AutocompleteSuggestion } = await window.google.maps.importLibrary('places');
        const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          includedRegionCodes: ['br'],
          language: 'pt-BR',
          region: 'br',
          origin: { lat: -22.8219, lng: -47.2668 },
        });
        if (requestRef.current !== requestId) return;
        setPlacesUnavailable(false);
        setGoogleResults((response.suggestions || []).map(suggestion => suggestion.placePrediction).filter(Boolean).slice(0, 6));
      } catch {
        if (requestRef.current !== requestId) return;
        setGoogleResults([]);
        setPlacesUnavailable(true);
      } finally {
        if (requestRef.current === requestId) setIsSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [isOpen, value]);

  const showDropdown = isOpen && value.trim().length >= 2;

  return (
    <div ref={rootRef} className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={event => { onChange(event.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-10 text-sm font-medium text-gray-800 shadow-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
      />
      {isSearching && <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />}

      {showDropdown && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[80] max-h-[360px] overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-2xl">
          {localResults.length > 0 && <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Imóveis cadastrados</p>}
          {localResults.map(property => (
            <button key={property.id} type="button" onClick={() => { setIsOpen(false); onSelectProperty?.(property); }} className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-primary/5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-4 w-4" /></span>
              <span className="min-w-0"><span className="block truncate text-sm font-bold text-gray-800">{property.code ? `${property.code} · ` : ''}{property.title}</span><span className="mt-0.5 block truncate text-xs text-gray-400">{property.address}{property.neighborhood ? ` · ${property.neighborhood}` : ''}</span></span>
            </button>
          ))}

          {googleResults.length > 0 && <p className="mt-1 border-t border-gray-100 px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Endereços encontrados</p>}
          {googleResults.map(prediction => (
            <button key={prediction.placeId} type="button" onClick={() => { setIsOpen(false); onSelectAddress?.({ placeId: prediction.placeId, description: predictionText(prediction.text) }); }} className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-gray-50">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500"><MapPin className="h-4 w-4" /></span>
              <span className="min-w-0"><span className="block text-sm font-semibold text-gray-700">{predictionText(prediction.mainText) || predictionText(prediction.text)}</span>{prediction.secondaryText && <span className="mt-0.5 block truncate text-xs text-gray-400">{predictionText(prediction.secondaryText)}</span>}</span>
            </button>
          ))}

          {!isSearching && !localResults.length && !googleResults.length && !placesUnavailable && <p className="px-4 py-5 text-center text-xs text-gray-500">Nenhum imóvel ou endereço encontrado.</p>}
          {placesUnavailable && <p className="mx-1 mt-1 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-700">A busca de endereços aguarda a ativação da Places API (New). Os imóveis cadastrados continuam disponíveis.</p>}
        </div>
      )}
    </div>
  );
}
