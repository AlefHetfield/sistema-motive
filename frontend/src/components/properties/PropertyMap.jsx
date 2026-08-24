import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Copy, MapPin, MapPinned, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { googleMapsIsConfigured, loadGoogleMaps } from '../../lib/googleMaps';
import { propertyCityColor } from './propertyConstants';

const markerIcons = new Map();
const priceFormatter = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const MY_MAPS_ICON_ROOT = '/map-icons/mymaps';

const normalizePropertyType = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase('pt-BR');

const propertyTypeFamily = propertyType => {
  const type = normalizePropertyType(propertyType);
  if (type === 'apartamento' || type === 'comercial') return 'building';
  if (type === 'lote' || type === 'terreno') return 'land';
  return 'house';
};

const MY_MAPS_CITY_ICONS = {
  sumare: { building: 5, house: 6, land: 7 },
  'nova odessa': { building: 14, house: 8, land: 13 },
  hortolandia: { building: 9, house: 11, land: 10 },
  americana: { building: 15, house: 15, land: 15 },
  paulinia: { building: 18, house: 17, land: 16 },
  campinas: { building: 12, house: 12, land: 12 },
  'monte mor': { building: 19, house: 19, land: 19 },
};

const MY_MAPS_FALLBACK_ICONS = { building: 18, house: 17, land: 16 };

