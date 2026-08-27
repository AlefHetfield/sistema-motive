import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bath,
  BedDouble,
  Building2,
  CalendarCheck,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileUp,
  FilterX,
  Home,
  Image as ImageIcon,
  Images,
  Loader2,
  MapPin,
  Maximize2,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  RefreshCw,
  Route,
  Search,
  SlidersHorizontal,
  Star,
  Trash2,
  UserRound,
  AlertTriangle,
  X,
} from 'lucide-react';
import Button from '../components/ui/Button';
import { compactControlClass } from '../components/ui/styles';
import { EmptyState, LoadingState } from '../components/ui/FeedbackState';
import StatusBadge from '../components/ui/StatusBadge';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import PropertyMap from '../components/properties/PropertyMap';
import PropertyFormModal from '../components/properties/PropertyFormModal';
import PropertyImportModal from '../components/properties/PropertyImportModal';
import PropertyAddressSearch from '../components/properties/PropertyAddressSearch';
import { PROPERTY_CITY_PRIORITY, PROPERTY_STATUSES, propertyCityColor } from '../components/properties/propertyConstants';
import { clearAllProperties, createProperty, deleteProperty, downloadPropertiesBackup, fetchProperties, fetchPropertyDrivePhotos, geocodePropertyPlace, importProperties, propertyDriveImageUrl, refreshPropertyDrivePhotos, refreshPropertyListings, setPropertyFavorite, updateProperty } from '../services/api';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const initialFilters = { search: '', status: '', city: '', propertyType: '', bedrooms: '', floorGroup: '', suite: '', landConfiguration: '' };
const LAND_CONFIGURATIONS = ['Meio', 'Intermediário', 'Inteiro'];
const initialListingRefresh = { running: false, complete: false, processed: 0, updated: 0, failed: [], cursor: 0, error: '' };

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
  return (
    <div data-property-id={property.id} onMouseEnter={() => onHover(property.id)} onMouseLeave={() => onHover(null)} className={`relative w-full overflow-hidden rounded-xl border bg-white text-left transition [content-visibility:auto] [contain-intrinsic-size:76px] ${selected ? 'border-primary shadow-md ring-2 ring-primary/10' : highlighted ? 'border-primary/50 shadow-sm ring-2 ring-primary/5' : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'}`}>
      <button type="button" onClick={onClick} className="block w-full text-left">
        <div className="flex gap-2.5 p-2.5">
        <div className="flex h-[52px] w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
          {coverUrl ? <img src={coverUrl} alt="" loading="lazy" decoding="async" onError={event => { if (driveCoverUrl && !event.currentTarget.dataset.driveFallback) { event.currentTarget.dataset.driveFallback = 'true'; event.currentTarget.src = driveCoverUrl; } }} className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6 text-gray-300" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1.5"><p className="truncate pr-7 text-sm font-bold leading-4 text-gray-900" title={displayTitle}>{displayTitle}</p><ChevronRight className="h-4 w-4 shrink-0 text-gray-300" /></div>
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
  return <div className="rounded-xl bg-gray-50 p-3">{icon}<p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</p><p className="mt-0.5 text-sm font-bold text-gray-800">{value ?? '—'}</p></div>;
}

function PropertyDetail({ property, onClose, onEdit, onDelete }) {
  const [drivePhotos, setDrivePhotos] = useState([]);
  const [activePhoto, setActivePhoto] = useState(0);
  const [failedPhotoIds, setFailedPhotoIds] = useState(() => new Set());
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(Boolean(property.driveFolderUrl));
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
  return (
    <aside className="absolute inset-y-3 right-3 z-20 flex w-[min(390px,calc(100%-24px))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
      <div className="relative h-48 shrink-0 bg-gradient-to-br from-slate-200 to-slate-100">
        {displayedPhoto ? <img src={displayedPhoto.url} alt={displayedPhoto.name || property.title} onError={() => setFailedPhotoIds(current => new Set(current).add(displayedPhoto.id))} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center">{isLoadingPhotos ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <Home className="h-14 w-14 text-gray-300" />}</div>}
        {gallery.length > 1 && <><button type="button" onClick={() => setActivePhoto((displayedPhotoIndex - 1 + gallery.length) % gallery.length)} aria-label="Foto anterior" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-gray-700 shadow hover:bg-white"><ChevronLeft className="h-4 w-4" /></button><button type="button" onClick={() => setActivePhoto((displayedPhotoIndex + 1) % gallery.length)} aria-label="Próxima foto" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-gray-700 shadow hover:bg-white"><ChevronRight className="h-4 w-4" /></button><span className="absolute bottom-3 right-3 rounded-full bg-gray-950/70 px-2.5 py-1 text-[11px] font-bold text-white">{displayedPhotoIndex + 1}/{gallery.length}</span></>}
        <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded-full bg-white/95 p-2 text-gray-600 shadow hover:text-gray-900"><X className="h-4 w-4" /></button>
        <StatusBadge status={property.status} solid className="absolute bottom-3 left-3 shadow" />
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{property.code ? `Imóvel ${property.code}` : property.propertyType || 'Imóvel'}</p>
        <h2 className="mt-1 text-xl font-bold leading-7 text-gray-900">{cleanPropertyTitle(property.title)}</h2>
        <p className="mt-2 flex gap-2 text-sm leading-5 text-gray-500"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{property.address}{property.neighborhood ? ` · ${property.neighborhood}` : ''}{property.city ? `, ${property.city}` : ''}</p>
        <p className="mt-4 text-2xl font-bold text-gray-900">{property.price ? currency.format(property.price) : 'Valor sob consulta'}</p>

        <div className="mt-5 grid grid-cols-4 gap-2">
          <DetailMetric icon={<BedDouble className="h-4 w-4 text-primary" />} label="Dorm." value={property.bedrooms} />
          <DetailMetric icon={<Bath className="h-4 w-4 text-primary" />} label="Suítes" value={property.suites} />
          <DetailMetric icon={<Car className="h-4 w-4 text-primary" />} label="Vagas" value={property.parkingSpaces} />
          <DetailMetric icon={<Maximize2 className="h-4 w-4 text-primary" />} label="Área" value={property.area ? `${number.format(property.area)} m²` : null} />
        </div>

        <div className="mt-5 space-y-3 border-t border-gray-100 pt-5 text-sm">
          <div className="flex items-center justify-between gap-3"><span className="text-gray-500">Condição</span><strong className="text-gray-800">{property.condition || 'Não informada'}</strong></div>
          <div className="flex items-center justify-between gap-3"><span className="text-gray-500">Tipo</span><strong className="text-gray-800">{property.propertyType || 'Não informado'}</strong></div>
          {property.propertyType === 'Apartamento' && <div className="flex items-center justify-between gap-3"><span className="text-gray-500">Andar</span><strong className="text-gray-800">{property.floor === null || property.floor === undefined ? 'Não informado' : Number(property.floor) === 0 ? 'Térreo' : `${property.floor}º andar`}</strong></div>}
          {['Casa', 'Sobrado'].includes(property.propertyType) && <div className="flex items-center justify-between gap-3"><span className="text-gray-500">Configuração do terreno</span><strong className="text-gray-800">{property.landConfiguration || 'Não informada'}</strong></div>}
          <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-gray-500"><UserRound className="h-4 w-4" />Captador</span><strong className="text-gray-800">{property.captador || 'Não informado'}</strong></div>
          {property.ownerName && <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-gray-500"><UserRound className="h-4 w-4" />Proprietário</span><strong className="text-right text-gray-800">{property.ownerName}</strong></div>}
          {property.ownerWhatsapp && <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-gray-500"><MessageCircle className="h-4 w-4" />WhatsApp</span><button type="button" onClick={copyOwnerWhatsapp} title="Copiar contato" className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 font-bold text-emerald-700 transition hover:bg-emerald-100"><span>{formatWhatsapp(property.ownerWhatsapp)}</span><Copy className="h-3.5 w-3.5" /></button></div>}
          <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-gray-500"><CalendarCheck className="h-4 w-4" />Disponibilidade</span><strong className="text-gray-800">{formatDate(property.lastAvailabilityCheck)}</strong></div>
        </div>
        {property.description && <div className="mt-5 whitespace-pre-wrap break-words border-t border-gray-100 pt-5 text-sm leading-6 text-gray-600">{property.description}</div>}
      </div>
      <footer className="grid grid-cols-2 gap-2 border-t border-gray-100 bg-gray-50 p-3">
        <a href={routeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-primary ring-1 ring-gray-200 hover:bg-primary/5"><Route className="h-4 w-4" />Abrir rota</a>
        {property.sourceUrl && <a href={property.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-primary ring-1 ring-gray-200 hover:bg-primary/5"><ExternalLink className="h-4 w-4" />Abrir ficha</a>}
        <button type="button" onClick={onEdit} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-white hover:bg-[#4a637a]"><Pencil className="h-4 w-4" />Editar</button>
        <button type="button" onClick={onDelete} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-100"><Trash2 className="h-4 w-4" />Excluir</button>
      </footer>
    </aside>
  );
}

function DeleteModal({ property, onClose, onConfirm, isDeleting }) {
  return <div className="fixed inset-0 z-[9700] flex items-center justify-center bg-gray-950/40 p-4 backdrop-blur-[2px]"><button type="button" className="absolute inset-0" onClick={onClose} aria-label="Cancelar exclusão" /><div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600"><Trash2 className="h-5 w-5" /></span><h2 className="mt-4 text-lg font-bold text-gray-900">Excluir imóvel?</h2><p className="mt-2 text-sm leading-6 text-gray-500">O imóvel <strong>{cleanPropertyTitle(property.title)}</strong> será removido do mapa e não poderá ser recuperado.</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100">Cancelar</button><button type="button" disabled={isDeleting} onClick={onConfirm} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">{isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}Excluir imóvel</button></div></div></div>;
}

function ClearMapModal({ count, confirmation, onConfirmationChange, onClose, onConfirm, isClearing }) {
  const isConfirmed = confirmation === 'LIMPAR MAPA';
  return (
    <div className="fixed inset-0 z-[9700] flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-[2px]">
      <button type="button" className="absolute inset-0" onClick={isClearing ? undefined : onClose} aria-label="Cancelar limpeza do mapa" />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="p-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600"><AlertTriangle className="h-6 w-6" /></span>
          <h2 className="mt-4 text-xl font-bold text-gray-900">Limpar todo o mapa?</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">Esta ação excluirá permanentemente <strong>{count} imóvel(is)</strong>. O arquivo de backup já deve estar salvo no seu computador.</p>
          <label className="mt-5 block text-xs font-bold text-gray-600">Digite <strong className="text-red-600">LIMPAR MAPA</strong> para confirmar</label>
          <input autoFocus value={confirmation} onChange={event => onConfirmationChange(event.target.value.toUpperCase())} disabled={isClearing} placeholder="LIMPAR MAPA" className="mt-2 h-11 w-full rounded-xl border border-gray-200 px-3.5 text-sm font-semibold outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-100 disabled:bg-gray-50" />
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4">
          <Button onClick={onClose} variant="ghost" disabled={isClearing}>Cancelar</Button>
          <Button onClick={onConfirm} variant="danger" loading={isClearing} loadingLabel="Limpando..." disabled={!isConfirmed}>Excluir todos os imóveis</Button>
        </div>
      </div>
    </div>
  );
}

function RefreshListingsModal({ total, state, onClose, onConfirm }) {
  const progress = total ? Math.min(100, Math.round((state.processed / total) * 100)) : 0;
  const canClose = !state.running;
  return (
    <div className="fixed inset-0 z-[9700] flex items-center justify-center bg-gray-950/40 p-4 backdrop-blur-[2px]">
      <button type="button" className="absolute inset-0" onClick={canClose ? onClose : undefined} aria-label="Fechar atualização" />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start gap-3 border-b border-gray-100 p-5">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${state.complete ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-primary'}`}>
            {state.complete ? <CheckCircle2 className="h-5 w-5" /> : <RefreshCw className={`h-5 w-5 ${state.running ? 'animate-spin' : ''}`} />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-gray-900">{state.complete ? 'Anúncios atualizados' : 'Atualizar dados dos anúncios'}</h2>
            <p className="mt-1 text-sm leading-5 text-gray-500">Fotos, valores, metragens e demais informações serão consultados novamente no site da Motive.</p>
          </div>
          {canClose && <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>}
        </header>

        <div className="p-5">
          {!state.running && !state.complete && state.processed === 0 && !state.error && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
              Encontramos <strong>{total} imóvel(is)</strong> com link do site. A atualização é feita em pequenos lotes e pode levar alguns minutos. Mantenha esta tela aberta até a conclusão.
            </div>
          )}

          {(state.running || state.processed > 0) && (
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-gray-600"><span>{state.running ? 'Atualizando anúncios...' : 'Processamento concluído'}</span><span>{state.processed} de {total}</span></div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} /></div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Atualizados</p><p className="mt-1 text-xl font-bold text-emerald-700">{state.updated}</p></div>
                <div className="rounded-xl bg-amber-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-amber-600">Não atualizados</p><p className="mt-1 text-xl font-bold text-amber-700">{state.failed.length}</p></div>
              </div>
            </div>
          )}

          {state.error && <div className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{state.error} Você pode continuar do ponto em que parou.</span></div>}
          {state.complete && state.failed.length > 0 && <div className="mt-4 max-h-32 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><p className="mb-2 font-bold">Anúncios que precisam de revisão:</p>{state.failed.map(item => <p key={item.id} className="py-0.5">{item.code || item.title}: {item.error}</p>)}</div>}
        </div>

        <footer className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-4">
          {canClose && <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200">{state.complete ? 'Concluir' : 'Cancelar'}</button>}
          {!state.complete && <button type="button" onClick={onConfirm} disabled={state.running || total === 0} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-[#4a637a] disabled:cursor-not-allowed disabled:opacity-50">{state.running && <Loader2 className="h-4 w-4 animate-spin" />}{state.error ? 'Continuar atualização' : state.running ? 'Atualizando...' : 'Atualizar todos'}</button>}
        </footer>
      </div>
    </div>
  );
}

export default function PropertiesMap() {
  const { isAdmin } = useAuth();
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
  const [showImport, setShowImport] = useState(false);
  const [deletePending, setDeletePending] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isRefreshingDrivePhotos, setIsRefreshingDrivePhotos] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [favoritePending, setFavoritePending] = useState(() => new Set());
  const [collapsedCities, setCollapsedCities] = useState(() => new Set());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(350);
  const [showListingRefresh, setShowListingRefresh] = useState(false);
  const [listingRefresh, setListingRefresh] = useState(initialListingRefresh);
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [showClearMap, setShowClearMap] = useState(false);
  const [clearConfirmation, setClearConfirmation] = useState('');
  const [isClearingMap, setIsClearingMap] = useState(false);

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
  const listingRefreshTotal = useMemo(() => properties.filter(property => /https?:\/\/(?:www\.)?motiveimoveis\.com/i.test(property.sourceUrl || '')).length, [properties]);
  const drivePhotosTotal = useMemo(() => properties.filter(property => property.driveFolderUrl).length, [properties]);

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
      setBackupDownloaded(false);
      toast.success(editingProperty ? 'Imóvel atualizado no mapa.' : 'Imóvel cadastrado no mapa.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImport = async (content, format) => {
    setIsImporting(true);
    try {
      const result = await importProperties(content, format);
      setShowImport(false);
      await loadProperties();
      setBackupDownloaded(false);
      toast.success(`${result.imported} imóvel(is) importado(s).${result.skipped ? ` ${result.skipped} ignorado(s).` : ''}`);
      if (result.withoutCoordinates) toast.info(`${result.withoutCoordinates} imóvel(is) precisam de coordenadas para aparecer no mapa.`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsImporting(false);
    }
  };

  const downloadBackup = async () => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    try {
      const backup = await downloadPropertiesBackup();
      const url = URL.createObjectURL(backup.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = backup.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setBackupDownloaded(true);
      toast.success(`Backup de ${backup.count} imóvel(is) baixado.`);
    } catch (error) {
      setBackupDownloaded(false);
      toast.error(error.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  const openClearMap = () => {
    if (!backupDownloaded) {
      toast.warning('Baixe o backup antes de limpar o mapa.');
      return;
    }
    setClearConfirmation('');
    setShowClearMap(true);
  };

  const confirmClearMap = async () => {
    if (clearConfirmation !== 'LIMPAR MAPA' || isClearingMap) return;
    setIsClearingMap(true);
    try {
      const result = await clearAllProperties(clearConfirmation);
      setProperties([]);
      setSelectedProperty(null);
      setHoveredPropertyId(null);
      setLocatedAddress(null);
      setAddressQuery('');
      setFilters(initialFilters);
      setShowClearMap(false);
      setClearConfirmation('');
      setBackupDownloaded(false);
      toast.success(`${result.deleted} imóvel(is) removido(s). O mapa está pronto para a nova importação.`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsClearingMap(false);
    }
  };

  const openListingRefresh = () => {
    setListingRefresh(initialListingRefresh);
    setShowListingRefresh(true);
  };

  const runListingRefresh = async () => {
    let cursor = listingRefresh.cursor;
    let hasMore = true;
    setListingRefresh(current => ({ ...current, running: true, complete: false, error: '' }));
    setBackupDownloaded(false);
    try {
      while (hasMore) {
        const result = await refreshPropertyListings(cursor, 6);
        const refreshed = Array.isArray(result.updated) ? result.updated : [];
        const failures = Array.isArray(result.failed) ? result.failed : [];
        if (refreshed.length) {
          const byId = new Map(refreshed.map(property => [property.id, property]));
          setProperties(current => current.map(property => byId.get(property.id) || property));
          setSelectedProperty(current => current ? byId.get(current.id) || current : current);
        }
        cursor = result.nextCursor || cursor;
        hasMore = Boolean(result.hasMore);
        setListingRefresh(current => ({
          ...current,
          processed: current.processed + Number(result.processed || 0),
          updated: current.updated + refreshed.length,
          failed: [...current.failed, ...failures],
          cursor,
        }));
      }
      setListingRefresh(current => ({ ...current, running: false, complete: true, cursor }));
      toast.success('Atualização dos anúncios concluída.');
    } catch (error) {
      setListingRefresh(current => ({ ...current, running: false, cursor, error: error.message }));
      toast.error(error.message);
    }
  };

  const runDrivePhotosRefresh = async () => {
    if (isRefreshingDrivePhotos || !drivePhotosTotal) return;
    setIsRefreshingDrivePhotos(true);
    setBackupDownloaded(false);
    let cursor = 0;
    let hasMore = true;
    let updatedCount = 0;
    const failures = [];
    try {
      while (hasMore) {
        const result = await refreshPropertyDrivePhotos(cursor, 10);
        const refreshed = Array.isArray(result.updated) ? result.updated : [];
        const byId = new Map(refreshed.map(property => [property.id, property]));
        if (refreshed.length) {
          setProperties(current => current.map(property => byId.get(property.id) || property));
          setSelectedProperty(current => current ? byId.get(current.id) || current : current);
        }
        updatedCount += refreshed.length;
        failures.push(...(Array.isArray(result.failed) ? result.failed : []));
        cursor = result.nextCursor || cursor;
        hasMore = Boolean(result.hasMore);
      }
      if (failures.length) toast.warning(`${updatedCount} imóvel(is) atualizado(s); ${failures.length} pasta(s) precisam de revisão.`);
      else toast.success(`${updatedCount} imóvel(is) receberam fotos do Google Drive.`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsRefreshingDrivePhotos(false);
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
      setBackupDownloaded(false);
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
    setBackupDownloaded(false);
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
    <div className="flex h-[calc(100vh-4rem)] min-h-[650px] flex-col overflow-hidden bg-gray-100">
      <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-gray-500"><strong className="text-gray-800">{filtered.length}</strong> imóvel(is) · <strong className="text-gray-800">{mappedCount}</strong> visível(is) no mapa</p>
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin() && (
              <details className="group relative z-40">
                <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 [&::-webkit-details-marker]:hidden"><Download className="h-4 w-4" />Backup<ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" /></summary>
                <div className="absolute right-0 top-[calc(100%+6px)] w-72 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl">
                  <button type="button" onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); downloadBackup(); }} disabled={isBackingUp} className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"><Download className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span><span className="block text-sm font-bold text-gray-700">Baixar backup</span><span className="mt-0.5 block text-xs leading-4 text-gray-400">Salva todos os dados em um arquivo JSON</span></span></button>
                  <div className="my-1 border-t border-gray-100" />
                  <button type="button" onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); openClearMap(); }} disabled={!properties.length || !backupDownloaded} className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-red-500" /><span><span className="block text-sm font-bold text-red-600">Limpar mapa</span><span className="mt-0.5 block text-xs leading-4 text-gray-400">{backupDownloaded ? `Excluir os ${properties.length} imóveis cadastrados` : 'Disponível após baixar o backup'}</span></span></button>
                </div>
              </details>
            )}
            <details className="group relative z-40">
              <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 [&::-webkit-details-marker]:hidden"><RefreshCw className={`h-4 w-4 ${isRefreshingDrivePhotos ? 'animate-spin' : ''}`} />Sincronizar<ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" /></summary>
              <div className="absolute right-0 top-[calc(100%+6px)] w-64 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl">
                <button type="button" onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); runDrivePhotosRefresh(); }} disabled={!drivePhotosTotal || isRefreshingDrivePhotos} className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"><Images className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span><span className="block text-sm font-bold text-gray-700">Fotos do Google Drive</span><span className="mt-0.5 block text-xs leading-4 text-gray-400">Atualiza capas e pastas vinculadas</span></span></button>
                <button type="button" onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); openListingRefresh(); }} disabled={!listingRefreshTotal} className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span><span className="block text-sm font-bold text-gray-700">Dados dos anúncios</span><span className="mt-0.5 block text-xs leading-4 text-gray-400">Consulta novamente o site da Motive</span></span></button>
              </div>
            </details>
            <Button onClick={() => setShowImport(true)} variant="secondary"><FileUp className="h-4 w-4" />Importar My Maps</Button>
            <Button onClick={() => { setCreationLocation(null); setEditingProperty(null); }}><Plus className="h-4 w-4" />Cadastrar imóvel</Button>
          </div>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_180px_160px_160px_120px_150px]">
          <label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><input value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Buscar imóvel, código ou proprietário" className={`${compactControlClass} pl-9`} /></label>
          <select value={filters.status} onChange={event => updateFilter('status', event.target.value)} className={compactControlClass}><option value="">Todos os status</option>{PROPERTY_STATUSES.map(item => <option key={item}>{item}</option>)}</select>
          <select value={filters.city} onChange={event => updateFilter('city', event.target.value)} className={compactControlClass}><option value="">Todas as cidades</option>{cities.map(item => <option key={item}>{item}</option>)}</select>
          <select value={filters.propertyType} onChange={event => updatePropertyTypeFilter(event.target.value)} className={compactControlClass}><option value="">Todos os tipos</option>{propertyTypes.map(item => <option key={item}>{item}</option>)}</select>
          <select value={filters.bedrooms} onChange={event => updateFilter('bedrooms', event.target.value)} className={compactControlClass}><option value="">Dormitórios</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option><option value="4">4+</option></select>
          <details className="group relative z-30">
            <summary className={`${compactControlClass} flex cursor-pointer list-none items-center justify-between gap-2 font-bold text-gray-600 [&::-webkit-details-marker]:hidden`}><span className="inline-flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" />Mais filtros</span><ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" /></summary>
            <div className="absolute right-0 top-[calc(100%+6px)] w-72 space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
              <label className="block"><span className="mb-1.5 block text-xs font-bold text-gray-600">Suíte</span><select value={filters.suite} onChange={event => updateFilter('suite', event.target.value)} className={compactControlClass}><option value="">Todas</option><option value="yes">Sim</option><option value="no">Não</option></select></label>
              {(!filters.propertyType || filters.propertyType === 'Apartamento') && <label className="block"><span className="mb-1.5 block text-xs font-bold text-gray-600">Andar</span><select value={filters.floorGroup} onChange={event => updateFilter('floorGroup', event.target.value)} className={compactControlClass}><option value="">Todos</option><option value="ground">Térreo</option><option value="upper">1º andar ou superior</option><option value="unknown">Não informado</option></select></label>}
              {(!filters.propertyType || ['Casa', 'Sobrado'].includes(filters.propertyType)) && <label className="block"><span className="mb-1.5 block text-xs font-bold text-gray-600">Configuração do terreno</span><select value={filters.landConfiguration} onChange={event => updateFilter('landConfiguration', event.target.value)} className={compactControlClass}><option value="">Todas</option>{LAND_CONFIGURATIONS.map(item => <option key={item}>{item}</option>)}<option value="unknown">Não informado</option></select></label>}
            </div>
          </details>
        </div>
        {activeFilterChips.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-primary/10 bg-primary/[0.04] px-2.5 py-2"><span className="mr-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-primary">Filtros ativos</span>{activeFilterChips.map(chip => <button key={chip.field} type="button" onClick={() => updateFilter(chip.field, '')} aria-label={`Remover filtro ${chip.label}`} className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-white px-2.5 py-1 text-xs font-bold text-primary shadow-sm hover:bg-primary/5">{chip.label}<X className="h-3 w-3" /></button>)}<span className="ml-auto text-xs font-semibold text-gray-500">{filtered.length} resultado(s)</span><button type="button" onClick={() => setFilters(initialFilters)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold text-gray-500 hover:bg-white hover:text-gray-700"><FilterX className="h-3.5 w-3.5" />Limpar todos</button></div>}
      </header>

      <div style={{ '--property-sidebar-width': isSidebarCollapsed ? '0px' : `${sidebarWidth}px` }} className="grid min-h-0 flex-1 transition-[grid-template-columns] duration-200 lg:grid-cols-[var(--property-sidebar-width)_minmax(0,1fr)]">
        <aside ref={propertyListRef} className={`order-2 overflow-y-auto border-r border-gray-200 bg-gray-50 p-3 lg:order-1 ${isSidebarCollapsed ? 'lg:overflow-hidden lg:border-r-0 lg:p-0' : ''}`}>
          {isLoading ? <LoadingState label="Carregando imóveis..." description="Organizando a lista por cidade e disponibilidade." /> : filtered.length ? <div className="space-y-3">{cityGroups.map(group => { const collapsed = collapsedCities.has(group.city); return <section key={group.city}><button type="button" onClick={() => toggleCity(group.city)} aria-expanded={!collapsed} className={`sticky -top-3 z-10 -mx-1 flex w-[calc(100%+8px)] items-center justify-between border-b border-gray-200 bg-gray-50/95 px-2 py-2.5 text-left backdrop-blur transition hover:bg-gray-100 ${collapsed ? 'mb-0' : 'mb-2'}`}><span className="flex min-w-0 items-center gap-2 text-xs font-extrabold uppercase tracking-[0.08em] text-gray-700"><ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${collapsed ? '-rotate-90' : ''}`} /><span className="h-3 w-3 shrink-0 rounded-full ring-4 ring-white" style={{ backgroundColor: group.color }} />{group.city}</span><span className="flex items-center gap-1.5"><span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600"><Star className="h-3 w-3" fill="currentColor" />{group.items.filter(item => item.isFavorite).length}</span><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-gray-500 ring-1 ring-gray-200">{group.items.length}</span></span></button>{!collapsed && <div className="space-y-2">{group.items.map(property => <PropertyListCard key={property.id} property={property} selected={selectedProperty?.id === property.id} highlighted={hoveredPropertyId === property.id} onClick={() => setSelectedProperty(property)} onHover={setHoveredPropertyId} onToggleFavorite={toggleFavorite} isFavoriteUpdating={favoritePending.has(property.id)} />)}</div>}</section>; })}</div> : <EmptyState icon={Building2} title="Nenhum imóvel encontrado" description="Ajuste os filtros ou cadastre um novo imóvel para começar." />}
        </aside>
        <main className="relative order-1 min-h-[520px] overflow-hidden lg:order-2">
          {!isSidebarCollapsed && <div role="separator" aria-label="Ajustar largura da lista" aria-orientation="vertical" onPointerDown={startSidebarResize} onPointerMove={resizeSidebar} onPointerUp={finishSidebarResize} onPointerCancel={finishSidebarResize} className="absolute inset-y-0 -left-1 z-30 hidden w-2 touch-none cursor-col-resize lg:block"><span className="absolute inset-y-0 left-1/2 w-px bg-transparent transition hover:bg-primary/40" /></div>}
          <button type="button" onClick={() => setIsSidebarCollapsed(current => !current)} title={isSidebarCollapsed ? 'Expandir lista de imóveis' : 'Recolher lista de imóveis'} aria-label={isSidebarCollapsed ? 'Expandir lista de imóveis' : 'Recolher lista de imóveis'} className="absolute left-3 top-4 z-30 hidden h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-primary shadow-xl transition hover:border-primary/30 hover:bg-primary/5 lg:flex">{isSidebarCollapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}</button>
          <PropertyMap properties={filtered} selectedPropertyId={selectedProperty?.id} hoveredPropertyId={hoveredPropertyId} locatedAddress={locatedAddress} onSelect={selectProperty} onHover={setHoveredPropertyId} onCreateAtLocation={createAtLocation} />
          <div className="absolute left-16 top-4 z-20 w-[min(470px,calc(100%-80px))]">
            <PropertyAddressSearch value={addressQuery} onChange={setAddressQuery} properties={properties} onSelectProperty={selectSearchProperty} onSelectAddress={selectAddressResult} placeholder="Localizar endereço ou condomínio no mapa..." />
            {isLocatingAddress && <div className="mt-2 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 shadow-lg"><Loader2 className="h-4 w-4 animate-spin text-primary" />Localizando endereço no mapa...</div>}
            {locatedAddress && !isLocatingAddress && (
              <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                <div className="flex gap-3 p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600"><MapPin className="h-5 w-5" /></span><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-purple-600">Endereço localizado</p><p className="mt-1 text-sm font-bold leading-5 text-gray-800">{locatedAddress.formattedAddress || locatedAddress.address}</p></div></div>
                {nearbyProperties.length > 0 && <div className="mx-3 mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-bold text-amber-800">Encontramos {nearbyProperties.length} imóvel(is) próximo(s)</p><div className="mt-2 space-y-1">{nearbyProperties.slice(0, 3).map(property => <button key={property.id} type="button" onClick={() => selectSearchProperty(property)} className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-amber-800 hover:bg-amber-100">{property.code ? `${property.code} · ` : ''}{property.title}</button>)}</div></div>}
                <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 p-3"><button type="button" onClick={() => { setLocatedAddress(null); setAddressQuery(''); }} className="rounded-lg px-3 py-2 text-xs font-bold text-gray-500 hover:bg-gray-200">Limpar</button><button type="button" onClick={createLocatedProperty} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-white hover:bg-[#4a637a]"><Plus className="h-4 w-4" />Cadastrar neste endereço</button></div>
              </div>
            )}
          </div>
          <div className="absolute bottom-4 left-4 z-10 hidden max-w-[calc(100%-32px)] flex-wrap gap-x-3 gap-y-2 rounded-xl border border-gray-200 bg-white/95 p-2.5 text-[11px] font-semibold text-gray-600 shadow-sm backdrop-blur sm:flex">{cityGroups.map(group => <span key={group.city} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: group.color }} />{group.city}</span>)}</div>
          {selectedProperty && <PropertyDetail key={selectedProperty.id} property={selectedProperty} onClose={() => setSelectedProperty(null)} onEdit={() => setEditingProperty(selectedProperty)} onDelete={() => setDeletePending(selectedProperty)} />}
        </main>
      </div>

      {editingProperty !== undefined && <PropertyFormModal key={editingProperty?.id || `${creationLocation?.latitude || 'new'}:${creationLocation?.longitude || ''}`} property={editingProperty} initialLocation={editingProperty ? null : creationLocation} properties={properties} onClose={closePropertyForm} onSave={saveProperty} isSaving={isSaving} />}
      {showImport && <PropertyImportModal onClose={() => setShowImport(false)} onImport={handleImport} isImporting={isImporting} />}
      {showListingRefresh && <RefreshListingsModal total={listingRefreshTotal} state={listingRefresh} onClose={() => setShowListingRefresh(false)} onConfirm={runListingRefresh} />}
      {deletePending && <DeleteModal property={deletePending} onClose={() => setDeletePending(null)} onConfirm={confirmDelete} isDeleting={isDeleting} />}
      {showClearMap && <ClearMapModal count={properties.length} confirmation={clearConfirmation} onConfirmationChange={setClearConfirmation} onClose={() => { setShowClearMap(false); setClearConfirmation(''); }} onConfirm={confirmClearMap} isClearing={isClearingMap} />}
    </div>
  );
}
