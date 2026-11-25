export const prospectStages = [
  { value: 'SEARCHING', label: 'Buscar proprietário', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  { value: 'CONTACT_FOUND', label: 'Contato localizado', color: 'bg-blue-50 text-blue-800 border-blue-200' },
  { value: 'IN_CONTACT', label: 'Em contato', color: 'bg-purple-50 text-purple-800 border-purple-200' },
  { value: 'CAPTURED', label: 'Captado', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  { value: 'DISCARDED', label: 'Descartado', color: 'bg-slate-100 text-slate-600 border-slate-200' },
];
export const prospectAddress = item => [
  [item.street, item.number].filter(Boolean).join(', '), item.complement,
  item.neighborhood, [item.city, item.state].filter(Boolean).join(' / '),
].filter(Boolean).join(' · ');
export const formatProspectPostalCode = value => {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
};
export const prospectPhone = value => {
  const digits = String(value || '').replace(/\D/g, '');
  const local = digits.length > 11 && digits.startsWith('55') ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return value || '';
};
