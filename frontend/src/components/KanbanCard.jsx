import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { Edit, Trash2, User, Home } from 'lucide-react';
import { useState } from 'react';

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
}) {
  const [isHovered, setIsHovered] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: client.id, data: { status } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        p-3 rounded-lg border-2 border-gray-200 bg-white
        cursor-grab active:cursor-grabbing
        transition-all duration-150
        ${isSortableDragging ? 'shadow-xl scale-105 border-blue-400 bg-blue-50 z-50' : 'hover:shadow-md hover:border-gray-300'}
        ${isDragging ? 'opacity-50' : ''}
      `}
    >
      {/* Nome do cliente */}
      <div className="flex items-start gap-2 mb-2">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${getAvatarStyle(client.nome)}`}>
          {getInitials(client.nome)}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 text-sm truncate">
            {client.nome}
          </h4>
        </div>
      </div>

      {/* Informações secundárias */}
      <div className="space-y-1 mb-3 text-xs text-gray-600">
        {client.cpf && (
          <div className="truncate">
            CPF: <span className="font-mono">{client.cpf}</span>
          </div>
        )}
        {client.telefone && (
          <div className="truncate">
            📱 {client.telefone}
          </div>
        )}
      </div>

      {/* Propriedade */}
      {client.nomePropriedade && (
        <div className="mb-3 p-2 bg-gray-50 rounded border border-gray-200">
          <div className="flex items-center gap-1.5 text-xs">
            <Home className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <span className="truncate text-gray-700 font-medium">
              {client.nomePropriedade}
            </span>
          </div>
        </div>
      )}

      {/* Responsável */}
      {client.responsavel && (
        <div className="mb-3 flex items-center gap-1.5 text-xs text-gray-600">
          <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="truncate">{client.responsavel}</span>
        </div>
      )}

      {/* Flags */}
      {(client.isVenda || client.isRemuneracao) && (
        <div className="mb-3 flex flex-wrap gap-1">
          {client.isVenda && (
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded font-semibold">
              🏠 Venda
            </span>
          )}
          {client.isRemuneracao && (
            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded font-semibold">
              💰 Remuneração
            </span>
          )}
        </div>
      )}

      {/* Ações - Aparecem ao hover */}
      {isHovered && (
        <motion.div
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -2 }}
          className="flex gap-2 pt-2 border-t border-gray-200"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditClient && onEditClient(client);
            }}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-xs font-medium transition-colors"
          >
            <Edit className="w-3.5 h-3.5" />
            Editar
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteClient && onDeleteClient(client);
            }}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded text-xs font-medium transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Deletar
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
