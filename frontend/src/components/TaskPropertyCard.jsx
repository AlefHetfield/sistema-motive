import { Link } from 'react-router-dom';
import { Building2, AlertTriangle } from 'lucide-react';
import { propertyDriveImageUrl } from '../services/api';

export default function TaskPropertyCard({ property }) {
  const cover = property.photoUrl || (property.driveCoverFileId ? propertyDriveImageUrl(property.driveCoverFileId) : '');
  const unavailable = property.status === 'Indisponível';
  return <div className={`flex gap-3 rounded-xl border p-3 ${unavailable ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
    <div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">{cover ? <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} /> : <Building2 className="text-gray-400" size={24} />}</div>
    <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold text-gray-800">{property.code ? `${property.code} · ` : ''}{property.title}</p><p className="mt-1 text-xs text-gray-500">{[property.neighborhood, property.city].filter(Boolean).join(' · ') || property.address}</p>
      <p className="mt-1 text-xs font-semibold text-gray-600">{property.price != null ? property.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Valor não informado'} · {property.status}</p>
      {unavailable && <p role="status" className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-red-700"><AlertTriangle size={15} className="shrink-0" />Imóvel indisponível. Revise esta publicação antes de postar.</p>}
      <Link to={`/properties-map?property=${property.id}`} className="mt-1 inline-block text-xs font-semibold text-primary underline">Abrir imóvel no mapa</Link>
    </div>
  </div>;
}
