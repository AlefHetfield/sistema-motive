import useMobileLayout from '../hooks/useMobileLayout';
import FancySelect from '../components/FancySelect';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Bath,
  BedDouble,
  Building2,
  CalendarCheck,
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  FilterX,
  Home,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Maximize2,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Route,
  Search,
  SlidersHorizontal,
  Star,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import Button from '../components/ui/Button';
import { compactControlClass } from '../components/ui/styles';
import { EmptyState, LoadingState } from '../components/ui/FeedbackState';
import StatusBadge from '../components/ui/StatusBadge';
import { toast } from 'sonner';
import PropertyMap from '../components/properties/PropertyMap';
import PropertyFormModal from '../components/properties/PropertyFormModal';
import PropertyAddressSearch from '../components/properties/PropertyAddressSearch';
import { PROPERTY_CITY_PRIORITY, PROPERTY_STATUSES, propertyCityColor } from '../components/properties/propertyConstants';
import { createProperty, deleteProperty, fetchProperties, fetchPropertyDrivePhotos, geocodePropertyPlace, propertyDriveImageUrl, setPropertyFavorite, updateProperty } from '../services/api';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const initialFilters = { search: '', status: '', city: '', propertyType: '', bedrooms: '', floorGroup: '', suite: '', landConfiguration: '' };
const LAND_CONFIGURATIONS = ['Meio', 'Intermediário', 'Inteiro'];

const formatDate = value => value ? new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Não confirmada';
const whatsappDigits = value => String(value || '').replace(/\D/g, '');
const formatWhatsapp = value => {
  const digits = whatsappDigits(value);
  const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return value || '';
};
const propertyCoverUrl = property => property?.photoUrl || (property?.driveCoverFileId ? propertyDriveImageUrl(property.driveCoverFileId) : '');

const cleanPropertyTitle = value => String(value || '')
  .replace(/^\s*\d+(?:[.,]\d+)?\s*[-–]\s*/i, '')
  .replace(/\s*[-–]\s*\d+\s*(?:dorm(?:it[oó]rios?)?|quartos?).*$/i, '')
  .replace(/\s*,?\s*R\$\s*[\d.\s]+(?:,\d{2})?\s*$/i, '')
  .replace(/\s+/g, ' ')
  .trim();

const cleanCondominiumName = value => {
  const candidate = String(value || '')
    .split(/\s+\*\s+|\s+\|\s+|[.;]/)[0]
    .replace(/\s+[-–—]\s+.*$/, '')
    .replace(/\s+\d+\s*(?:dorm(?:it[oó]rios?)?|quartos?|metros?|m²).*$/i, '')
    .replace(/\s+\d+[º°]\s*(?:andar)?.*$/i, '')
    .replace(/\s+(?:em|no|na)\s+(?:sumar[eé]|hortol[aâ]ndia|nova odessa|americana|paul[ií]nia|campinas|monte mor).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!candidate || candidate.length < 3 || candidate.length > 70) return '';
  if (/^(?:fechado|com|possui|valor|mensal|r\$|de|e)\b/i.test(candidate)) return '';
  return candidate;
};

const condominiumFromProperty = property => {
  const addressAndDescription = [property.address, property.description].filter(Boolean).join(' | ');
  const condominium = addressAndDescription.match(/\bcondom[ií]nio\s+(.{3,120})/i);
  const condominiumName = cleanCondominiumName(condominium?.[1]);
  if (condominiumName) return condominiumName;
  const residential = String(property.description || '').match(/\bresidencial\s+(.{3,120})/i);
  return cleanCondominiumName(residential?.[1]);
};

const propertyCardTitle = property => {
  const type = String(property.propertyType || '').toLocaleLowerCase('pt-BR');
  const condominium = condominiumFromProperty(property);
  const storedTitle = cleanPropertyTitle(property.title);
  const titleWasAutomaticallyGenerated = storedTitle.localeCompare(String(property.neighborhood || ''), 'pt-BR', { sensitivity: 'base' }) === 0;
  if (storedTitle && !titleWasAutomaticallyGenerated) return storedTitle;
  if (type.includes('apartamento')) return condominium || property.neighborhood || storedTitle || 'Apartamento';
  if ((type.includes('casa') || type.includes('sobrado')) && condominium) return condominium;
  return property.neighborhood || storedTitle || property.propertyType || 'Imóvel';
};

