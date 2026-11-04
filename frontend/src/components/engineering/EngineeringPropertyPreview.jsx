import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { propertyDriveImageUrl } from '../../services/api';
import { engineeringMoney } from './engineeringForm';

export function EngineeringPropertyThumbnail({ property, compact = false, className = '' }) {
  const [failedCover, setFailedCover] = useState('');
  const cover = property?.photoUrl || (property?.driveCoverFileId ? propertyDriveImageUrl(property.driveCoverFileId) : '');
  return <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${compact ? 'h-14 w-14' : 'h-20 w-20'} ${className}`}>
    {cover && cover !== failedCover ? <img src={cover} alt={`Foto do imóvel ${property.code || property.title}`} className="h-full w-full object-cover" loading="lazy" onError={() => setFailedCover(cover)} /> : <span role="img" aria-label="Imóvel sem foto" className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400"><Building2 size={compact ? 20 : 24} aria-hidden="true" /><span className="text-[8px] font-semibold uppercase">Sem foto</span></span>}
  </span>;
}

export default function EngineeringPropertyPreview({ property, compact = false, className = '' }) {
  if (!property) return null;
  return <div className={`flex min-w-0 items-start gap-3 ${className}`}>
    <EngineeringPropertyThumbnail property={property} compact={compact} />
    <div className="min-w-0 flex-1">
      <p className="break-words text-sm font-semibold leading-5 text-slate-800">{property.code ? `${property.code} · ` : ''}{property.title}</p>
      <p className="mt-0.5 break-words text-xs leading-5 text-slate-500">{[property.neighborhood, property.city].filter(Boolean).join(' · ') || property.address || 'Cidade não informada'}</p>
      <p className="mt-0.5 break-words text-xs leading-5 text-slate-500">Proprietário: {property.ownerName?.trim() || 'Não informado'}</p>
      <p className="mt-1 text-sm font-semibold text-primary">{engineeringMoney(property.price)}</p>
    </div>
  </div>;
}
