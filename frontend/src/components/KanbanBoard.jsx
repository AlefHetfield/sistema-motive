import { useState, useMemo, useEffect, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
  CheckCircle2, Clock, AlertCircle, AlertTriangle,
  FileCheck, Calendar, ChevronLeft, ChevronRight, PanelsTopLeft
} from 'lucide-react';
import ClientModal from './ClientModal';
import ConfirmModal from './ConfirmModal';
import FancySelect from './FancySelect';
import { saveClient, deleteClient } from '../services/api';
import useActivityLog from '../hooks/useActivityLog';
import { useAuth } from '../context/AuthContext';
import KanbanCard from './KanbanCard';
import KanbanColumn from './KanbanColumn';
import { useToast } from '../hooks/useToast';
import useMobileLayout from '../hooks/useMobileLayout';

const STATUS_OPTIONS = [
  "Documentação Recebida",
  "Aprovado",
  "Solicitando Engenharia",
  "Engenharia Solicitada",
  "Baixando FGTS",
  "Preenchendo Fichas",
  "Assinando Fichas",
  "Finalizando",
  "Aguardando Reserva",
  "Enviando para Conformidade",
  "Aguardando Conformidade",
  "Inconforme",
  "Conforme - Ag. Contrato",
  "Assinando Contrato",
];

const KANBAN_PHASES = [
  { label: 'Cadastro', statuses: ['Documentação Recebida', 'Aprovado'] },
  { label: 'Engenharia', statuses: ['Solicitando Engenharia', 'Engenharia Solicitada'] },
  { label: 'FGTS e fichas', statuses: ['Baixando FGTS', 'Preenchendo Fichas', 'Assinando Fichas', 'Finalizando'] },
  { label: 'Conformidade', statuses: ['Aguardando Reserva', 'Enviando para Conformidade', 'Aguardando Conformidade', 'Inconforme'] },
  { label: 'Contrato', statuses: ['Conforme - Ag. Contrato', 'Assinando Contrato'] },
];

const statusConfig = {
  'Documentação Recebida': { 
    color: 'from-gray-400 to-gray-500',
    bgLight: 'bg-gray-50',
    icon: FileCheck 
  },
  'Aprovado': { 
    color: 'from-emerald-400 to-emerald-500',
    bgLight: 'bg-emerald-50',
    icon: CheckCircle2 
  },
  'Solicitando Engenharia': { 
    color: 'from-amber-400 to-amber-500',
    bgLight: 'bg-amber-50',
    icon: Clock 
  },
  'Engenharia Solicitada': { 
    color: 'from-orange-400 to-orange-500',
    bgLight: 'bg-orange-50',
    icon: AlertCircle 
  },
  'Baixando FGTS': { 
    color: 'from-yellow-400 to-yellow-500',
    bgLight: 'bg-yellow-50',
    icon: Clock 
  },
  'Preenchendo Fichas': { 
    color: 'from-teal-400 to-teal-500',
    bgLight: 'bg-teal-50',
    icon: FileCheck 
  },
  'Assinando Fichas': { 
    color: 'from-cyan-400 to-cyan-500',
    bgLight: 'bg-cyan-50',
    icon: Calendar 
  },
  'Finalizando': { 
    color: 'from-purple-400 to-purple-500',
    bgLight: 'bg-purple-50',
    icon: FileCheck 
  },
  'Aguardando Reserva': { 
    color: 'from-blue-400 to-blue-500',
    bgLight: 'bg-blue-50',
    icon: Calendar 
  },
  'Enviando para Conformidade': { 
    color: 'from-pink-400 to-pink-500',
    bgLight: 'bg-pink-50',
    icon: AlertCircle 
  },
  'Aguardando Conformidade': { 
    color: 'from-rose-400 to-rose-500',
    bgLight: 'bg-rose-50',
    icon: AlertCircle 
  },
  'Inconforme': { 
    color: 'from-red-400 to-red-500',
    bgLight: 'bg-red-50',
    icon: AlertTriangle 
  },
  'Conforme - Ag. Contrato': { 
    color: 'from-lime-400 to-lime-500',
    bgLight: 'bg-lime-50',
    icon: FileCheck 
  },
  'Assinando Contrato': { 
    color: 'from-indigo-400 to-indigo-500',
    bgLight: 'bg-indigo-50',
    icon: FileCheck 
  },
};

