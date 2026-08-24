import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  CircleDot,
  Clock3,
  FileCheck2,
  Loader2,
  PauseCircle,
  ShieldCheck,
  UserRound,
  XCircle,
} from 'lucide-react';

const toneClasses = {
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  red: 'border-red-200 bg-red-50 text-red-700',
  gray: 'border-gray-200 bg-gray-100 text-gray-600',
  purple: 'border-purple-200 bg-purple-50 text-purple-700',
};

const solidToneClasses = {
  blue: 'border-blue-500 bg-blue-500 text-white',
  green: 'border-emerald-600 bg-emerald-600 text-white',
  amber: 'border-amber-500 bg-amber-500 text-white',
  red: 'border-red-600 bg-red-600 text-white',
  gray: 'border-gray-500 bg-gray-500 text-white',
  purple: 'border-purple-600 bg-purple-600 text-white',
};

const sizes = {
  xs: 'gap-1 px-2 py-0.5 text-[10px]',
  sm: 'gap-1.5 px-2.5 py-1 text-xs',
  md: 'gap-1.5 px-3 py-1.5 text-xs',
};

const exactDefinitions = {
  'Documentação Recebida': { tone: 'blue', icon: FileCheck2 },
  Aprovado: { tone: 'green', icon: CheckCircle2 },
  'Solicitando Engenharia': { tone: 'amber', icon: Clock3 },
  'Engenharia Solicitada': { tone: 'amber', icon: Clock3 },
  'Baixando FGTS': { tone: 'blue', icon: Clock3 },
  'Preenchendo Fichas': { tone: 'blue', icon: FileCheck2 },
  'Assinando Fichas': { tone: 'purple', icon: FileCheck2 },
  Finalizando: { tone: 'purple', icon: FileCheck2 },
  'Aguardando Reserva': { tone: 'amber', icon: Clock3 },
  'Enviando para Conformidade': { tone: 'blue', icon: FileCheck2 },
  'Aguardando Conformidade': { tone: 'amber', icon: Clock3 },
  Inconforme: { tone: 'red', icon: AlertTriangle },
  'Conforme - Ag. Contrato': { tone: 'green', icon: CheckCircle2 },
  'Assinando Contrato': { tone: 'blue', icon: FileCheck2 },
  Assinado: { tone: 'green', icon: CheckCircle2 },
  'Assinado-Movido': { tone: 'green', icon: CheckCircle2, label: 'Assinado' },
  Arquivado: { tone: 'gray', icon: Archive },
  'Em espera': { tone: 'amber', icon: PauseCircle },
  Disponível: { tone: 'blue', icon: CircleDot },
  Reservado: { tone: 'amber', icon: Clock3 },
  Vendido: { tone: 'green', icon: CheckCircle2 },
  Indisponível: { tone: 'gray', icon: XCircle },
  'Confirmar disponibilidade': { tone: 'red', icon: AlertTriangle },
  Ativo: { tone: 'green', icon: CheckCircle2 },
  Inativo: { tone: 'gray', icon: XCircle },
  Administrador: { tone: 'purple', icon: ShieldCheck },
  Assistente: { tone: 'amber', icon: UserRound },
  Corretor: { tone: 'blue', icon: UserRound },
};

function getStatusDefinition(status) {
  if (exactDefinitions[status]) return exactDefinitions[status];
  const normalized = String(status || '').toLocaleLowerCase('pt-BR');
  if (/erro|falha|inconform/.test(normalized)) return { tone: 'red', icon: AlertTriangle };
  if (/conclu|aprova|assina|conforme|vendido|ativo/.test(normalized)) return { tone: 'green', icon: CheckCircle2 };
  if (/aguard|pendente|reserva|espera/.test(normalized)) return { tone: 'amber', icon: Clock3 };
  if (/arquiv|inativ|indispon/.test(normalized)) return { tone: 'gray', icon: Archive };
  if (/admin|finaliz/.test(normalized)) return { tone: 'purple', icon: ShieldCheck };
  return { tone: 'blue', icon: CircleDot };
}

export default function StatusBadge({ status, label, tone, icon, loading = false, size = 'sm', solid = false, className = '' }) {
  const definition = getStatusDefinition(status || label);
  const IconComponent = icon || definition.icon;
  const resolvedTone = tone || definition.tone;
  const displayLabel = label || definition.label || status;
  const palette = solid ? solidToneClasses : toneClasses;

  return (
    <span className={`inline-flex max-w-full items-center rounded-full border font-semibold leading-none ${sizes[size]} ${palette[resolvedTone] || palette.blue} ${className}`} title={displayLabel} aria-busy={loading} role="status">
      {loading ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : IconComponent ? <IconComponent className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
      <span className="truncate">{displayLabel}</span>
    </span>
  );
}
