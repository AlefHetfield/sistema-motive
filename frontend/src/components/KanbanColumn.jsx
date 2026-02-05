import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { motion } from 'framer-motion';
import KanbanCard from './KanbanCard';

export default function KanbanColumn({ 
  status, 
  config, 
  clients, 
  onEditClient, 
  onDeleteClient,
  isDropTarget = false,
  isDragging = false 
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
    data: { status },
  });

  const Icon = config.icon;
  
  // Destaque visual quando o card está sobre a coluna
  const isHighlighted = isDragging && (isOver || isDropTarget);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ 
        opacity: 1, 
        x: 0,
        scale: isHighlighted ? 1.02 : 1,
      }}
      transition={{ duration: 0.2 }}
      className={`
        flex flex-col bg-white rounded-xl shadow-sm border-2 flex-shrink-0 w-full h-fit
        transition-all duration-200
        ${isHighlighted ? 'border-blue-400 shadow-lg ring-2 ring-blue-200' : 'border-gray-100'}
      `}
    >
      {/* Header da coluna */}
      <div className={`bg-gradient-to-r ${config.color} p-4 rounded-t-xl sticky top-0 z-10`}>
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-5 h-5 text-white flex-shrink-0" />
          <h3 className="font-semibold text-white truncate text-sm flex-1">{status}</h3>
        </div>
        <div className="text-white/80 text-xs font-medium">
          {clients.length} cliente{clients.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Área de drop - Limitado a 600px de altura com scroll oculto */}
      <div
        ref={setNodeRef}
        className="p-3 bg-gray-50/50 overflow-y-auto space-y-2 scrollbar-hide"
        style={{
          maxHeight: '600px',
          minHeight: '100px',
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE e Edge
        }}
      >
        <SortableContext
          items={clients.map(c => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {clients.length > 0 ? (
            clients.map((client, index) => (
              <motion.div
                key={client.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <KanbanCard
                  client={client}
                  status={status}
                  onEditClient={onEditClient}
                  onDeleteClient={onDeleteClient}
                />
              </motion.div>
            ))
          ) : (
            <div className="h-20 flex items-center justify-center text-gray-400 text-sm">
              Nenhum cliente
            </div>
          )}
        </SortableContext>
      </div>
    </motion.div>
  );
}