export default function KanbanBoard({ clients, onUpdate, onRequestCompletion, onPauseClient, onResumeClient }) {
  const mobile = useMobileLayout();
  const [mobileStatus, setMobileStatus] = useState(() => STATUS_OPTIONS.find(status => clients.some(client => client.status === status)) || STATUS_OPTIONS[0]);
  const [showMobileStats, setShowMobileStats] = useState(false);
  const notify = useToast();
  const { logActivity } = useActivityLog();
  const { user } = useAuth();
  const [activeId, setActiveId] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [deletingClient, setDeletingClient] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState(null);
  const [activePhase, setActivePhase] = useState(0);
  const boardRef = useRef(null);
  
  // Verifica se o usuário é assistente (não vê dados de financiamento)
  const isAssistant = user?.role === 'ASSISTENTE';
  
  // Estado local otimista para atualizações instantâneas
  const [optimisticClients, setOptimisticClients] = useState(clients);
  
  // Sincronizar estado local com props quando clients mudar (apenas em reloads reais)
  useEffect(() => {
    setOptimisticClients(clients);
  }, [clients]);

  // Configurar sensores de drag - Otimizado para melhor responsividade
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Agrupar clientes por status usando estado otimista
  const clientsByStatus = useMemo(() => {
    const grouped = {};
    STATUS_OPTIONS.forEach(status => {
      grouped[status] = optimisticClients.filter(c => c.status === status);
    });
    return grouped;
  }, [optimisticClients]);

  useEffect(() => {
    if (!mobile || clientsByStatus[mobileStatus]?.length) return;
    const firstStatusWithClients = STATUS_OPTIONS.find(status => clientsByStatus[status]?.length);
    if (firstStatusWithClients) setMobileStatus(firstStatusWithClients);
  }, [clientsByStatus, mobile, mobileStatus]);

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
    setTargetStatus(null); // Reset target status ao iniciar novo drag
  };

  const handleDragOver = (event) => {
    const { over } = event;
    // Apenas rastrear para qual coluna estamos movendo (feedback visual)
    if (over?.data.current?.status) {
      setTargetStatus(over.data.current.status);
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    // Apenas atualizar quando soltar o card
    if (over && active.data.current?.status !== over.data.current?.status) {
      const activeClient = optimisticClients.find(c => c.id === active.id);
      if (activeClient && over.data.current?.status) {
        updateClientStatus(activeClient, over.data.current.status);
      }
    }

    // Limpar estado
    setActiveId(null);
    setTargetStatus(null);
  };

  const updateClientStatus = async (client, newStatus) => {
    const statusAntes = client.status;

    // 1. ATUALIZAÇÃO OTIMISTA: Atualiza UI imediatamente
    setOptimisticClients(prevClients =>
      prevClients.map(c =>
        c.id === client.id ? { ...c, status: newStatus } : c
      )
    );
    
    // Feedback instantâneo ao usuário
    notify.success(`Cliente movido para "${newStatus}"`);
    
    try {
      // 2. SINCRONIZAÇÃO: Salva no backend em background
      const updatedClient = { ...client, status: newStatus };
      await saveClient(updatedClient);
      
      // Log de atividade
      await logActivity({
        clientId: client.id,
        clientNome: client.nome,
        action: 'status_changed',
        statusAntes,
        statusDepois: newStatus,
      });
      
      // ✅ NÃO chama onUpdate() aqui - a atualização otimista já fez o trabalho!
      // A UI já está correta e sincronizada com o backend
    } catch (error) {
      console.error('Erro ao mover cliente:', error);
      
      // 3. REVERSÃO: Reverte apenas em caso de erro
      setOptimisticClients(prevClients =>
        prevClients.map(c =>
          c.id === client.id ? { ...c, status: statusAntes } : c
        )
      );
      
      notify.error('Erro ao mover cliente. Revertendo...');
      // Força reload APENAS em caso de erro para garantir consistência
      onUpdate();
    }
  };

  const handleEditClient = (client) => {
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const handleDeleteClient = (client) => {
    setDeletingClient(client);
  };

  const confirmDelete = async () => {
    try {
      await deleteClient(deletingClient.id);
      await logActivity({
        clientId: deletingClient.id,
        clientNome: deletingClient.nome,
        action: 'deleted',
      });
      notify.success('Cliente deletado com sucesso');
      setDeletingClient(null);
      onUpdate();
    } catch (error) {
      console.error('Erro ao deletar:', error);
      notify.error('Erro ao deletar cliente');
    }
  };

  const handleSaveClient = async (clientData) => {
    try {
      if (!clientData) {
        throw new Error('Dados do cliente não fornecidos');
      }

      const isNewClient = !clientData.id;
      const savedClient = await saveClient(clientData);
      
      if (!savedClient || !savedClient.id) {
        throw new Error('Resposta inválida do servidor');
      }
      
      // Registra atividade
      if (isNewClient) {
        await logActivity({
          clientId: savedClient.id,
          clientNome: savedClient.nome,
          action: 'created',
        });
        notify.success(`Cliente ${savedClient.nome} adicionado com sucesso! 🎉`);
      } else {
        await logActivity({
          clientId: savedClient.id,
          clientNome: savedClient.nome,
          action: 'updated',
        });
        notify.success(`Cliente ${savedClient.nome} atualizado com sucesso! ✅`);
      }
      
      setEditingClient(null);
      setIsModalOpen(false);
      // Aguarda um tick para garantir que o modal fechou antes de recarregar os dados
      setTimeout(() => onUpdate(), 100);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      notify.error(`Erro ao salvar cliente: ${error.message}`);
    }
  };

  // Calcular totais usando dados otimistas
  const stats = useMemo(() => {
    const financiamentoTotal = optimisticClients.reduce((sum, client) => {
      const valor = Number(client.valorFinanciado) || 0;
      
      // Debug: log valores anormais
      if (valor > 10000000) { // Maior que 10 milhões
        console.warn('Valor financiado anormal detectado:', {
          cliente: client.nome,
          valor: valor,
          valorOriginal: client.valorFinanciado
        });
      }
      
      return sum + valor;
    }, 0);

    const remuneracao = optimisticClients.reduce((sum, client) => {
      const valor = Number(client.valorFinanciado) || 0;
      let valorConsiderado = valor;
      
      // Se for FGTS, trava em 200.000
      if (client.modalidade?.toUpperCase() === 'FGTS' && valor > 200000) {
        valorConsiderado = 200000;
      }
      
      // 0,8% do valor considerado
      return sum + (valorConsiderado * 0.008);
    }, 0);

    return {
      total: optimisticClients.length,
      aprovados: clientsByStatus['Aprovado']?.length || 0,
      engenhariaSolicitada: clientsByStatus['Engenharia Solicitada']?.length || 0,
      aguardandoReserva: clientsByStatus['Aguardando Reserva']?.length || 0,
      aguardandoConformidade: clientsByStatus['Aguardando Conformidade']?.length || 0,
      financiamentoTotal,
      remuneracao,
    };
  }, [optimisticClients, clientsByStatus]);

  const scrollToPhase = (phaseIndex) => {
    const board = boardRef.current;
    if (!board) return;
    const safeIndex = Math.max(0, Math.min(KANBAN_PHASES.length - 1, phaseIndex));
    const firstStatus = KANBAN_PHASES[safeIndex].statuses[0];
    const columnIndex = STATUS_OPTIONS.indexOf(firstStatus);
    const column = board.children[columnIndex];
    if (!column) return;
    setActivePhase(safeIndex);
    board.scrollTo({ left: Math.max(0, column.offsetLeft - board.offsetLeft), behavior: 'smooth' });
  };

  const trackVisiblePhase = (event) => {
    const board = event.currentTarget;
    const currentLeft = board.scrollLeft + 80;
    let visiblePhase = 0;
    KANBAN_PHASES.forEach((phase, phaseIndex) => {
      const columnIndex = STATUS_OPTIONS.indexOf(phase.statuses[0]);
      const column = board.children[columnIndex];
      if (column && column.offsetLeft - board.offsetLeft <= currentLeft) visiblePhase = phaseIndex;
    });
    if (visiblePhase !== activePhase) setActivePhase(visiblePhase);
  };

  return (
    <div className="w-full h-full">
      {/* Header com estatísticas */}
      <div className="mb-3 lg:hidden">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600">Clientes</p>
            <p className="mt-1 text-xl font-bold text-blue-950">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Aprovados</p>
            <p className="mt-1 text-xl font-bold text-emerald-950">{stats.aprovados}</p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Em andamento</p>
            <p className="mt-1 text-xl font-bold text-amber-950">{Math.max(0, stats.total - stats.aprovados)}</p>
          </div>
        </div>
        <button
          type="button"
          aria-expanded={showMobileStats}
          onClick={() => setShowMobileStats(value => !value)}
          className="mt-1.5 flex min-h-9 w-full items-center justify-center gap-1 text-xs font-semibold text-primary"
        >
          {showMobileStats ? 'Ocultar indicadores' : 'Ver indicadores'}
          <span aria-hidden="true">{showMobileStats ? '−' : '+'}</span>
        </button>
        {showMobileStats && (
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-gray-200 bg-white p-2.5">
            <div><p className="text-[10px] text-gray-500">Engenharia</p><p className="font-bold text-orange-700">{stats.engenhariaSolicitada}</p></div>
            <div><p className="text-[10px] text-gray-500">Aguardando reserva</p><p className="font-bold text-blue-700">{stats.aguardandoReserva}</p></div>
            <div><p className="text-[10px] text-gray-500">Aguardando conformidade</p><p className="font-bold text-rose-700">{stats.aguardandoConformidade}</p></div>
            {!isAssistant && <div className="min-w-0"><p className="text-[10px] text-gray-500">Financiamento</p><p className="truncate font-bold text-indigo-800" title={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.financiamentoTotal)}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(stats.financiamentoTotal)}</p></div>}
          </div>
        )}
      </div>

      <div className="app-card mb-4 hidden overflow-hidden lg:grid lg:grid-cols-5 xl:grid-cols-7">
        {[
          ['Total', stats.total, 'text-primary'],
          ['Aprovados', stats.aprovados, 'text-emerald-700'],
          ['Engenharia', stats.engenhariaSolicitada, 'text-amber-700'],
          ['Ag. reserva', stats.aguardandoReserva, 'text-sky-700'],
          ['Ag. conformidade', stats.aguardandoConformidade, 'text-rose-700'],
        ].map(([label, value, tone]) => <div key={label} className="border-b border-r border-slate-100 bg-white px-4 py-3 xl:border-b-0"><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p><p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p></div>)}
        {!isAssistant && <><div className="min-w-0 border-r border-slate-100 bg-white px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Financiamento</p><p className="mt-1 truncate text-lg font-bold text-indigo-800" title={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.financiamentoTotal)}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(stats.financiamentoTotal)}</p></div><div className="min-w-0 bg-white px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Remuneração</p><p className="mt-1 truncate text-lg font-bold text-purple-800" title={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.remuneracao)}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(stats.remuneracao)}</p></div></>}
      </div>

      <label className="mb-3 block lg:hidden">
        <span className="mb-1.5 block text-sm font-semibold text-gray-700">Etapa exibida</span>
        <FancySelect ariaLabel="Etapa exibida" value={mobileStatus} onChange={setMobileStatus} options={STATUS_OPTIONS.map(status => ({ value: status, label: `${status} (${clientsByStatus[status]?.length || 0})` }))} />
      </label>

      <div className="mb-3 hidden items-center gap-2 lg:flex">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1" aria-label="Fases do processo">
          <span className="ml-1 flex shrink-0 items-center gap-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400"><PanelsTopLeft className="h-3.5 w-3.5" />Fases</span>
          {KANBAN_PHASES.map((phase, index) => <button key={phase.label} type="button" onClick={() => scrollToPhase(index)} aria-pressed={activePhase === index} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition ${activePhase === index ? 'bg-secondary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}>{index + 1}. {phase.label}<span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] ${activePhase === index ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>{phase.statuses.reduce((total, status) => total + (clientsByStatus[status]?.length || 0), 0)}</span></button>)}
        </div>
        <button type="button" onClick={() => scrollToPhase(activePhase - 1)} disabled={activePhase === 0} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-primary/20 hover:text-primary disabled:opacity-35" aria-label="Fase anterior"><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" onClick={() => scrollToPhase(activePhase + 1)} disabled={activePhase === KANBAN_PHASES.length - 1} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-primary/20 hover:text-primary disabled:opacity-35" aria-label="Próxima fase"><ChevronRight className="h-4 w-4" /></button>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        autoScroll={{ threshold: { x: 0.15, y: 0.2 }, acceleration: 10 }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div ref={boardRef} onScroll={trackVisiblePhase} className="kanban-scroll flex w-full gap-3 overflow-x-auto pb-4 lg:snap-x lg:snap-mandatory">
          {STATUS_OPTIONS.filter((status) => !mobile || status === mobileStatus).map((status) => (
            <div key={status} data-kanban-status={status} className="w-full flex-shrink-0 lg:w-[300px] lg:snap-start">
              <KanbanColumn
                status={status}
                config={statusConfig[status]}
                clients={clientsByStatus[status]}
                onEditClient={handleEditClient}
                onDeleteClient={handleDeleteClient}
                onRequestCompletion={onRequestCompletion}
                onPauseClient={onPauseClient}
                onResumeClient={onResumeClient}
                onMoveClient={updateClientStatus}
                statusOptions={STATUS_OPTIONS.map(option => ({ value: option, label: option }))}
                isDropTarget={targetStatus === status}
                isDragging={activeId !== null}
              />
            </div>
          ))}
        </div>

        <DragOverlay
          dropAnimation={{
            duration: 250,
            easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          }}
        >
          {activeId ? (
            <div style={{
              transform: 'rotate(3deg) scale(1.05)',
              pointerEvents: 'none',
            }}>
              <KanbanCard
                client={optimisticClients.find(c => c.id === activeId)}
                isDragging={true}
                status={optimisticClients.find(c => c.id === activeId)?.status}
                statusOptions={[]}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Modal de edição */}
      {isModalOpen && (
        <ClientModal
          clientToEdit={editingClient}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveClient}
          isOpen={isModalOpen}
        />
      )}

      {/* Modal de confirmação de delete */}
      {deletingClient && (
        <ConfirmModal
          isOpen={!!deletingClient}
          title="Deletar Cliente"
          message={`Tem certeza que deseja deletar ${deletingClient.nome}?`}
          onConfirm={confirmDelete}
          onCancel={() => setDeletingClient(null)}
          confirmText="Deletar"
          cancelText="Cancelar"
          confirmColor="red"
          warning="Esta ação não pode ser desfeita."
        />
      )}
    </div>
  );
}