const myMapsMarkerAsset = property => {
  const city = String(property.city || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');
  const family = propertyTypeFamily(property.propertyType);
  const iconNumber = (MY_MAPS_CITY_ICONS[city] || MY_MAPS_FALLBACK_ICONS)[family];
  return `${MY_MAPS_ICON_ROOT}/icon-${iconNumber}.png`;
};

const markerGlyph = (propertyType, foreground = '#ffffff', detail = '#64748b') => {
  const type = normalizePropertyType(propertyType);
  if (type === 'apartamento') {
    return `<rect x="14" y="10" width="20" height="27" rx="2" fill="${foreground}"/><path fill="${detail}" d="M18 15h4v4h-4zm8 0h4v4h-4zm-8 7h4v4h-4zm8 0h4v4h-4zm-8 7h4v4h-4zm8 0h4v8h-4z"/>`;
  }
  if (type === 'lote' || type === 'terreno') {
    return `<path d="m12 30 8-17 17 5-8 17Z" fill="none" stroke="${foreground}" stroke-width="3" stroke-linejoin="round"/><path d="m20 13 9 22M16 22l17 5" fill="none" stroke="${foreground}" stroke-width="2" opacity=".8"/>`;
  }
  if (type === 'comercial') {
    return `<path fill="${foreground}" d="M12 18h24l-3-7H15Zm2 3h20v16H14Z"/><path fill="${detail}" d="M19 27h10v10H19Z"/><path d="M12 18c0 3 2 5 5 5 2 0 4-1 5-3 1 2 3 3 5 3 3 0 5-2 5-5" fill="none" stroke="${detail}" stroke-width="2"/>`;
  }
  if (type === 'chacara') {
    return `<path fill="${foreground}" d="M22 29h4v9h-4zM24 9c-6 0-10 5-8 10-4 2-3 9 2 10h12c5-1 6-8 2-10 2-5-2-10-8-10Z"/>`;
  }
  if (type === 'localizacao') {
    return `<circle cx="24" cy="22" r="9" fill="none" stroke="${foreground}" stroke-width="3"/><circle cx="24" cy="22" r="3.5" fill="${foreground}"/>`;
  }
  return `<path fill="${foreground}" d="m14 21 10-8 10 8v11H27v-7h-6v7h-7Z"/>`;
};

const markerIcon = (property, selected) => {
  const asset = myMapsMarkerAsset(property);
  const cacheKey = `mymaps:${asset}:${selected ? 'selected' : 'default'}`;
  if (markerIcons.has(cacheKey)) return markerIcons.get(cacheKey);
  const size = selected ? 48 : 40;
  const icon = {
    url: asset,
    scaledSize: new window.google.maps.Size(size, size),
    anchor: new window.google.maps.Point(size / 2, size),
  };
  markerIcons.set(cacheKey, icon);
  return icon;
};

const locationMarkerIcon = () => {
  const cacheKey = 'located-address';
  if (markerIcons.has(cacheKey)) return markerIcons.get(cacheKey);
  const size = 46;
  const color = '#7c3aed';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48"><path fill="${color}" stroke="white" stroke-width="3" d="M24 2C13.5 2 5 10.2 5 20.3 5 34 24 46 24 46s19-12 19-25.7C43 10.2 34.5 2 24 2Z"/>${markerGlyph('Localização', '#ffffff', color)}</svg>`;
  const icon = {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(size, size),
    anchor: new window.google.maps.Point(size / 2, size),
  };
  markerIcons.set(cacheKey, icon);
  return icon;
};

const priceMarkerIcon = (property, selected, hovered) => {
  const color = propertyCityColor(property.city);
  const price = Number(property.price);
  if (!Number.isFinite(price) || price <= 0) return markerIcon(property, selected || hovered);
  const label = `R$ ${priceFormatter.format(price)}`;
  const favoriteSpace = property.isFavorite ? 18 : 0;
  const width = Math.max(94, Math.min(148, Math.ceil(label.length * 7.2 + 44 + favoriteSpace)));
  const height = selected || hovered ? 44 : 40;
  const normalizedType = normalizePropertyType(property.propertyType) || 'imovel';
  const cacheKey = `price:${color}:${normalizedType}:${label}:${property.isFavorite ? 'favorite' : 'default'}:${selected ? 'selected' : hovered ? 'hovered' : 'default'}`;
  if (markerIcons.has(cacheKey)) return markerIcons.get(cacheKey);
  const active = selected || hovered;
  const background = selected ? color : '#ffffff';
  const foreground = selected && color !== '#ffea00' ? '#ffffff' : '#1f2937';
  const strokeWidth = active ? 3 : 2;
  const favorite = property.isFavorite
    ? `<circle cx="${width - 14}" cy="14" r="8" fill="#f59e0b"/><path fill="white" d="M${width - 14} 9.5l1.35 2.75 3.05.44-2.2 2.15.52 3.03-2.72-1.43-2.72 1.43.52-3.03-2.2-2.15 3.05-.44Z"/>`
    : '';
  const textX = property.isFavorite ? (width + 10) / 2 : (width + 20) / 2;
  const typeIcon = `<circle cx="15" cy="15" r="10" fill="${selected ? 'rgba(255,255,255,.2)' : color}"/><g transform="translate(5 5) scale(.42)">${markerGlyph(property.propertyType, '#ffffff', selected ? color : '#ffffff')}</g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path fill="${background}" stroke="${color}" stroke-width="${strokeWidth}" d="M9 2h${width - 18}a7 7 0 0 1 7 7v15a7 7 0 0 1-7 7H${width / 2 + 7}L${width / 2} ${height - 2}l-7-9H9a7 7 0 0 1-7-7V9a7 7 0 0 1 7-7Z"/>${typeIcon}<text x="${textX}" y="20" fill="${foreground}" font-family="Arial, sans-serif" font-size="12" font-weight="700" text-anchor="middle">${label}</text>${favorite}</svg>`;
  const icon = {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(width, height),
    anchor: new window.google.maps.Point(width / 2, height),
  };
  markerIcons.set(cacheKey, icon);
  return icon;
};

export default function PropertyMap({ properties, selectedPropertyId, hoveredPropertyId, locatedAddress, onSelect, onHover, onCreateAtLocation }) {
  const wrapperRef = useRef(null);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const locatedMarkerRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);
  const onCreateAtLocationRef = useRef(onCreateAtLocation);
  const selectedPropertyIdRef = useRef(selectedPropertyId);
  const [mapError, setMapError] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { onHoverRef.current = onHover; }, [onHover]);
  useEffect(() => { onCreateAtLocationRef.current = onCreateAtLocation; }, [onCreateAtLocation]);
  useEffect(() => { selectedPropertyIdRef.current = selectedPropertyId; }, [selectedPropertyId]);

  useEffect(() => {
    if (!googleMapsIsConfigured || !containerRef.current || mapRef.current) return undefined;
    let active = true;
    loadGoogleMaps()
      .then(maps => {
        if (!active || !containerRef.current) return;
        mapRef.current = new maps.Map(containerRef.current, {
          center: { lat: -22.8219, lng: -47.2668 },
          zoom: 12,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
          gestureHandling: 'greedy',
          clickableIcons: false,
          mapTypeControlOptions: { position: maps.ControlPosition.TOP_RIGHT },
        });
        mapRef.current.addListener('click', () => {
          setContextMenu(null);
          onSelectRef.current(null);
        });
        mapRef.current.addListener('dragstart', () => setContextMenu(null));
        mapRef.current.addListener('zoom_changed', () => setContextMenu(null));
        mapRef.current.addListener('contextmenu', event => {
          if (!event.latLng || !wrapperRef.current) return;
          const bounds = wrapperRef.current.getBoundingClientRect();
          const clientX = Number(event.domEvent?.clientX);
          const clientY = Number(event.domEvent?.clientY);
          const menuWidth = 230;
          const menuHeight = 112;
          const x = Number.isFinite(clientX) ? clientX - bounds.left : bounds.width / 2;
          const y = Number.isFinite(clientY) ? clientY - bounds.top : bounds.height / 2;
          setContextMenu({
            x: Math.max(8, Math.min(x, bounds.width - menuWidth - 8)),
            y: Math.max(8, Math.min(y, bounds.height - menuHeight - 8)),
            latitude: event.latLng.lat(),
            longitude: event.latLng.lng(),
          });
        });
        setMapReady(true);
      })
      .catch(error => active && setMapError(error.message));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;
    markersRef.current.forEach(({ marker }) => marker.setMap(null));

    const mapped = properties.filter(property => Number.isFinite(Number(property.latitude)) && Number.isFinite(Number(property.longitude)));
    const bounds = new window.google.maps.LatLngBounds();
    const markers = mapped.map(property => {
      const position = { lat: Number(property.latitude), lng: Number(property.longitude) };
      const marker = new window.google.maps.Marker({
        map,
        position,
        title: property.title,
        icon: markerIcon(property, property.id === selectedPropertyIdRef.current),
        zIndex: property.id === selectedPropertyIdRef.current ? 1000 : undefined,
        optimized: true,
      });
      marker.addListener('click', () => onSelectRef.current(property));
      marker.addListener('mouseover', () => onHoverRef.current?.(property.id));
      marker.addListener('mouseout', () => onHoverRef.current?.(null));
      bounds.extend(position);
      return { marker, property };
    });
    markersRef.current = markers;

    const selected = mapped.find(property => property.id === selectedPropertyIdRef.current);
    if (selected) {
      map.panTo({ lat: Number(selected.latitude), lng: Number(selected.longitude) });
      if ((map.getZoom() || 0) < 17) map.setZoom(17);
    } else if (mapped.length === 1) {
      map.setCenter({ lat: Number(mapped[0].latitude), lng: Number(mapped[0].longitude) });
      map.setZoom(16);
    } else if (mapped.length > 1) {
      map.fitBounds(bounds, 60);
    }
  }, [mapReady, properties]);

  useEffect(() => {
    if (!mapReady) return;
    markersRef.current.forEach(({ marker, property }) => {
      const selected = property.id === selectedPropertyId;
      const hovered = property.id === hoveredPropertyId;
      marker.setIcon(selected || hovered ? priceMarkerIcon(property, selected, hovered) : markerIcon(property, false));
      marker.setZIndex(selected ? 2000 : hovered ? 1500 : undefined);
    });

    if (!selectedPropertyId) return;
    const selected = markersRef.current.find(item => item.property.id === selectedPropertyId)?.property;
    if (!selected) return;
    const map = mapRef.current;
    map.panTo({ lat: Number(selected.latitude), lng: Number(selected.longitude) });
    if ((map.getZoom() || 0) < 17) map.setZoom(17);
  }, [hoveredPropertyId, mapReady, selectedPropertyId]);

  useEffect(() => {
    locatedMarkerRef.current?.setMap(null);
    locatedMarkerRef.current = null;
    if (!mapReady || !locatedAddress || !mapRef.current) return;
    const position = { lat: Number(locatedAddress.latitude), lng: Number(locatedAddress.longitude) };
    if (!Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return;
    locatedMarkerRef.current = new window.google.maps.Marker({
      map: mapRef.current,
      position,
      title: locatedAddress.formattedAddress || locatedAddress.address || 'Endereço localizado',
      icon: locationMarkerIcon(),
      zIndex: 2000,
      optimized: true,
    });
    mapRef.current.panTo(position);
    if ((mapRef.current.getZoom() || 0) < 17) mapRef.current.setZoom(17);
  }, [locatedAddress, mapReady]);

  const createAtLocation = () => {
    if (!contextMenu) return;
    const location = { latitude: contextMenu.latitude, longitude: contextMenu.longitude };
    setContextMenu(null);
    onCreateAtLocationRef.current?.(location);
  };

  const copyCoordinates = async () => {
    if (!contextMenu) return;
    const coordinates = `${contextMenu.latitude.toFixed(6)}, ${contextMenu.longitude.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(coordinates);
      toast.success('Coordenadas copiadas.');
      setContextMenu(null);
    } catch {
      toast.error('Não foi possível copiar as coordenadas.');
    }
  };

  if (!googleMapsIsConfigured || mapError) {
    return (
      <div className="flex h-full min-h-[520px] items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 p-6">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><MapPinned className="h-7 w-7" /></span>
          <h2 className="mt-4 text-lg font-bold text-gray-900">Mapa aguardando configuração</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">Cadastros, filtros e importações já funcionam. Para visualizar os pins, configure <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">VITE_GOOGLE_MAPS_API_KEY</code> no frontend.</p>
          {mapError && <p className="mt-3 flex items-center justify-center gap-2 text-xs text-red-600"><AlertTriangle className="h-4 w-4" />{mapError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative h-full min-h-[520px] w-full" onContextMenu={event => event.preventDefault()}>
      <div ref={containerRef} className="absolute inset-0" aria-label="Mapa dos imóveis" />
      {contextMenu && (
        <div className="absolute z-30 w-[230px] overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-2xl" style={{ left: contextMenu.x, top: contextMenu.y }} role="menu">
          <button type="button" onClick={createAtLocation} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold text-gray-800 hover:bg-primary/10 hover:text-primary" role="menuitem">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Plus className="h-4 w-4" /></span>
            Cadastrar imóvel aqui
          </button>
          <button type="button" onClick={copyCoordinates} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-gray-600 hover:bg-gray-50" role="menuitem">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500"><Copy className="h-4 w-4" /></span>
            <span><span className="block">Copiar coordenadas</span><span className="mt-0.5 block text-[10px] font-normal text-gray-400"><MapPin className="mr-1 inline h-3 w-3" />{contextMenu.latitude.toFixed(5)}, {contextMenu.longitude.toFixed(5)}</span></span>
          </button>
        </div>
      )}
    </div>
  );
}
