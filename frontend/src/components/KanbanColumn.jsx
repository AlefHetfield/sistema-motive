import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { motion as Motion } from 'framer-motion';
import KanbanCard from './KanbanCard';

export default function KanbanColumn({ 
  status, 
  config, 
  clients, 
  onEditClient, 
  onDeleteClient,
  onRequestCompletion,
  onPauseClient,
  onResumeClient,
  onMoveClient,
  statusOptions,
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
    <Motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ 
        opacity: 1, 
        x: 0,
        scale: isHighlighted ? 1.02 : 1,
      }}
      transition={{ duration: 0.2 }}
      className={`flex h-full min-h-[310px] w-full flex-shrink-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-all duration-200 ${isHighlighted ? 'border-primary/50 shadow-lg ring-4 ring-primary/10' : 'border-slate-200'}`}
    >
      {/* Header da coluna */}
      <div className="sticky top-0 z-10 bg-white">
        <div className={`h-1 bg-gradient-to-r ${config.color}`} />
        <div className="flex items-center gap-2.5 px-3.5 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Icon className="h-4 w-4" /></span>
          <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">{status}</h3>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">{clients.length}</span>
        </div>
      </div>

      {/* Área de drop */}
      <div
        ref={setNodeRef}
        aria-label={`Etapa ${status}, ${clients.length} cliente${clients.length !== 1 ? 's' : ''}`}
        className={`flex-1 space-y-2 overflow-y-auto border-t border-slate-100 p-2.5 transition-colors ${isHighlighted ? 'bg-primary/[0.07]' : 'bg-slate-50/70'}`}
        style={{
          maxHeight: '600px',
          minHeight: '245px',
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
              <Motion.div
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
                  onRequestCompletion={onRequestCompletion}
                  onPauseClient={onPauseClient}
                  onResumeClient={onResumeClient}
                  onMoveClient={onMoveClient}
                  statusOptions={statusOptions}
                />
              </Motion.div>
            ))
          ) : (
            <div className={`flex h-32 items-center justify-center rounded-xl border border-dashed text-sm font-medium transition ${isHighlighted ? 'border-primary/40 bg-white/70 text-primary' : 'border-slate-200 text-slate-400'}`}>
              {isDragging ? 'Solte o cliente aqui' : 'Nenhum cliente'}
            </div>
          )}
        </SortableContext>
        {clients.length > 0 && isDragging && <div className={`flex h-14 items-center justify-center rounded-xl border border-dashed text-xs font-bold transition ${isHighlighted ? 'border-primary/50 bg-white text-primary' : 'border-slate-200 text-slate-400'}`}>{isHighlighted ? 'Solte para mover' : 'Arraste para esta etapa'}</div>}
      </div>
    </Motion.div>
  );
}
