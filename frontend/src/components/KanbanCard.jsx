import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion as Motion } from 'framer-motion';
import { Edit, Trash2, Home, Copy, Check, CheckCircle2, FileText, PauseCircle, PlayCircle, GripVertical, MoreHorizontal, UserRound, Banknote, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import StatusBadge from './ui/StatusBadge';
import FancySelect from './FancySelect';

const compactCurrency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const AVATAR_PALETTES = [
  'bg-indigo-50 text-indigo-700',
  'bg-green-50 text-green-700',
  'bg-rose-50 text-rose-700',
  'bg-amber-50 text-amber-700',
  'bg-sky-50 text-sky-700',
];

const getInitials = (name) => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getAvatarStyle = (name) => {
  if (!name) return AVATAR_PALETTES[0];
  const charCode = name.charCodeAt(0);
  return AVATAR_PALETTES[charCode % AVATAR_PALETTES.length];
};

export default function KanbanCard({
  client,
  isDragging,
  status,
  onEditClient,
  onDeleteClient,
  onRequestCompletion,
  onPauseClient,
  onResumeClient,
  onMoveClient,
  statusOptions = [],
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [cpfCopied, setCpfCopied] = useState(false);
  const [matriculaCopied, setMatriculaCopied] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: client.id, data: { status }, disabled: client.emEspera });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleCopyCpf = async (e) => {
    e.stopPropagation();
    try {
      // Remove formatação do CPF antes de copiar
      const cpfNumeros = client.cpf.replace(/\D/g, '');
      await navigator.clipboard.writeText(cpfNumeros);
      setCpfCopied(true);
      setTimeout(() => setCpfCopied(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar CPF:', err);
    }
  };

  const handleCopyMatricula = async (e) => {
    e.stopPropagation();
    try {
      // Remove formatação da matrícula antes de copiar
      const matriculaNumeros = client.matricula.replace(/\D/g, '');
      await navigator.clipboard.writeText(matriculaNumeros);
      setMatriculaCopied(true);
      setTimeout(() => setMatriculaCopied(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar matrícula:', err);
    }
  };

  const responsible = client.corretor || client.responsavel || 'Sem responsável';

  return (
    <Motion.div
      ref={setNodeRef}
      style={style}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      className={`
        relative min-h-[176px] rounded-xl border border-slate-200 bg-white p-3
        ${client.emEspera ? 'bg-slate-50 opacity-65' : ''}
        transition-all duration-150
        ${isSortableDragging ? 'z-50 scale-[1.02] border-primary/40 bg-blue-50 shadow-xl' : 'hover:border-primary/20 hover:shadow-md'}
        ${isMenuOpen ? 'z-40' : ''}
        ${isDragging ? 'opacity-50' : ''}
      `}
    >
      {/* Nome do cliente */}
      <div className="mb-2 flex items-start gap-2">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${getAvatarStyle(client.nome)}`}>
          {getInitials(client.nome)}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="truncate pr-12 text-sm font-bold text-gray-900">
            {client.nome}
          </h4>
          {client.emEspera && <StatusBadge status="Em espera" size="xs" className="mt-1" />}
        </div>
        {!isDragging && !client.emEspera && <button type="button" {...attributes} {...listeners} onClick={event => event.stopPropagation()} className="absolute right-9 top-2.5 flex h-8 w-8 cursor-grab touch-none items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-100 hover:text-primary active:cursor-grabbing" aria-label={`Arrastar ${client.nome}`} title="Arrastar para outra etapa"><GripVertical className="h-4 w-4" /></button>}
        {!isDragging && <button type="button" onClick={event => { event.stopPropagation(); setIsMenuOpen(value => !value); }} className="absolute right-2 top-2.5 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-expanded={isMenuOpen} aria-label={`Ações de ${client.nome}`}><MoreHorizontal className="h-4 w-4" /></button>}
      </div>

      {/* Informações secundárias */}
      <div className="mb-2 space-y-1 text-xs text-gray-600">
        {client.cpf && (
          <div className="group flex items-center gap-1.5 relative">
            <span>CPF:</span>
            <span className="font-mono">{client.cpf}</span>
            <button
              onClick={handleCopyCpf}
              className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-primary"
              title="Copiar CPF"
            >
              {cpfCopied ? (
                <Check className="w-3 h-3 text-green-600" />
              ) : (
                <Copy className="w-3 h-3 text-gray-500" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Propriedade */}
      {client.nomePropriedade && (
        <div className="mb-2 rounded-lg bg-slate-50 px-2 py-1.5 ring-1 ring-slate-100">
          <div className="flex items-center gap-1.5 text-xs">
            <Home className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <span className="truncate text-gray-700 font-medium">
              {client.nomePropriedade}
            </span>
          </div>
        </div>
      )}

      {/* Matrícula e Cidade */}
      <div className="mb-2 flex min-h-4 items-center gap-1.5 text-xs text-gray-600">
        <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        {client.matricula ? (
          <div className="group flex items-center gap-1.5 relative">
            <span className="font-mono">{client.matricula}</span>
            {client.cidade && <span>-</span>}
            {client.cidade && <span className="truncate">{client.cidade}</span>}
            <button
              onClick={handleCopyMatricula}
              className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-primary"
              title="Copiar Matrícula"
            >
              {matriculaCopied ? (
                <Check className="w-3 h-3 text-green-600" />
              ) : (
                <Copy className="w-3 h-3 text-gray-500" />
              )}
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 text-[10px]">
        <div className="min-w-0"><span className="flex items-center gap-1 text-slate-400"><UserRound className="h-3 w-3" />Responsável</span><p className="mt-0.5 truncate font-semibold text-slate-700" title={responsible}>{responsible}</p></div>
        <div className="min-w-0"><span className="flex items-center gap-1 text-slate-400"><Banknote className="h-3 w-3" />Financiamento</span><p className="mt-0.5 truncate font-semibold text-slate-700">{client.valorFinanciado ? compactCurrency.format(Number(client.valorFinanciado)) : 'Não informado'}</p></div>
      </div>

      {isMenuOpen && (
        <Motion.div
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -2 }}
          onClick={event => event.stopPropagation()}
          className="absolute right-2 top-11 z-30 w-[230px] space-y-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xl"
        >
          {!client.emEspera && <div><p className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-slate-400"><ArrowRight className="h-3 w-3" />Mover para</p><FancySelect size="compact" ariaLabel={`Mover ${client.nome} para outra etapa`} value="" placeholder="Selecionar etapa" options={statusOptions.filter(option => option.value !== status)} onChange={value => { if (value) onMoveClient?.(client, value); setIsMenuOpen(false); }} /></div>}
          <div className="grid grid-cols-2 gap-1.5 border-t border-slate-100 pt-2">
          {status === 'Assinando Contrato' && !client.emEspera && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRequestCompletion?.(client);
              }}
              className="col-span-2 flex items-center justify-center gap-1 rounded-lg bg-emerald-50 px-2 py-2 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Concluir
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (client.emEspera) onResumeClient?.(client);
              else onPauseClient?.(client);
            }}
            className={`flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${client.emEspera ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
          >
            {client.emEspera ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
            {client.emEspera ? 'Retomar' : 'Espera'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditClient && onEditClient(client);
            }}
            className="flex items-center justify-center gap-1 rounded-lg bg-blue-50 px-2 py-2 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100"
          >
            <Edit className="w-3.5 h-3.5" />
            Editar
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteClient && onDeleteClient(client);
            }}
            className="col-span-2 flex items-center justify-center gap-1 rounded-lg bg-red-50 px-2 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Deletar
          </button>
          </div>
        </Motion.div>
      )}
    </Motion.div>
  );
}
