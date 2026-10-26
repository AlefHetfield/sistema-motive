import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, AlertTriangle, Eye } from 'lucide-react';
import { propertyDriveImageUrl } from '../services/api';
import PropertyDetailsModal from './properties/PropertyDetailsModal';

export default function TaskPropertyCard({ property, compact = false }) {
  const [failedCover, setFailedCover] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const cover = property.photoUrl || (property.driveCoverFileId ? propertyDriveImageUrl(property.driveCoverFileId) : '');
  const unavailable = property.status === 'Indisponível';
  return <div className={`flex min-w-0 items-start gap-3 rounded-xl border ${compact ? 'w-full max-w-md p-2.5' : 'p-3'} ${unavailable ? 'border-red-300 bg-red-50' : compact ? 'border-slate-100 bg-slate-50/70' : 'border-gray-200 bg-white'}`}>
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 ${compact ? 'h-16 w-16' : 'h-20 w-20'}`}>{cover && failedCover !== cover ? <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" onError={() => setFailedCover(cover)} /> : <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-gray-400"><Building2 size={compact ? 20 : 24} />{!compact && <span className="mt-1 text-[8px] font-semibold uppercase">Sem foto</span>}</div>}</div>
    <div className="min-w-0 flex-1">
      <p className={`break-words font-semibold leading-5 text-slate-800 ${compact ? 'text-[13px]' : 'text-sm'}`}>
        {property.code && <span className="text-primary">{property.code} <span aria-hidden="true">· </span></span>}{property.title}
      </p>
      <p className="mt-0.5 break-words text-xs leading-5 text-slate-500">{[property.neighborhood, property.city].filter(Boolean).join(' · ') || property.address}</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs leading-5">
        <span className="font-semibold text-slate-700">{property.price != null ? property.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Valor não informado'}</span>
        <span className={`text-[11px] font-medium ${unavailable ? 'text-red-600' : 'text-slate-500'}`}>{property.status}</span>
      </p>
      {unavailable && <p role="status" className={`${compact ? 'mt-1' : 'mt-2'} flex items-start gap-1.5 text-xs font-semibold text-red-700`}><AlertTriangle size={15} className="shrink-0" />Imóvel indisponível. Revise esta publicação antes de postar.</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button type="button" aria-haspopup="dialog" aria-expanded={detailsOpen} aria-label={`Ver dados do imóvel ${property.code || property.title}`} onClick={() => setDetailsOpen(true)} className="inline-flex min-h-8 items-center gap-1.5 rounded-md text-xs font-semibold text-primary underline underline-offset-2 outline-none hover:text-secondary focus-visible:ring-2 focus-visible:ring-primary/30"><Eye size={14} aria-hidden="true" />Ver dados do imóvel</button>
        <Link to={`/properties-map?property=${property.id}`} className="inline-flex min-h-8 items-center rounded-md text-xs text-slate-500 underline underline-offset-2 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/30">{compact ? 'Ver no mapa' : 'Abrir imóvel no mapa'}</Link>
      </div>
    </div>
    {detailsOpen && <PropertyDetailsModal key={property.id} propertyId={property.id} onClose={() => setDetailsOpen(false)} />}
  </div>;
}
