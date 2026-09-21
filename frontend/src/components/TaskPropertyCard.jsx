import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, AlertTriangle } from 'lucide-react';
import { propertyDriveImageUrl } from '../services/api';

export default function TaskPropertyCard({ property, compact = false }) {
  const [imageFailed, setImageFailed] = useState(false);
  const cover = property.photoUrl || (property.driveCoverFileId ? propertyDriveImageUrl(property.driveCoverFileId) : '');
  const unavailable = property.status === 'Indisponível';
  return <div className={`flex rounded-xl border ${compact ? 'gap-2 p-2' : 'gap-3 p-3'} ${unavailable ? 'border-red-300 bg-red-50' : compact ? 'border-slate-200 bg-slate-50/70' : 'border-gray-200 bg-white'}`}>
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 ${compact ? 'h-12 w-14' : 'h-16 w-20'}`}>{cover && !imageFailed ? <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" onError={() => setImageFailed(true)} /> : <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-gray-400"><Building2 size={compact ? 18 : 22} />{!compact && <span className="mt-1 text-[8px] font-semibold uppercase">Sem foto</span>}</div>}</div>
    <div className="min-w-0 flex-1"><p className={`${compact ? 'truncate text-xs' : 'break-words text-sm'} font-semibold text-gray-800`}>{property.code ? `${property.code} · ` : ''}{property.title}</p><p className={`${compact ? 'mt-0.5 truncate' : 'mt-1'} text-xs text-gray-500`}>{[property.neighborhood, property.city].filter(Boolean).join(' · ') || property.address}</p>
      <p className="mt-1 text-xs font-semibold text-gray-600">{property.price != null ? property.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Valor não informado'} · {property.status}</p>
      {unavailable && <p role="status" className={`${compact ? 'mt-1' : 'mt-2'} flex items-start gap-1.5 text-xs font-semibold text-red-700`}><AlertTriangle size={15} className="shrink-0" />Imóvel indisponível. Revise esta publicação antes de postar.</p>}
      <Link to={`/properties-map?property=${property.id}`} className={`${compact ? 'mt-0.5' : 'mt-1'} inline-block text-xs font-semibold text-primary underline`}>{compact ? 'Ver no mapa' : 'Abrir imóvel no mapa'}</Link>
    </div>
  </div>;
}