const distanceInMeters = (first, second) => {
  const toRadians = value => value * Math.PI / 180;
  const earthRadius = 6371000;
  const latitudeDelta = toRadians(Number(second.latitude) - Number(first.latitude));
  const longitudeDelta = toRadians(Number(second.longitude) - Number(first.longitude));
  const latitude1 = toRadians(Number(first.latitude));
  const latitude2 = toRadians(Number(second.latitude));
  const value = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

function PropertyListCard({ property, selected, highlighted, onClick, onHover, onToggleFavorite, isFavoriteUpdating }) {
  const displayTitle = propertyCardTitle(property);
  const coverUrl = propertyCoverUrl(property);
  const driveCoverUrl = property.driveCoverFileId ? propertyDriveImageUrl(property.driveCoverFileId) : '';
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <div data-property-id={property.id} onMouseEnter={() => onHover(property.id)} onMouseLeave={() => onHover(null)} className={`relative w-full overflow-hidden rounded-xl border bg-white text-left transition [content-visibility:auto] [contain-intrinsic-size:76px] ${selected ? 'border-primary shadow-[0_6px_18px_rgba(49,91,120,0.14)] ring-2 ring-primary/10' : highlighted ? 'border-primary/50 shadow-sm ring-2 ring-primary/5' : 'border-slate-200/80 hover:border-primary/25 hover:shadow-sm'}`}>
      <button type="button" onClick={onClick} className="block w-full text-left">
        <div className="flex gap-2.5 p-2.5">
        <div className="flex h-[52px] w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
          {coverUrl && !imageFailed ? <img src={coverUrl} alt="" loading="lazy" decoding="async" onError={event => { if (driveCoverUrl && !event.currentTarget.dataset.driveFallback && event.currentTarget.src !== driveCoverUrl) { event.currentTarget.dataset.driveFallback = 'true'; event.currentTarget.src = driveCoverUrl; return; } setImageFailed(true); }} className="h-full w-full object-cover" /> : <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-gray-300"><ImageIcon className="h-5 w-5" /><span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wide">Sem foto</span></div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1.5"><p className="line-clamp-2 pr-7 text-sm font-bold leading-4 text-gray-900" title={displayTitle}>{displayTitle}</p><ChevronRight className="h-4 w-4 shrink-0 text-gray-300" /></div>
          <p className="mt-0.5 text-sm font-bold leading-5 text-primary">{property.price ? currency.format(property.price) : 'Valor não informado'}</p>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] leading-4 text-gray-500">{property.code && <span className="shrink-0 font-bold text-gray-400">{property.code}</span>}{property.code && <span className="text-gray-300">·</span>}<StatusBadge status={property.status} size="xs" />{property.bedrooms !== null && property.bedrooms !== undefined && <span className="shrink-0">· {property.bedrooms} dorm.</span>}</div>
        </div>
        </div>
      </button>
      <button type="button" onClick={() => onToggleFavorite(property)} disabled={isFavoriteUpdating} aria-label={property.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} title={property.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} className={`absolute right-8 top-2 z-10 rounded-lg p-1.5 transition disabled:opacity-50 ${property.isFavorite ? 'bg-amber-50 text-amber-500 hover:bg-amber-100' : 'text-gray-300 hover:bg-amber-50 hover:text-amber-500'}`}>
        <Star className="h-4 w-4" fill={property.isFavorite ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}

function DetailMetric({ icon, label, value }) {
  return <div className="min-w-0 bg-white p-3">{icon}<p className="mt-2 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p><p className="mt-0.5 truncate text-sm font-bold text-slate-800">{value ?? '—'}</p></div>;
}

function PropertyDetail({ property, onClose, onEdit, onDelete, onToggleFavorite, isFavoriteUpdating }) {
  const mobile = useMobileLayout();
  const [drivePhotos, setDrivePhotos] = useState([]);
  const [activePhoto, setActivePhoto] = useState(0);
  const [failedPhotoIds, setFailedPhotoIds] = useState(() => new Set());
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(Boolean(property.driveFolderUrl));
  const [sheetLevel, setSheetLevel] = useState(0);
  const sheetDragStart = useRef(null);
  useEffect(() => {
    let active = true;
    if (!property.driveFolderUrl) return undefined;
    fetchPropertyDrivePhotos(property.id)
      .then(result => active && setDrivePhotos(Array.isArray(result.files) ? result.files : []))
      .catch(() => active && setDrivePhotos([]))
      .finally(() => active && setIsLoadingPhotos(false));
    return () => { active = false; };
  }, [property.driveFolderUrl, property.id]);

  const siteCover = property.photoUrl ? [{ id: 'site-cover', name: property.title, url: property.photoUrl }] : [];
  const driveGallery = drivePhotos.map(file => ({ id: file.id, name: file.name, url: propertyDriveImageUrl(file.id) }));
  const gallery = [...siteCover, ...driveGallery].filter(photo => !failedPhotoIds.has(photo.id));
  if (!gallery.length && !siteCover.length && !isLoadingPhotos && propertyCoverUrl(property) && !failedPhotoIds.has('cover')) gallery.push({ id: 'cover', name: property.title, url: propertyCoverUrl(property) });
  const displayedPhotoIndex = Math.min(activePhoto, Math.max(0, gallery.length - 1));
  const displayedPhoto = gallery[displayedPhotoIndex];
  const hasCoordinates = Number.isFinite(Number(property.latitude)) && Number.isFinite(Number(property.longitude));
  const routeUrl = hasCoordinates ? `https://www.google.com/maps/dir/?api=1&destination=${property.latitude},${property.longitude}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`;
  const copyOwnerWhatsapp = async () => {
    try {
      await navigator.clipboard.writeText(formatWhatsapp(property.ownerWhatsapp));
      toast.success('Contato do proprietário copiado.');
    } catch {
      toast.error('Não foi possível copiar o contato.');
    }
  };
  const sheetHeights = ['42dvh', '65dvh', '88dvh'];
  const finishSheetDrag = (event) => {
    if (!mobile || sheetDragStart.current === null) return;
    const movement = event.clientY - sheetDragStart.current;
    sheetDragStart.current = null;
    if (movement < -36) setSheetLevel(current => Math.min(2, current + 1));
    if (movement > 36) {
      if (sheetLevel === 0) onClose();
      else setSheetLevel(current => Math.max(0, current - 1));
    }
  };
  return (
    <aside
      style={mobile ? { height: sheetHeights[sheetLevel] } : undefined}
      className="fixed inset-x-0 bottom-0 z-[60] flex w-full animate-in flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl slide-in-from-bottom-4 transition-[height] duration-300 lg:absolute lg:inset-y-4 lg:left-auto lg:right-4 lg:h-auto lg:max-h-none lg:w-[min(390px,calc(100%-32px))] lg:rounded-2xl lg:slide-in-from-right-4"
    >
      {mobile && <button type="button" aria-label={sheetLevel === 2 ? 'Recolher detalhes do imóvel' : 'Expandir detalhes do imóvel'} onClick={() => setSheetLevel(current => current === 2 ? 0 : current + 1)} onPointerDown={event => { sheetDragStart.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerUp={finishSheetDrag} onPointerCancel={() => { sheetDragStart.current = null; }} className="flex h-7 shrink-0 touch-none items-center justify-center bg-white"><span className="h-1.5 w-12 rounded-full bg-gray-300" /></button>}
      <div className="relative h-36 shrink-0 bg-gradient-to-br from-slate-200 to-slate-100 sm:h-48">
        {displayedPhoto ? <img src={displayedPhoto.url} alt={displayedPhoto.name || property.title} onError={() => setFailedPhotoIds(current => new Set(current).add(displayedPhoto.id))} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center">{isLoadingPhotos ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <Home className="h-14 w-14 text-gray-300" />}</div>}
        {gallery.length > 1 && <><button type="button" onClick={() => setActivePhoto((displayedPhotoIndex - 1 + gallery.length) % gallery.length)} aria-label="Foto anterior" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-gray-700 shadow hover:bg-white"><ChevronLeft className="h-4 w-4" /></button><button type="button" onClick={() => setActivePhoto((displayedPhotoIndex + 1) % gallery.length)} aria-label="Próxima foto" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-gray-700 shadow hover:bg-white"><ChevronRight className="h-4 w-4" /></button><span className="absolute bottom-3 right-3 rounded-full bg-gray-950/70 px-2.5 py-1 text-[11px] font-bold text-white">{displayedPhotoIndex + 1}/{gallery.length}</span></>}
        <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded-full bg-white/95 p-2 text-gray-600 shadow hover:text-gray-900"><X className="h-4 w-4" /></button>
        <StatusBadge status={property.status} solid className="absolute bottom-3 left-3 shadow" />
      </div>
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{property.code ? `Imóvel ${property.code}` : property.propertyType || 'Imóvel'}</p><h2 className="mt-1 text-xl font-bold leading-7 text-gray-900">{cleanPropertyTitle(property.title)}</h2></div>
          <button type="button" onClick={() => onToggleFavorite(property)} disabled={isFavoriteUpdating} aria-label={property.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} title={property.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition disabled:opacity-50 ${property.isFavorite ? 'border-amber-200 bg-amber-50 text-amber-500' : 'border-slate-200 bg-white text-slate-300 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-500'}`}><Star className="h-5 w-5" fill={property.isFavorite ? 'currentColor' : 'none'} /></button>
        </div>
        <p className="mt-2 flex gap-2 text-sm leading-5 text-gray-500"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{property.address}{property.neighborhood ? ` · ${property.neighborhood}` : ''}{property.city ? `, ${property.city}` : ''}</p>
        <p className="mt-4 text-2xl font-bold text-gray-900">{property.price ? currency.format(property.price) : 'Valor sob consulta'}</p>

        <div className={`${mobile && sheetLevel === 0 ? 'hidden' : 'grid'} mt-5 grid-cols-4 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200`}>
          <DetailMetric icon={<BedDouble className="h-4 w-4 text-primary" />} label="Dorm." value={property.bedrooms} />
          <DetailMetric icon={<Bath className="h-4 w-4 text-primary" />} label="Suítes" value={property.suites} />
          <DetailMetric icon={<Car className="h-4 w-4 text-primary" />} label="Vagas" value={property.parkingSpaces} />
          <DetailMetric icon={<Maximize2 className="h-4 w-4 text-primary" />} label="Área" value={property.area ? `${number.format(property.area)} m²` : null} />
        </div>

        <div className={`${mobile && sheetLevel < 2 ? 'hidden' : 'space-y-2.5'} mt-5 border-t border-slate-100 pt-4`}>
          <details open className="group overflow-hidden rounded-xl border border-slate-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 [&::-webkit-details-marker]:hidden"><span>Dados do imóvel</span><ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-90" /></summary>
            <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 px-3.5 py-3 text-sm">
              <div className="flex items-center justify-between gap-3"><span className="text-gray-500">Condição</span><strong className="text-gray-800">{property.condition || 'Não informada'}</strong></div>
              <div className="flex items-center justify-between gap-3"><span className="text-gray-500">Tipo</span><strong className="text-gray-800">{property.propertyType || 'Não informado'}</strong></div>
              {property.propertyType === 'Apartamento' && <div className="flex items-center justify-between gap-3"><span className="text-gray-500">Andar</span><strong className="text-gray-800">{property.floor === null || property.floor === undefined ? 'Não informado' : Number(property.floor) === 0 ? 'Térreo' : `${property.floor}º andar`}</strong></div>}
              {['Casa', 'Sobrado'].includes(property.propertyType) && <div className="flex items-center justify-between gap-3"><span className="text-gray-500">Configuração do terreno</span><strong className="text-gray-800">{property.landConfiguration || 'Não informada'}</strong></div>}
              <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-gray-500"><UserRound className="h-4 w-4" />Captador</span><strong className="text-gray-800">{property.captador || 'Não informado'}</strong></div>
              <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-gray-500"><CalendarCheck className="h-4 w-4" />Disponibilidade</span><strong className="text-gray-800">{formatDate(property.lastAvailabilityCheck)}</strong></div>
            </div>
          </details>
          {(property.ownerName || property.ownerWhatsapp) && <details className="group overflow-hidden rounded-xl border border-slate-200 bg-white"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 [&::-webkit-details-marker]:hidden"><span className="flex items-center gap-2"><UserRound className="h-4 w-4 text-primary" />Dados do proprietário</span><ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-90" /></summary><div className="space-y-3 border-t border-slate-100 bg-slate-50/60 px-3.5 py-3 text-sm">{property.ownerName && <div className="flex items-center justify-between gap-3"><span className="text-gray-500">Nome</span><strong className="text-right text-gray-800">{property.ownerName}</strong></div>}{property.ownerWhatsapp && <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-gray-500"><MessageCircle className="h-4 w-4" />WhatsApp</span><button type="button" onClick={copyOwnerWhatsapp} title="Copiar contato" className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 font-bold text-emerald-700 transition hover:bg-emerald-100"><span>{formatWhatsapp(property.ownerWhatsapp)}</span><Copy className="h-3.5 w-3.5" /></button></div>}</div></details>}
          <details className="group overflow-hidden rounded-xl border border-slate-200 bg-white"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 [&::-webkit-details-marker]:hidden"><span>Informações complementares</span><ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-90" /></summary><div className={`whitespace-pre-wrap break-words border-t border-slate-100 bg-slate-50/60 px-3.5 py-3 text-sm leading-6 ${property.additionalInformation ? 'text-gray-600' : 'italic text-gray-400'}`}>{property.additionalInformation || 'Nenhuma informação complementar cadastrada.'}</div></details>
        </div>
      </div>
      <footer className={`${mobile && sheetLevel === 0 ? 'hidden' : 'grid'} mobile-safe-bottom grid-cols-2 gap-2 border-t border-slate-200 bg-slate-50 p-3`}>
        <Link to={`/tasks?view=social&newProperty=${property.id}`} className="col-span-2 rounded-xl bg-secondary px-3 py-2.5 text-center text-sm font-bold text-white transition hover:bg-primary">Criar publicação</Link>
        <a href={routeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-primary ring-1 ring-gray-200 hover:bg-primary/5"><Route className="h-4 w-4" />Abrir rota</a>
        {property.sourceUrl && <a href={property.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-primary ring-1 ring-gray-200 hover:bg-primary/5"><ExternalLink className="h-4 w-4" />Abrir ficha</a>}
        <button type="button" onClick={onEdit} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-white hover:bg-[#274D68]"><Pencil className="h-4 w-4" />Editar</button>
        <button type="button" onClick={onDelete} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-100"><Trash2 className="h-4 w-4" />Excluir</button>
      </footer>
    </aside>
  );
}

function DeleteModal({ property, onClose, onConfirm, isDeleting }) {
  return <div className="fixed inset-0 z-[9700] flex items-center justify-center bg-gray-950/40 p-4 backdrop-blur-[2px]"><button type="button" className="absolute inset-0" onClick={onClose} aria-label="Cancelar exclusão" /><div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600"><Trash2 className="h-5 w-5" /></span><h2 className="mt-4 text-lg font-bold text-gray-900">Excluir imóvel?</h2><p className="mt-2 text-sm leading-6 text-gray-500">O imóvel <strong>{cleanPropertyTitle(property.title)}</strong> será removido do mapa e não poderá ser recuperado.</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100">Cancelar</button><button type="button" disabled={isDeleting} onClick={onConfirm} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">{isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}Excluir imóvel</button></div></div></div>;
}

export default function PropertiesMap() {
  const mobile = useMobileLayout();
  const [mobileView, setMobileView] = useState('map');
  const [mobileFilters, setMobileFilters] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const propertyListRef = useRef(null);
  const sidebarResizeRef = useRef(null);
  const [properties, setProperties] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [hoveredPropertyId, setHoveredPropertyId] = useState(null);
  const [editingProperty, setEditingProperty] = useState(undefined);
  const [creationLocation, setCreationLocation] = useState(null);
  const [addressQuery, setAddressQuery] = useState('');
  const [locatedAddress, setLocatedAddress] = useState(null);
  const [isLocatingAddress, setIsLocatingAddress] = useState(false);
  const [deletePending, setDeletePending] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [favoritePending, setFavoritePending] = useState(() => new Set());
  const [collapsedCities, setCollapsedCities] = useState(() => new Set());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(350);

  const loadProperties = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchProperties();
      setProperties(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadProperties(); }, [loadProperties]);

  useEffect(() => {
    if (isLoading) return;
    const requestedPropertyId = Number(searchParams.get('property'));
    if (!requestedPropertyId) return;
    const property = properties.find(item => item.id === requestedPropertyId);
    if (!property) return;
    setSelectedProperty(property);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('property');
    setSearchParams(nextParams, { replace: true });
  }, [isLoading, properties, searchParams, setSearchParams]);

  useEffect(() => {
    if (!selectedProperty?.id || !propertyListRef.current) return undefined;
    const city = String(selectedProperty.city || '').trim() || 'Cidade não informada';
    if (collapsedCities.has(city)) {
      setCollapsedCities(current => {
        const next = new Set(current);
        next.delete(city);
        return next;
      });
      return undefined;
    }
    const frame = requestAnimationFrame(() => {
      const card = propertyListRef.current?.querySelector(`[data-property-id="${selectedProperty.id}"]`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    return () => cancelAnimationFrame(frame);
  }, [collapsedCities, selectedProperty?.city, selectedProperty?.id]);

  const cities = useMemo(() => [...new Set(properties.map(item => item.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [properties]);
  const propertyTypes = useMemo(() => [...new Set(properties.map(item => item.propertyType).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [properties]);
  const filtered = useMemo(() => {
    const search = filters.search.trim().toLocaleLowerCase('pt-BR');
    const searchDigits = search.replace(/\D/g, '');
    return properties.filter(property => {
      const matchesText = [property.title, property.code, property.address, property.neighborhood, property.ownerName].some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(search));
      const matchesWhatsapp = searchDigits && whatsappDigits(property.ownerWhatsapp).includes(searchDigits);
      if (search && !matchesText && !matchesWhatsapp) return false;
      if (filters.status && property.status !== filters.status) return false;
      if (filters.city && property.city !== filters.city) return false;
      if (filters.propertyType && property.propertyType !== filters.propertyType) return false;
      if (filters.bedrooms && Number(property.bedrooms || 0) < Number(filters.bedrooms)) return false;
      if (filters.floorGroup === 'ground' && (property.floor === null || property.floor === undefined || Number(property.floor) !== 0)) return false;
      if (filters.floorGroup === 'upper' && (property.floor === null || property.floor === undefined || Number(property.floor) < 1)) return false;
      if (filters.floorGroup === 'unknown' && property.floor !== null && property.floor !== undefined) return false;
      if (filters.suite === 'yes' && (property.suites === null || property.suites === undefined || Number(property.suites) < 1)) return false;
      if (filters.suite === 'no' && Number(property.suites || 0) > 0) return false;
      if (filters.landConfiguration === 'unknown' && property.landConfiguration) return false;
      if (filters.landConfiguration && filters.landConfiguration !== 'unknown' && property.landConfiguration !== filters.landConfiguration) return false;
      return true;
    });
  }, [filters, properties]);
  const activeFilterChips = useMemo(() => [
    filters.search.trim() ? { field: 'search', label: `Busca: ${filters.search.trim()}` } : null,
    filters.status ? { field: 'status', label: filters.status } : null,
    filters.city ? { field: 'city', label: filters.city } : null,
    filters.propertyType ? { field: 'propertyType', label: filters.propertyType } : null,
    filters.bedrooms ? { field: 'bedrooms', label: `${filters.bedrooms}+ dormitórios` } : null,
    filters.floorGroup ? { field: 'floorGroup', label: filters.floorGroup === 'ground' ? 'Andar: térreo' : filters.floorGroup === 'upper' ? 'Andar: 1º ou superior' : 'Andar: não informado' } : null,
    filters.suite ? { field: 'suite', label: filters.suite === 'yes' ? 'Suíte: sim' : 'Suíte: não' } : null,
    filters.landConfiguration ? { field: 'landConfiguration', label: filters.landConfiguration === 'unknown' ? 'Terreno: não informado' : `Terreno: ${filters.landConfiguration}` } : null,
  ].filter(Boolean), [filters]);
  const mappedCount = filtered.filter(item => item.latitude !== null && item.longitude !== null).length;
  const cityGroups = useMemo(() => {
    const groups = new Map();
    for (const property of filtered) {
      const city = String(property.city || '').trim() || 'Cidade não informada';
      if (!groups.has(city)) groups.set(city, []);
      groups.get(city).push(property);
    }
    const priority = new Map(PROPERTY_CITY_PRIORITY.map((city, index) => [city, index]));
    return [...groups.entries()]
      .map(([city, items]) => ({
        city,
        color: propertyCityColor(city),
        items: [...items].sort((first, second) => {
          if (Boolean(first.isFavorite) !== Boolean(second.isFavorite)) return first.isFavorite ? -1 : 1;
          const firstPrice = Number(first.price) > 0 ? Number(first.price) : Number.POSITIVE_INFINITY;
          const secondPrice = Number(second.price) > 0 ? Number(second.price) : Number.POSITIVE_INFINITY;
          return firstPrice - secondPrice || String(first.title || '').localeCompare(String(second.title || ''), 'pt-BR');
        }),
      }))
      .sort((first, second) => {
        const firstPriority = priority.get(first.city) ?? PROPERTY_CITY_PRIORITY.length;
        const secondPriority = priority.get(second.city) ?? PROPERTY_CITY_PRIORITY.length;
        return firstPriority - secondPriority || first.city.localeCompare(second.city, 'pt-BR');
      });
  }, [filtered]);
  const nearbyProperties = useMemo(() => {
    if (!locatedAddress) return [];
    return properties.filter(property => Number.isFinite(Number(property.latitude)) && Number.isFinite(Number(property.longitude)) && distanceInMeters(locatedAddress, property) <= 80).slice(0, 5);
  }, [locatedAddress, properties]);

  const selectProperty = useCallback(property => setSelectedProperty(property), []);
  const createAtLocation = useCallback(location => {
    setSelectedProperty(null);
    setLocatedAddress(null);
    setCreationLocation(location);
    setEditingProperty(null);
  }, []);
  const selectAddressResult = async suggestion => {
    setAddressQuery(suggestion.description);
    setIsLocatingAddress(true);
    try {
      const result = await geocodePropertyPlace(suggestion.placeId);
      setSelectedProperty(null);
      setLocatedAddress(result);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLocatingAddress(false);
    }
  };
  const selectSearchProperty = property => {
    setAddressQuery(property.title);
    setLocatedAddress(null);
    setSelectedProperty(property);
  };
  const createLocatedProperty = () => {
    if (!locatedAddress) return;
    setCreationLocation(locatedAddress);
    setEditingProperty(null);
  };
  const updateFilter = (field, value) => setFilters(current => ({ ...current, [field]: value }));
  const updatePropertyTypeFilter = value => setFilters(current => ({
    ...current,
    propertyType: value,
    ...(!['Casa', 'Sobrado'].includes(value) ? { landConfiguration: '' } : {}),
    ...(value !== 'Apartamento' ? { floorGroup: '' } : {}),
  }));
  const toggleCity = city => setCollapsedCities(current => {
    const next = new Set(current);
    if (next.has(city)) next.delete(city);
    else next.add(city);
    return next;
  });

  const startSidebarResize = event => {
    if (isSidebarCollapsed) return;
    sidebarResizeRef.current = { startX: event.clientX, startWidth: sidebarWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const resizeSidebar = event => {
    if (!sidebarResizeRef.current) return;
    const nextWidth = sidebarResizeRef.current.startWidth + event.clientX - sidebarResizeRef.current.startX;
    setSidebarWidth(Math.min(480, Math.max(290, nextWidth)));
  };
  const finishSidebarResize = event => {
    sidebarResizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const closePropertyForm = () => {
    setEditingProperty(undefined);
    setCreationLocation(null);
  };

  const saveProperty = async form => {
    setIsSaving(true);
    try {
      const saved = editingProperty ? await updateProperty(editingProperty.id, form) : await createProperty(form);
      setProperties(current => editingProperty ? current.map(item => item.id === saved.id ? saved : item) : [saved, ...current]);
      setSelectedProperty(saved);
      setEditingProperty(undefined);
      setCreationLocation(null);
      setLocatedAddress(null);
      toast.success(editingProperty ? 'Imóvel atualizado no mapa.' : 'Imóvel cadastrado no mapa.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletePending) return;
    setIsDeleting(true);
    try {
      await deleteProperty(deletePending.id);
      setProperties(current => current.filter(item => item.id !== deletePending.id));
      if (selectedProperty?.id === deletePending.id) setSelectedProperty(null);
      setDeletePending(null);
      toast.success('Imóvel excluído do mapa.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleFavorite = async property => {
    if (favoritePending.has(property.id)) return;
    const isFavorite = !property.isFavorite;
    setFavoritePending(current => new Set(current).add(property.id));
    setProperties(current => current.map(item => item.id === property.id ? { ...item, isFavorite } : item));
    setSelectedProperty(current => current?.id === property.id ? { ...current, isFavorite } : current);
    try {
      const saved = await setPropertyFavorite(property.id, isFavorite);
      setProperties(current => current.map(item => item.id === saved.id ? saved : item));
      setSelectedProperty(current => current?.id === saved.id ? saved : current);
      toast.success(isFavorite ? 'Imóvel adicionado aos favoritos.' : 'Imóvel removido dos favoritos.');
    } catch (error) {
      setProperties(current => current.map(item => item.id === property.id ? { ...item, isFavorite: property.isFavorite } : item));
      setSelectedProperty(current => current?.id === property.id ? { ...current, isFavorite: property.isFavorite } : current);
      toast.error(error.message);
    } finally {
      setFavoritePending(current => {
        const next = new Set(current);
        next.delete(property.id);
        return next;
      });
    }
  };

  return (
    <div className="flex h-full min-h-[400px] flex-col overflow-hidden bg-[#E8EEF1]">
      <header className="max-h-[38dvh] shrink-0 overflow-y-auto border-b border-slate-200 bg-white px-3 py-2 lg:mx-3 lg:mt-3 lg:max-h-none lg:overflow-visible lg:rounded-t-2xl lg:border lg:px-5 lg:py-3">
        {mobile && <div className="mb-2 flex items-center gap-2"><div className="flex min-w-0 flex-1 rounded-xl bg-gray-100 p-1" aria-label="Visualização dos imóveis">{[['map', 'Mapa'], ['list', 'Lista']].map(([value, label]) => <button key={value} type="button" aria-pressed={mobileView === value} onClick={() => setMobileView(value)} className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold ${mobileView === value ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}>{label}</button>)}</div><button type="button" aria-expanded={mobileFilters} onClick={() => setMobileFilters(true)} className="relative min-h-11 rounded-xl border px-3 text-sm font-semibold text-gray-600"><SlidersHorizontal className="mr-1.5 inline h-4 w-4" />Filtros{activeFilterChips.length > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-white">{activeFilterChips.length}</span>}</button></div>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="hidden items-center gap-2 lg:flex"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><MapPin className="h-4 w-4" /></span><div><p className="text-sm font-bold text-slate-900">Portfólio imobiliário</p><p className="text-[11px] text-slate-500">Localize, filtre e atualize os imóveis em um único espaço.</p></div></div>
            <p className="text-xs font-semibold text-slate-500 lg:mt-2"><strong className="text-slate-800">{filtered.length}</strong> imóvel(is) · <strong className="text-slate-800">{mappedCount}</strong> visível(is) no mapa</p>
          </div>
          <div className="hidden flex-wrap items-center gap-2 lg:flex">
            <Button onClick={() => { setCreationLocation(null); setEditingProperty(null); }}><Plus className="h-4 w-4" />Cadastrar imóvel</Button>
          </div>
        </div>
        <div className="mt-3 hidden gap-2 border-t border-slate-100 pt-3 lg:grid xl:grid-cols-[minmax(260px,1fr)_180px_160px_160px_120px_150px]">
          <label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><input value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Buscar imóvel, código ou proprietário" className={`${compactControlClass} pl-9`} /></label>
          <FancySelect size="compact" ariaLabel="Filtrar por status" value={filters.status} onChange={value => updateFilter('status', value)} placeholder="Todos os status" options={[{ value: '', label: 'Todos os status' }, ...PROPERTY_STATUSES.map(item => ({ value: item, label: item }))]} />
          <FancySelect size="compact" ariaLabel="Filtrar por cidade" value={filters.city} onChange={value => updateFilter('city', value)} placeholder="Todas as cidades" options={[{ value: '', label: 'Todas as cidades' }, ...cities.map(item => ({ value: item, label: item }))]} />
          <FancySelect size="compact" ariaLabel="Filtrar por tipo" value={filters.propertyType} onChange={updatePropertyTypeFilter} placeholder="Todos os tipos" options={[{ value: '', label: 'Todos os tipos' }, ...propertyTypes.map(item => ({ value: item, label: item }))]} />
          <FancySelect size="compact" ariaLabel="Filtrar por dormitórios" value={filters.bedrooms} onChange={value => updateFilter('bedrooms', value)} placeholder="Dormitórios" options={[{ value: '', label: 'Dormitórios' }, ...[1, 2, 3, 4].map(item => ({ value: String(item), label: `${item}+` }))]} />
          <details className="group relative z-30">
            <summary className={`${compactControlClass} flex cursor-pointer list-none items-center justify-between gap-2 font-bold text-gray-600 [&::-webkit-details-marker]:hidden`}><span className="inline-flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" />Mais filtros</span><ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" /></summary>
            <div className="relative mt-2 w-full lg:absolute lg:right-0 lg:top-[calc(100%+6px)] lg:mt-0 lg:w-72 space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
              <label className="block"><span className="mb-1.5 block text-xs font-bold text-gray-600">Suíte</span><FancySelect size="compact" ariaLabel="Filtrar por suíte" value={filters.suite} onChange={value => updateFilter('suite', value)} placeholder="Todas" options={[{ value: '', label: 'Todas' }, { value: 'yes', label: 'Sim' }, { value: 'no', label: 'Não' }]} /></label>
              {(!filters.propertyType || filters.propertyType === 'Apartamento') && <label className="block"><span className="mb-1.5 block text-xs font-bold text-gray-600">Andar</span><FancySelect size="compact" ariaLabel="Filtrar por andar" value={filters.floorGroup} onChange={value => updateFilter('floorGroup', value)} placeholder="Todos" options={[{ value: '', label: 'Todos' }, { value: 'ground', label: 'Térreo' }, { value: 'upper', label: '1º andar ou superior' }, { value: 'unknown', label: 'Não informado' }]} /></label>}
              {(!filters.propertyType || ['Casa', 'Sobrado'].includes(filters.propertyType)) && <label className="block"><span className="mb-1.5 block text-xs font-bold text-gray-600">Configuração do terreno</span><FancySelect size="compact" ariaLabel="Filtrar por configuração do terreno" value={filters.landConfiguration} onChange={value => updateFilter('landConfiguration', value)} placeholder="Todas" options={[{ value: '', label: 'Todas' }, ...LAND_CONFIGURATIONS.map(item => ({ value: item, label: item })), { value: 'unknown', label: 'Não informado' }]} /></label>}
            </div>
          </details>
        </div>
        {activeFilterChips.length > 0 && <div className="mt-2 hidden flex-wrap items-center gap-1.5 rounded-xl border border-primary/10 bg-primary/[0.04] px-2.5 py-2 lg:flex"><span className="mr-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-primary">Filtros ativos</span>{activeFilterChips.map(chip => <button key={chip.field} type="button" onClick={() => updateFilter(chip.field, '')} aria-label={`Remover filtro ${chip.label}`} className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-white px-2.5 py-1 text-xs font-bold text-primary shadow-sm hover:bg-primary/5">{chip.label}<X className="h-3 w-3" /></button>)}<span className="ml-auto text-xs font-semibold text-gray-500">{filtered.length} resultado(s)</span><button type="button" onClick={() => setFilters(initialFilters)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold text-gray-500 hover:bg-white hover:text-gray-700"><FilterX className="h-3.5 w-3.5" />Limpar todos</button></div>}
      </header>

      {mobile && mobileFilters && <div className="fixed inset-0 z-[80] bg-gray-950/35 backdrop-blur-[1px]" role="presentation" onClick={() => setMobileFilters(false)}>
        <section role="dialog" aria-modal="true" aria-label="Filtros e ações do mapa" onClick={event => event.stopPropagation()} className="mobile-safe-bottom absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3"><div><h2 className="font-bold text-gray-900">Filtros e ações</h2><p className="text-xs text-gray-500">{filtered.length} imóvel(is) encontrado(s)</p></div><button type="button" onClick={() => setMobileFilters(false)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-gray-600" aria-label="Fechar filtros"><X className="h-5 w-5" /></button></div>
          <div className="space-y-4 p-4">
            <label className="relative block"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><input value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Buscar imóvel, código ou proprietário" className={`${compactControlClass} pl-9`} /></label>
            <div className="grid grid-cols-2 gap-3">
              <FancySelect size="compact" ariaLabel="Filtrar por status" value={filters.status} onChange={value => updateFilter('status', value)} placeholder="Todos os status" options={[{ value: '', label: 'Todos os status' }, ...PROPERTY_STATUSES.map(item => ({ value: item, label: item }))]} />
              <FancySelect size="compact" ariaLabel="Filtrar por cidade" value={filters.city} onChange={value => updateFilter('city', value)} placeholder="Todas as cidades" options={[{ value: '', label: 'Todas as cidades' }, ...cities.map(item => ({ value: item, label: item }))]} />
              <FancySelect size="compact" ariaLabel="Filtrar por tipo" value={filters.propertyType} onChange={updatePropertyTypeFilter} placeholder="Todos os tipos" options={[{ value: '', label: 'Todos os tipos' }, ...propertyTypes.map(item => ({ value: item, label: item }))]} />
              <FancySelect size="compact" ariaLabel="Filtrar por dormitórios" value={filters.bedrooms} onChange={value => updateFilter('bedrooms', value)} placeholder="Dormitórios" options={[{ value: '', label: 'Dormitórios' }, ...[1, 2, 3, 4].map(item => ({ value: String(item), label: `${item}+` }))]} />
              <FancySelect size="compact" ariaLabel="Filtrar por suíte" value={filters.suite} onChange={value => updateFilter('suite', value)} placeholder="Todas as suítes" options={[{ value: '', label: 'Todas as suítes' }, { value: 'yes', label: 'Com suíte' }, { value: 'no', label: 'Sem suíte' }]} />
              {(!filters.propertyType || filters.propertyType === 'Apartamento') && <FancySelect size="compact" ariaLabel="Filtrar por andar" value={filters.floorGroup} onChange={value => updateFilter('floorGroup', value)} placeholder="Todos os andares" options={[{ value: '', label: 'Todos os andares' }, { value: 'ground', label: 'Térreo' }, { value: 'upper', label: '1º andar ou superior' }, { value: 'unknown', label: 'Andar não informado' }]} />}
              {(!filters.propertyType || ['Casa', 'Sobrado'].includes(filters.propertyType)) && <FancySelect size="compact" className="col-span-2" ariaLabel="Filtrar por configuração do terreno" value={filters.landConfiguration} onChange={value => updateFilter('landConfiguration', value)} placeholder="Todos os terrenos" options={[{ value: '', label: 'Todos os terrenos' }, ...LAND_CONFIGURATIONS.map(item => ({ value: item, label: item })), { value: 'unknown', label: 'Não informado' }]} />}
            </div>
            {activeFilterChips.length > 0 && <button type="button" onClick={() => setFilters(initialFilters)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gray-100 text-sm font-bold text-gray-600"><FilterX className="h-4 w-4" />Limpar todos os filtros</button>}
            <div className="border-t border-gray-100 pt-4"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Ação rápida</p><Button onClick={() => { setMobileFilters(false); setCreationLocation(null); setEditingProperty(null); }} className="w-full"><Plus className="h-4 w-4" />Cadastrar imóvel</Button></div>
            <Button onClick={() => setMobileFilters(false)} size="lg" className="w-full">Ver {filtered.length} imóvel(is)</Button>
          </div>
        </section>
      </div>}

      <div style={{ '--property-sidebar-width': isSidebarCollapsed ? '0px' : `${sidebarWidth}px` }} className="grid min-h-0 flex-1 transition-[grid-template-columns] duration-200 lg:mx-3 lg:mb-3 lg:overflow-hidden lg:rounded-b-2xl lg:border-x lg:border-b lg:border-slate-200 lg:grid-cols-[var(--property-sidebar-width)_minmax(0,1fr)]">
        <aside ref={propertyListRef} className={`${mobile && mobileView !== 'list' ? 'hidden' : ''} order-2 overflow-y-auto border-r border-slate-200 bg-slate-50/95 p-3 lg:order-1 ${isSidebarCollapsed ? 'lg:overflow-hidden lg:border-r-0 lg:p-0' : ''}`}>
          {isLoading ? <LoadingState label="Carregando imóveis..." description="Organizando a lista por cidade e disponibilidade." /> : filtered.length ? <div className="space-y-3">{cityGroups.map(group => { const collapsed = collapsedCities.has(group.city); return <section key={group.city}><button type="button" onClick={() => toggleCity(group.city)} aria-expanded={!collapsed} className={`sticky -top-3 z-10 -mx-1 flex w-[calc(100%+8px)] items-center justify-between border-b border-gray-200 bg-gray-50/95 px-2 py-2.5 text-left backdrop-blur transition hover:bg-gray-100 ${collapsed ? 'mb-0' : 'mb-2'}`}><span className="flex min-w-0 items-center gap-2 text-xs font-extrabold uppercase tracking-[0.08em] text-gray-700"><ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${collapsed ? '-rotate-90' : ''}`} /><span className="h-3 w-3 shrink-0 rounded-full ring-4 ring-white" style={{ backgroundColor: group.color }} />{group.city}</span><span className="flex items-center gap-1.5"><span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600"><Star className="h-3 w-3" fill="currentColor" />{group.items.filter(item => item.isFavorite).length}</span><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-gray-500 ring-1 ring-gray-200">{group.items.length}</span></span></button>{!collapsed && <div className="space-y-2">{group.items.map(property => <PropertyListCard key={property.id} property={property} selected={selectedProperty?.id === property.id} highlighted={hoveredPropertyId === property.id} onClick={() => setSelectedProperty(property)} onHover={setHoveredPropertyId} onToggleFavorite={toggleFavorite} isFavoriteUpdating={favoritePending.has(property.id)} />)}</div>}</section>; })}</div> : <EmptyState icon={Building2} title="Nenhum imóvel encontrado" description="Ajuste os filtros ou cadastre um novo imóvel para começar." />}
        </aside>
        <main className={`${mobile && mobileView !== 'map' ? 'hidden' : ''} relative order-1 min-h-0 overflow-hidden bg-slate-100 lg:order-2`}>
          {!isSidebarCollapsed && <div role="separator" aria-label="Ajustar largura da lista" aria-orientation="vertical" onPointerDown={startSidebarResize} onPointerMove={resizeSidebar} onPointerUp={finishSidebarResize} onPointerCancel={finishSidebarResize} className="absolute inset-y-0 -left-1 z-30 hidden w-2 touch-none cursor-col-resize lg:block"><span className="absolute inset-y-0 left-1/2 w-px bg-transparent transition hover:bg-primary/40" /></div>}
          <button type="button" onClick={() => setIsSidebarCollapsed(current => !current)} title={isSidebarCollapsed ? 'Expandir lista de imóveis' : 'Recolher lista de imóveis'} aria-label={isSidebarCollapsed ? 'Expandir lista de imóveis' : 'Recolher lista de imóveis'} className="absolute left-3 top-4 z-30 hidden h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-primary shadow-xl transition hover:border-primary/30 hover:bg-primary/5 lg:flex">{isSidebarCollapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}</button>
          <PropertyMap properties={filtered} selectedPropertyId={selectedProperty?.id} hoveredPropertyId={hoveredPropertyId} locatedAddress={locatedAddress} onSelect={selectProperty} onHover={setHoveredPropertyId} onCreateAtLocation={createAtLocation} />
          <div className="absolute left-3 right-3 top-3 z-20 lg:left-16 lg:right-auto lg:top-4 lg:w-[min(470px,calc(100%-80px))]">
            <PropertyAddressSearch value={addressQuery} onChange={setAddressQuery} properties={properties} onSelectProperty={selectSearchProperty} onSelectAddress={selectAddressResult} placeholder={mobile ? 'Buscar endereço ou condomínio' : 'Localizar endereço ou condomínio no mapa...'} />
            {isLocatingAddress && <div className="mt-2 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 shadow-lg"><Loader2 className="h-4 w-4 animate-spin text-primary" />Localizando endereço no mapa...</div>}
            {locatedAddress && !isLocatingAddress && (
              <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                <div className="flex gap-3 p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600"><MapPin className="h-5 w-5" /></span><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-purple-600">Endereço localizado</p><p className="mt-1 text-sm font-bold leading-5 text-gray-800">{locatedAddress.formattedAddress || locatedAddress.address}</p></div></div>
                {nearbyProperties.length > 0 && <div className="mx-3 mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-bold text-amber-800">Encontramos {nearbyProperties.length} imóvel(is) próximo(s)</p><div className="mt-2 space-y-1">{nearbyProperties.slice(0, 3).map(property => <button key={property.id} type="button" onClick={() => selectSearchProperty(property)} className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-amber-800 hover:bg-amber-100">{property.code ? `${property.code} · ` : ''}{property.title}</button>)}</div></div>}
                <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 p-3"><button type="button" onClick={() => { setLocatedAddress(null); setAddressQuery(''); }} className="rounded-lg px-3 py-2 text-xs font-bold text-gray-500 hover:bg-gray-200">Limpar</button><button type="button" onClick={createLocatedProperty} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-white hover:bg-[#274D68]"><Plus className="h-4 w-4" />Cadastrar neste endereço</button></div>
              </div>
            )}
          </div>
          <div className="absolute bottom-4 left-4 z-10 hidden max-w-[calc(100%-32px)] flex-wrap gap-x-3 gap-y-2 rounded-xl border border-gray-200 bg-white/95 p-2.5 text-[11px] font-semibold text-gray-600 shadow-sm backdrop-blur sm:flex">{cityGroups.map(group => <span key={group.city} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: group.color }} />{group.city}</span>)}</div>
          {selectedProperty && !mobile && <PropertyDetail key={selectedProperty.id} property={selectedProperty} onClose={() => setSelectedProperty(null)} onEdit={() => setEditingProperty(selectedProperty)} onDelete={() => setDeletePending(selectedProperty)} onToggleFavorite={toggleFavorite} isFavoriteUpdating={favoritePending.has(selectedProperty.id)} />}
        </main>
      </div>

      {selectedProperty && mobile && <PropertyDetail key={selectedProperty.id} property={selectedProperty} onClose={() => setSelectedProperty(null)} onEdit={() => setEditingProperty(selectedProperty)} onDelete={() => setDeletePending(selectedProperty)} onToggleFavorite={toggleFavorite} isFavoriteUpdating={favoritePending.has(selectedProperty.id)} />}
      {editingProperty !== undefined && <PropertyFormModal key={editingProperty?.id || `${creationLocation?.latitude || 'new'}:${creationLocation?.longitude || ''}`} property={editingProperty} initialLocation={editingProperty ? null : creationLocation} properties={properties} onClose={closePropertyForm} onSave={saveProperty} isSaving={isSaving} />}
      {deletePending && <DeleteModal property={deletePending} onClose={() => setDeletePending(null)} onConfirm={confirmDelete} isDeleting={isDeleting} />}
    </div>
  );
}
