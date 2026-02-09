import { useState, useMemo, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { motion } from 'framer-motion';
import {
  CheckCircle2, Clock, AlertCircle, AlertTriangle, Archive,
  FileCheck, Calendar, X, Edit, Trash2, Plus
} from 'lucide-react';
import ClientModal from './ClientModal';
import ConfirmModal from './ConfirmModal';
import { saveClient, deleteClient } from '../services/api';
import useActivityLog from '../hooks/useActivityLog';
import KanbanCard from './KanbanCard';
import KanbanColumn from './KanbanColumn';
import { useToast } from '../hooks/useToast';

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
  "Assinado",
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
  'Assinado': { 
    color: 'from-green-400 to-green-500',
    bgLight: 'bg-green-50',
    icon: CheckCircle2 
  },
};

export default function KanbanBoard({ clients, onUpdate }) {
  const notify = useToast();
  const { logActivity } = useActivityLog();
  const [activeId, setActiveId] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [deletingClient, setDeletingClient] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState(null);
  
  // Estado local otimista para atualizações instantâneas
  const [optimisticClients, setOptimisticClients] = useState(clients);
  
  // Sincronizar estado local com props quando clients mudar (apenas em reloads reais)
  useEffect(() => {
    setOptimisticClients(clients);
  }, [clients]);

  // Configurar sensores de drag - Otimizado para melhor responsividade
  const sensors = useSensors(
    useSensor(PointerSensor, {
      distance: 5, // Reduzido para ativar mais facilmente
      activationConstraint: {
        delay: 100, // Menos delay para maior fluidez
        tolerance: 5,
      },
    })
  );

  // Agrupar clientes por status usando estado otimista
  const clientsByStatus = useMemo(() => {
    const grouped = {};
    STATUS_OPTIONS.forEach(status => {
      grouped[status] = optimisticClients.filter(c => c.status === status);
    });
    return grouped;
  }, [optimisticClients]);

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
      const activeClient = clients.find(c => c.id === active.id);
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
  const stats = {
    total: optimisticClients.length,
    aprovados: clientsByStatus['Aprovado']?.length || 0,
    engenhariaSolicitada: clientsByStatus['Engenharia Solicitada']?.length || 0,
    aguardandoReserva: clientsByStatus['Aguardando Reserva']?.length || 0,
    aguardandoConformidade: clientsByStatus['Aguardando Conformidade']?.length || 0,
  };

  return (
    <div className="w-full h-full">
      {/* Header com estatísticas */}
      <div className="mb-6 grid grid-cols-5 gap-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200"
        >
          <p className="text-blue-600 text-sm font-medium">Total</p>
          <p className="text-3xl font-bold text-blue-900">{stats.total}</p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-lg border border-emerald-200"
        >
          <p className="text-emerald-600 text-sm font-medium">Aprovados</p>
          <p className="text-3xl font-bold text-emerald-900">{stats.aprovados}</p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg border border-amber-200"
        >
          <p className="text-amber-600 text-sm font-medium">Engenharia Solicitada</p>
          <p className="text-3xl font-bold text-amber-900">{stats.engenhariaSolicitada}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-sky-50 to-sky-100 p-4 rounded-lg border border-sky-200"
        >
          <p className="text-sky-600 text-sm font-medium">Aguardando Reserva</p>
          <p className="text-3xl font-bold text-sky-900">{stats.aguardandoReserva}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-rose-50 to-rose-100 p-4 rounded-lg border border-rose-200"
        >
          <p className="text-rose-600 text-sm font-medium">Aguardando Conformidade</p>
          <p className="text-3xl font-bold text-rose-900">{stats.aguardandoConformidade}</p>
        </motion.div>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 pb-4 overflow-x-auto w-full kanban-scroll">
          {STATUS_OPTIONS.map((status) => (
            <div key={status} className="flex-shrink-0 w-80">
              <KanbanColumn
                status={status}
                config={statusConfig[status]}
                clients={clientsByStatus[status]}
                onEditClient={handleEditClient}
                onDeleteClient={handleDeleteClient}
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
        />
      )}
    </div>
  );
}
