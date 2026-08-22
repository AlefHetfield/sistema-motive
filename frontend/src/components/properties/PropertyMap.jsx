import { useEffect, useRef, useState } from 'react';
import { MarkerClusterer, SuperClusterAlgorithm } from '@googlemaps/markerclusterer';
import { AlertTriangle, Copy, MapPin, MapPinned, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { googleMapsIsConfigured, loadGoogleMaps } from '../../lib/googleMaps';
import { propertyCityColor } from './propertyConstants';

const markerIcons = new Map();

const markerIcon = (color, selected) => {
  const cacheKey = `${color}:${selected ? 'selected' : 'default'}`;
  if (markerIcons.has(cacheKey)) return markerIcons.get(cacheKey);
  const size = selected ? 46 : 40;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48"><path fill="${color}" stroke="white" stroke-width="3" d="M24 2C13.5 2 5 10.2 5 20.3 5 34 24 46 24 46s19-12 19-25.7C43 10.2 34.5 2 24 2Z"/><path fill="white" d="m14 21 10-8 10 8v11H27v-7h-6v7h-7Z"/></svg>`;
  const icon = {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(size, size),
    anchor: new window.google.maps.Point(size / 2, size),
  };
  markerIcons.set(cacheKey, icon);
  return icon;
};

export default function PropertyMap({ properties, selectedPropertyId, locatedAddress, onSelect, onCreateAtLocation }) {
  const wrapperRef = useRef(null);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const locatedMarkerRef = useRef(null);
  const clustererRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  const onCreateAtLocationRef = useRef(onCreateAtLocation);
  const selectedPropertyIdRef = useRef(selectedPropertyId);
  const [mapError, setMapError] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
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
    clustererRef.current?.clearMarkers();
    markersRef.current.forEach(({ marker }) => marker.setMap(null));

    const mapped = properties.filter(property => Number.isFinite(Number(property.latitude)) && Number.isFinite(Number(property.longitude)));
    const bounds = new window.google.maps.LatLngBounds();
    const markers = mapped.map(property => {
      const position = { lat: Number(property.latitude), lng: Number(property.longitude) };
      const marker = new window.google.maps.Marker({
        position,
        title: property.title,
        icon: markerIcon(propertyCityColor(property.city), property.id === selectedPropertyIdRef.current),
        zIndex: property.id === selectedPropertyIdRef.current ? 1000 : undefined,
        optimized: true,
      });
      marker.addListener('click', () => onSelectRef.current(property));
      bounds.extend(position);
      return { marker, property };
    });
    markersRef.current = markers;
    clustererRef.current = new MarkerClusterer({
      map,
      markers: markers.map(item => item.marker),
      algorithm: new SuperClusterAlgorithm({ radius: 80, maxZoom: 15 }),
    });

    const selected = mapped.find(property => property.id === selectedPropertyIdRef.current);
    if (selected) {
      map.panTo({ lat: Number(selected.latitude), lng: Number(selected.longitude) });
      if ((map.getZoom() || 0) < 15) map.setZoom(15);
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
      marker.setIcon(markerIcon(propertyCityColor(property.city), selected));
      marker.setZIndex(selected ? 1000 : undefined);
    });

    if (!selectedPropertyId) return;
    const selected = markersRef.current.find(item => item.property.id === selectedPropertyId)?.property;
    if (!selected) return;
    const map = mapRef.current;
    map.panTo({ lat: Number(selected.latitude), lng: Number(selected.longitude) });
    if ((map.getZoom() || 0) < 15) map.setZoom(15);
  }, [mapReady, selectedPropertyId]);

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
      icon: markerIcon('#7c3aed', true),
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
