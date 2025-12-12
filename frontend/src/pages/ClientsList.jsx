import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import FancySelect from '../components/FancySelect';
import { fetchClients, deleteClient, saveClient } from '../services/api';
import useActivityLog from '../hooks/useActivityLog';
import { FilePenLine, Trash2, PlusCircle, LayoutGrid, List, Building, User, MoreHorizontal, Home, Search, Clock, AlertCircle, AlertTriangle, Calendar, CheckCircle2, FileCheck, GripVertical, Check, X, Archive, RotateCcw, Filter, ChevronDown, Sparkles, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import LoadingAnimation from '../components/LoadingAnimation';
import ClientModal from '../components/ClientModal';
import ConfirmModal from '../components/ConfirmModal';
import { ModernInput } from '../components/ModernInput';
import { DndContext, closestCenter, PointerSensor, MouseSensor, TouchSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Constantes e helpers replicados do main.js
const STATUS_OPTIONS = [
    "Documentação Recebida",
    "Aprovado",
    "Engenharia",
    "Baixando FGTS",
    "Finalização",
    "Aguardando Reserva",
    "Conformidade",
    "Inconforme",
    "Emissão e Assinatura",
    "Assinado",
];
const FINAL_STATUSES = ["Assinado-Movido", "Arquivado"];

const statusConfig = {
    'Documentação Recebida': { style: 'bg-gray-50 text-gray-700 border border-gray-100', icon: FileCheck },
    Aprovado: { style: 'bg-emerald-50 text-emerald-700 border border-emerald-100', icon: CheckCircle2 },
    Engenharia: { style: 'bg-amber-50 text-amber-700 border border-amber-100', icon: Clock },
    'Baixando FGTS': { style: 'bg-yellow-50 text-yellow-700 border border-yellow-100', icon: Clock },
    'Finalização': { style: 'bg-purple-50 text-purple-700 border border-purple-100', icon: FileCheck },
    'Aguardando Reserva': { style: 'bg-cyan-50 text-cyan-700 border border-cyan-100', icon: Calendar },
    Conformidade: { style: 'bg-orange-50 text-orange-700 border border-orange-100', icon: AlertCircle },
    'Inconforme': { style: 'bg-red-50 text-red-700 border border-red-100', icon: AlertTriangle },
    'Emissão e Assinatura': { style: 'bg-blue-50 text-blue-700 border border-blue-100', icon: FileCheck },
    Assinado: { style: 'bg-indigo-50 text-indigo-700 border border-indigo-100', icon: CheckCircle2 },
    default: { style: 'bg-gray-50 text-gray-600 border border-gray-100', icon: CheckCircle2 }
};

const statusDotMap = {
    'Documentação Recebida': 'bg-gray-400',
    Aprovado: 'bg-green-400',
    Engenharia: 'bg-amber-400',
    'Baixando FGTS': 'bg-yellow-400',
    'Finalização': 'bg-purple-400',
    'Aguardando Reserva': 'bg-cyan-400',
    Conformidade: 'bg-orange-400',
    'Inconforme': 'bg-red-400',
    'Emissão e Assinatura': 'bg-blue-400',
    Assinado: 'bg-indigo-400',
};

const statusBorderMap = {
    'Documentação Recebida': 'border-gray-400',
    Aprovado: 'border-green-400',
    Engenharia: 'border-amber-400',
    'Baixando FGTS': 'border-yellow-400',
    'Finalização': 'border-purple-400',
    'Aguardando Reserva': 'border-cyan-400',
    Conformidade: 'border-orange-400',
    'Inconforme': 'border-red-400',
    'Emissão e Assinatura': 'border-blue-400',
    Assinado: 'border-indigo-400',
};

// DroppableArea: área de drop para colunas vazias
const DroppableArea = ({ id }) => {
    const { setNodeRef } = useSortable({ id });
    
    return (
        <div 
            ref={setNodeRef}
            className="text-xs text-gray-400 border-2 border-dashed border-gray-300 rounded-xl sm:rounded-2xl p-6 sm:p-10 text-center bg-gradient-to-br from-gray-50 to-gray-100/50 hover:border-primary/40 hover:bg-primary/10 hover:scale-105 transition-all duration-300 hover:shadow-lg"
        >
            <div className="animate-bounce">Arraste clientes aqui</div>
        </div>
    );
};

// DraggableClientCard: componente draggable para o Kanban
const DraggableClientCard = ({ client, status, onEdit }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: client.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    const borderClass = statusBorderMap[status] || 'border-gray-200';

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`max-w-[300px] bg-white/90 backdrop-blur-sm p-3.5 sm:p-5 rounded-xl sm:rounded-2xl shadow-md border border-gray-100 hover:shadow-xl hover:border-gray-200 hover:scale-[1.02] transition-all duration-300 flex flex-col border-l-4 ${borderClass}`}
        >
            <div className="flex items-start justify-between">
                <div 
                    {...attributes}
                    {...listeners}
                    className="flex items-center gap-2 min-w-0 flex-1 cursor-grab active:cursor-grabbing"
                >
                    <div className="text-gray-400 flex-shrink-0">
                        <GripVertical size={14} className="sm:w-4 sm:h-4" />
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                        <div className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                            {client.nome}
                        </div>
                        <NewBadge creationDate={client.createdAt} />
                    </div>
                </div>
                <button
                    onClick={(e) => { 
                        e.stopPropagation(); 
                        onEdit && onEdit(client); 
                    }}
                    className="p-1 text-gray-400 hover:text-gray-700 flex-shrink-0 cursor-pointer"
                    title="Editar"
                >
                    <MoreHorizontal size={16} />
                </button>
            </div>

            <div className="mt-2.5 sm:mt-3 space-y-1.5 sm:space-y-2 text-xs text-gray-500" onClick={() => onEdit && onEdit(client)}>
                <div className="flex items-center gap-1.5 sm:gap-2">
                    <Home size={12} className="sm:w-3.5 sm:h-3.5 shrink-0" />
                    <span className="truncate">{client.imovel}</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                    <User size={12} className="sm:w-3.5 sm:h-3.5 shrink-0" />
                    <span className="truncate">{client.corretor}</span>
                </div>
            </div>

            <div className="mt-2.5 sm:mt-3 border-t pt-1.5 sm:pt-2 flex justify-end text-xs text-gray-500" onClick={() => onEdit && onEdit(client)}>
                <div>{getDayCounter(client.createdAt).days} dias</div>
            </div>
        </div>
    );
};

// ClientCard: componente de apresentação para cada cliente no Kanban (versão não-draggable, se necessário)
const ClientCard = ({ client, status, onEdit }) => {
    const borderClass = statusBorderMap[status] || 'border-gray-200';

    return (
        <div
            onClick={() => onEdit && onEdit(client)}
            className={`max-w-[300px] bg-white/90 backdrop-blur-sm p-5 rounded-2xl shadow-md border border-gray-100 hover:shadow-xl hover:border-gray-200 hover:scale-[1.02] transition-all duration-300 cursor-pointer flex flex-col border-l-4 ${borderClass}`}
        >
            <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-gray-900 truncate">{client.nome}</div>
                        <NewBadge creationDate={client.createdAt} />
                    </div>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit && onEdit(client); }}
                    className="p-1 text-gray-400 hover:text-gray-700 flex-shrink-0"
                    title="Ações"
                >
                    <MoreHorizontal size={16} />
                </button>
            </div>

            <div className="mt-3 space-y-2 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                    <Home size={14} />
                    <span className="truncate">{client.imovel}</span>
                </div>
                <div className="flex items-center gap-2">
                    <User size={14} />
                    <span className="truncate">{client.corretor}</span>
                </div>
            </div>

            <div className="mt-3 border-t pt-2 flex justify-end text-xs text-gray-500">
                <div>{getDayCounter(client.createdAt).days} dias</div>
            </div>
        </div>
    );
};

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
    if (parts.length === 1) return parts[0].slice(0,2).toUpperCase();
    return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
};

const pickAvatarPalette = (name) => {
    if (!name) return AVATAR_PALETTES[0];
    // deterministic index from name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = (hash << 5) - hash + name.charCodeAt(i);
        hash |= 0;
    }
    return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
};

const formatCPF = (cpf) => {
    if (!cpf) return '';
    let value = cpf.toString().replace(/\D/g, '');
    if (value.length > 11) value = value.substring(0, 11);
    return value
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const getDayCounter = (creationDate) => {
    const today = new Date();
    const created = new Date(creationDate);
    const diffTime = Math.abs(today - created);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    let colorClass = 'bg-red-100 text-red-800';
    if (diffDays < 10) colorClass = 'bg-green-100 text-green-800';
    else if (diffDays < 20) colorClass = 'bg-yellow-100 text-yellow-800';
    else if (diffDays < 30) colorClass = 'bg-orange-100 text-orange-800';

    return {
        days: diffDays,
        color: colorClass
    };
};

// retorna diferença de dias como número inteiro
const getDaysDiff = (creationDate) => {
    const today = new Date();
    const created = new Date(creationDate);
    const diffTime = Math.abs(today - created);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

const formatDate = (isoDate) => {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

// Verifica se o cliente foi criado há menos de 24 horas
const isNewClient = (creationDate) => {
    if (!creationDate) return false;
    const now = new Date();
    const created = new Date(creationDate);
    const diffHours = (now - created) / (1000 * 60 * 60);
    return diffHours < 24;
};

// Badge "Novo" que aparece por 24h
const NewBadge = ({ creationDate }) => {
    if (!isNewClient(creationDate)) return null;
    
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg shadow-red-500/30 animate-pulse">
            <Sparkles size={10} className="animate-spin" />
            NOVO
        </span>
    );
};

// Badge visual para exibir os dias com ícone quando necessário
const DayBadge = ({ creationDate }) => {
    const days = getDaysDiff(creationDate);
    if (isNaN(days)) return null;

    if (days > 30) {
        return (
            <div className="rounded-full px-3.5 py-2 inline-flex items-center gap-2 bg-gradient-to-r from-red-50 to-red-100/50 text-red-600 text-xs font-semibold border border-red-200 shadow-sm animate-fade-in">
                <AlertCircle size={14} className="text-red-600 animate-pulse" />
                <span>{days} dias</span>
            </div>
        );
    }

    // neutro/positivo
    const neutralClass = days < 10 ? 'text-green-700 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 shadow-sm' : 'text-gray-700 bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200';
    return (
        <div className={`rounded-full px-3.5 py-2 inline-flex items-center gap-2 text-xs font-semibold border ${neutralClass} animate-fade-in`}>
            <Clock size={14} className="text-gray-400" />
            <span>{days} dias</span>
        </div>
    );
};

// Componente de Skeleton Loader para a tabela
const SkeletonRow = ({ columns }) => (
    <tr className="bg-white border-b">
        {[...Array(columns)].map((_, i) => (
            <td key={i} className="px-6 py-4">
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
            </td>
        ))}
    </tr>
);

// Sub-componente StatusSelect — versão moderna com popover customizado usando Portal
const StatusSelect = ({ currentStatus, clientId, onChange, disabled = false, loading = false }) => {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0, openUpwards: false });
    const buttonRef = useRef(null);
    const popoverRef = useRef(null);

    const toggle = () => !disabled && setOpen(o => !o);

    const handleSelect = (status) => {
        if (disabled) return;
        if (onChange) onChange(status);
        setOpen(false);
    };

    // Calcula posição do popover
    useEffect(() => {
        if (!open || !buttonRef.current) return;
        
        const updatePosition = () => {
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const popoverHeight = popoverRef.current?.offsetHeight || 280;
            const openUpwards = spaceBelow < popoverHeight && spaceAbove > spaceBelow;
            
            let top = openUpwards ? rect.top - popoverHeight - 8 : rect.bottom + 8;
            // Garante que não sai da tela
            top = Math.max(8, Math.min(top, window.innerHeight - popoverHeight - 8));
            
            setPosition({
                top,
                left: rect.left,
                openUpwards
            });
        };
        
        // Pequeno delay para garantir que o popover foi renderizado
        const timer = setTimeout(updatePosition, 0);
        return () => clearTimeout(timer);
    }, [open]);

    // Fecha ao clicar fora
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (buttonRef.current && !buttonRef.current.contains(e.target) &&
                popoverRef.current && !popoverRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        const keyHandler = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('keydown', keyHandler);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('keydown', keyHandler);
        };
    }, [open]);

    const cfg = statusConfig[currentStatus] || statusConfig.default;
    const Icon = cfg.icon || statusConfig.default.icon;

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={toggle}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                className={`group flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-sm active:scale-[0.97]'} ${cfg.style}`}
            >
                {loading ? (
                    <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                ) : (
                    <Icon size={14} aria-hidden className="shrink-0" />
                )}
                <span>{currentStatus}</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && !disabled && createPortal(
                <div
                    ref={popoverRef}
                    style={{ top: `${position.top}px`, left: `${position.left}px` }}
                    className="fixed z-[9999] w-48 rounded-xl border border-gray-200 bg-white shadow-xl backdrop-blur-sm ring-1 ring-black/5 animate-in fade-in zoom-in"
                >
                    <ul role="listbox" aria-label={`Status do cliente ${clientId}`} className="py-2">
                        {STATUS_OPTIONS.map(opt => {
                            const active = opt === currentStatus;
                            const optCfg = statusConfig[opt] || statusConfig.default;
                            const OptIcon = optCfg.icon || statusConfig.default.icon;
                            return (
                                <li key={opt} role="option" aria-selected={active}>
                                    <button
                                        type="button"
                                        onClick={() => handleSelect(opt)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 mx-1 text-left text-sm font-medium transition rounded-lg ${active ? 'bg-primary/10 text-primary' : 'hover:bg-gray-50 text-gray-700'} focus:outline-none focus:ring-2 focus:ring-primary/30`}
                                    >
                                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${optCfg.style}`}>
                                            <OptIcon size={15} />
                                        </span>
                                        <span className="flex-1 font-semibold">{opt}</span>
                                        {active && <Check size={16} className="text-primary font-bold" />}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>,
                document.body
            )}
        </>
    );
};

// Sub-componente StatusBadge — exibe ícone + texto com estilo do statusConfig
const StatusBadge = ({ status, loading = false }) => {
    const cfg = statusConfig[status] || statusConfig.default;
    const Icon = cfg.icon || statusConfig.default.icon;
    return (
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cfg.style}`} title={status} aria-busy={loading} role="status">
            {loading ? (
                <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
            ) : (
                <Icon size={14} aria-hidden className="shrink-0" />
            )}
            <span>{status}</span>
        </div>
    );
};

const ClientsList = () => {
    const [allClients, setAllClients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [toasts, setToasts] = useState([]);
    const toastTimersRef = useRef({});
    const kanbanScrollRef = useRef(null);
    const scrollPositionRef = useRef(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [activeTab, setActiveTab] = useState('active');
    const [viewMode, setViewMode] = useState('list');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [updatingStatusMap, setUpdatingStatusMap] = useState({});
    const [activeId, setActiveId] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, confirmColor: 'blue' });
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
    const [filters, setFilters] = useState({ agencia: '', responsavel: '', status: '', processo: '', venda: '' });
    const [sortDescriptor, setSortDescriptor] = useState({ column: null, direction: null });
    const { logActivity } = useActivityLog();
    const filterDropdownRef = useRef(null);
    
    const loadClients = async () => {
        setIsLoading(true);
        try {
            const clients = await fetchClients();
            setAllClients(clients);
        } catch (error) {
            console.error("Erro ao buscar clientes:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        return () => {
            // cleanup any pending toast timers
            const timers = toastTimersRef.current || {};
            Object.values(timers).forEach(t => clearTimeout(t));
            toastTimersRef.current = {};
        };
    }, []);

    // Fechar dropdown ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event) => {
            // Verifica se o clique foi fora do botão E fora do dropdown
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
                // Verifica se não clicou em nenhum elemento do dropdown (que está no portal)
                const dropdownElement = document.querySelector('[data-filter-dropdown]');
                if (dropdownElement && !dropdownElement.contains(event.target)) {
                    setIsFilterDropdownOpen(false);
                }
            }
        };
        if (isFilterDropdownOpen) {
            // Pequeno delay para evitar fechar imediatamente após abrir
            setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 100);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isFilterDropdownOpen]);

    const addToast = (message, type = 'info', duration = 3000) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
        const toast = { id, message, type, visible: false };
        setToasts(prev => [...prev, toast]);

        // trigger enter animation on next tick
        requestAnimationFrame(() => {
            setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: true } : t));
        });

        // schedule removal
        toastTimersRef.current[id] = setTimeout(() => {
            // start exit animation
            setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t));
            // remove after animation
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
                delete toastTimersRef.current[id];
            }, 220);
        }, duration);
    };

    const clearAllToasts = () => {
        Object.values(toastTimersRef.current).forEach(t => clearTimeout(t));
        toastTimersRef.current = {};
        setToasts([]);
    };

    useEffect(() => {
        loadClients();
    }, []);

    // Restaurar posição do scroll após re-renderização
    useEffect(() => {
        if (kanbanScrollRef.current && viewMode === 'kanban') {
            kanbanScrollRef.current.scrollLeft = scrollPositionRef.current;
        }
    });

    const handleOpenModal = (client = null) => {
        // Salvar posição do scroll antes de abrir o modal
        if (kanbanScrollRef.current) {
            scrollPositionRef.current = kanbanScrollRef.current.scrollLeft;
        }
        setEditingClient(client);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingClient(null);
    };

    const handleSaveSuccess = () => {
        handleCloseModal();
        loadClients(); // Recarrega os dados para exibir as atualizações
    };

    const handleDelete = async (client) => {
        setConfirmModal({
            isOpen: true,
            title: 'Excluir Cliente',
            message: `Tem certeza que deseja excluir o cliente '${client.nome}'?`,
            confirmColor: 'red',
            onConfirm: async () => {
                try {
                    await deleteClient(client.id);
                    logActivity && logActivity(`Cliente '${client.nome}' excluído.`);
                    addToast(`Cliente ${client.nome} excluído com sucesso`, 'success');
                    loadClients();
                    setConfirmModal({ isOpen: false });
                } catch (error) {
                    console.error("Erro ao excluir cliente:", error);
                    addToast('Erro ao excluir cliente', 'error');
                    setConfirmModal({ isOpen: false });
                }
            }
        });
    };

    // Draft de data de assinatura (evita salvar a cada tecla)
    const [signatureDrafts, setSignatureDrafts] = useState({});

    const handleSignatureDate = async (clientId, dateValue) => {
        try {
            // Converte YYYY-MM-DD para ISO sem problemas de timezone
            let isoDate = null;
            if (dateValue) {
                const [year, month, day] = dateValue.split('-');
                isoDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day))).toISOString();
            }
            await saveClient({ id: clientId, dataAssinaturaContrato: isoDate });
            logActivity && logActivity(`Data de assinatura definida para cliente ${clientId}`);
            addToast('Data de assinatura salva', 'success');
            loadClients();
        } catch (error) {
            console.error("Erro ao salvar data de assinatura:", error);
            addToast('Erro ao salvar data', 'error');
        }
    };

    const handleFinalize = async (client) => {
        if (!client.dataAssinaturaContrato) {
            addToast('Preencha a data de assinatura antes de finalizar', 'error');
            return;
        }

        setConfirmModal({
            isOpen: true,
            title: 'Finalizar Processo',
            message: `Finalizar o processo de ${client.nome}? O cliente será movido para "Assinados".`,
            confirmColor: 'green',
            onConfirm: async () => {
                try {
                    await saveClient({ id: client.id, status: 'Assinado-Movido' });
                    logActivity && logActivity(`Cliente '${client.nome}' finalizado e movido para Assinados`);
                    addToast(`${client.nome} finalizado com sucesso`, 'success');
                    loadClients();
                    setConfirmModal({ isOpen: false });
                } catch (error) {
                    console.error("Erro ao finalizar cliente:", error);
                    addToast('Erro ao finalizar cliente', 'error');
                    setConfirmModal({ isOpen: false });
                }
            }
        });
    };

    const handleArchive = async (client) => {
        setConfirmModal({
            isOpen: true,
            title: 'Arquivar Cliente',
            message: `Arquivar o cliente ${client.nome}?`,
            confirmColor: 'orange',
            onConfirm: async () => {
                try {
                    await saveClient({ id: client.id, status: 'Arquivado' });
                    logActivity && logActivity(`Cliente '${client.nome}' arquivado`);
                    addToast(`${client.nome} arquivado com sucesso`, 'success');
                    loadClients();
                    setConfirmModal({ isOpen: false });
                } catch (error) {
                    console.error("Erro ao arquivar cliente:", error);
                    addToast('Erro ao arquivar cliente', 'error');
                    setConfirmModal({ isOpen: false });
                }
            }
        });
    };

    const handleRestore = async (client) => {
        setConfirmModal({
            isOpen: true,
            title: 'Restaurar Cliente',
            message: `Restaurar ${client.nome} para Processos Ativos?`,
            confirmColor: 'purple',
            onConfirm: async () => {
                try {
                    await saveClient({ id: client.id, status: 'Aprovado' });
                    logActivity && logActivity(`Cliente '${client.nome}' restaurado para Processos Ativos`);
                    addToast(`${client.nome} restaurado com sucesso`, 'success');
                    loadClients();
                    setConfirmModal({ isOpen: false });
                } catch (error) {
                    console.error("Erro ao restaurar cliente:", error);
                    addToast('Erro ao restaurar cliente', 'error');
                    setConfirmModal({ isOpen: false });
                }
            }
        });
    };

    const handleRestoreToSigned = async (client) => {
        setConfirmModal({
            isOpen: true,
            title: 'Restaurar Cliente',
            message: `Restaurar ${client.nome} para Assinados?`,
            confirmColor: 'blue',
            onConfirm: async () => {
                try {
                    await saveClient({ id: client.id, status: 'Assinado-Movido' });
                    logActivity && logActivity(`Cliente '${client.nome}' restaurado para Assinados`);
                    addToast(`${client.nome} restaurado para Assinados`, 'success');
                    loadClients();
                    setConfirmModal({ isOpen: false });
                } catch (error) {
                    console.error("Erro ao restaurar cliente:", error);
                    addToast('Erro ao restaurar cliente', 'error');
                    setConfirmModal({ isOpen: false });
                }
            }
        });
    };

    const handleToggleRemuneracaoPaga = async (clientId, currentValue) => {
        const prevClients = allClients;
        const prevClient = prevClients.find(c => c.id === clientId);
        
        // Atualização otimista
        setAllClients(list => list.map(c => c.id === clientId ? { ...c, remuneracaoPaga: !currentValue } : c));
        
        try {
            await saveClient({ id: clientId, remuneracaoPaga: !currentValue });
            logActivity && logActivity(`Remuneração Paga ${!currentValue ? 'marcada' : 'desmarcada'} para cliente ${clientId}`);
            addToast(`Remuneração Paga ${!currentValue ? 'marcada' : 'desmarcada'}`, 'success');
        } catch (error) {
            console.error('Erro ao atualizar remuneração paga:', error);
            setAllClients(prevClients);
            addToast('Erro ao atualizar remuneração paga', 'error');
        }
    };

    const handleToggleComissaoPaga = async (clientId, currentValue) => {
        const prevClients = allClients;
        const prevClient = prevClients.find(c => c.id === clientId);
        
        // Atualização otimista
        setAllClients(list => list.map(c => c.id === clientId ? { ...c, comissaoPaga: !currentValue } : c));
        
        try {
            await saveClient({ id: clientId, comissaoPaga: !currentValue });
            logActivity && logActivity(`Comissão Paga ${!currentValue ? 'marcada' : 'desmarcada'} para cliente ${clientId}`);
            addToast(`Comissão Paga ${!currentValue ? 'marcada' : 'desmarcada'}`, 'success');
        } catch (error) {
            console.error('Erro ao atualizar comissão paga:', error);
            setAllClients(prevClients);
            addToast('Erro ao atualizar comissão paga', 'error');
        }
    };

    // Obter valores únicos para os filtros
    const uniqueAgencias = useMemo(() => {
        const agencias = allClients.map(c => c.agencia).filter(Boolean);
        return [...new Set(agencias)].sort();
    }, [allClients]);

    const uniqueResponsaveis = useMemo(() => {
        const responsaveis = allClients.map(c => c.responsavel || c.corretor).filter(Boolean);
        return [...new Set(responsaveis)].sort();
    }, [allClients]);

    const handleClearFilters = () => {
        setFilters({ agencia: '', responsavel: '', status: '', processo: '', venda: '' });
    };

    const activeFiltersCount = Object.values(filters).filter(v => v !== '').length;

    const filteredClients = useMemo(() => {
        const search = searchTerm.trim().toLowerCase();
        
        const filtered = allClients.filter(client => {
            // tab filtering
            let tabMatch = true;
            if (activeTab === 'active') {
                // active excludes final statuses
                tabMatch = !FINAL_STATUSES.includes(client.status);
            } else if (activeTab === 'signed') {
                tabMatch = client.status === 'Assinado-Movido';
            } else if (activeTab === 'archived') {
                tabMatch = client.status === 'Arquivado';
            }

            // Filtros avançados
            const agenciaMatch = filters.agencia === '' || client.agencia === filters.agencia;
            const responsavelMatch = filters.responsavel === '' || (client.responsavel === filters.responsavel || client.corretor === filters.responsavel);
            const statusMatch = filters.status === '' || client.status === filters.status;
            const processoMatch = filters.processo === '' || (filters.processo === 'sim' ? client.processo : !client.processo);
            const vendaMatch = filters.venda === '' || (filters.venda === 'sim' ? client.venda : !client.venda);
            
            // Se não há busca, retorna apenas filtros
            if (search === '') {
                return tabMatch && agenciaMatch && responsavelMatch && statusMatch && processoMatch && vendaMatch;
            }
            
            // Busca em nome
            const nomeMatch = client.nome && client.nome.toLowerCase().includes(search);
            
            // Busca em CPF (só faz busca se o termo tiver números)
            const searchNumeros = search.replace(/\D/g, '');
            const cpfMatch = searchNumeros.length > 0 && client.cpf && client.cpf.replace(/\D/g, '').includes(searchNumeros);
            
            // Busca em imóvel
            const imovelMatch = client.imovel && client.imovel.toLowerCase().includes(search);
            
            const textMatch = nomeMatch || cpfMatch || imovelMatch;

            return tabMatch && agenciaMatch && responsavelMatch && statusMatch && processoMatch && vendaMatch && textMatch;
        });

        // Aplicar ordenação se sortDescriptor estiver definido
        if (sortDescriptor.column && sortDescriptor.direction) {
            filtered.sort((a, b) => {
                let first = a[sortDescriptor.column];
                let second = b[sortDescriptor.column];

                // Tratamento especial para campos específicos
                if (sortDescriptor.column === 'status') {
                    // Ordenação por posição na lista STATUS_OPTIONS
                    const firstIndex = STATUS_OPTIONS.indexOf(first);
                    const secondIndex = STATUS_OPTIONS.indexOf(second);
                    first = firstIndex !== -1 ? firstIndex : 999;
                    second = secondIndex !== -1 ? secondIndex : 999;
                } else if (sortDescriptor.column === 'nome' || sortDescriptor.column === 'imovel' || sortDescriptor.column === 'responsavel' || sortDescriptor.column === 'corretor' || sortDescriptor.column === 'agencia') {
                    // Ordenação de strings (case-insensitive)
                    first = (first || '').toString().toLowerCase();
                    second = (second || '').toString().toLowerCase();
                } else if (sortDescriptor.column === 'createdAt' || sortDescriptor.column === 'dataAssinaturaContrato') {
                    // Ordenação de datas
                    first = first ? new Date(first).getTime() : 0;
                    second = second ? new Date(second).getTime() : 0;
                }

                let cmp = first < second ? -1 : first > second ? 1 : 0;

                if (sortDescriptor.direction === 'descending') {
                    cmp *= -1;
                }

                return cmp;
            });
        }

        return filtered;
    }, [allClients, searchTerm, filters, activeTab, sortDescriptor]);

    // Portal do dropdown de filtros calculado fora do JSX para evitar parsing estranho
    const filterDropdownPortal = isFilterDropdownOpen ? createPortal(
        <div
            data-filter-dropdown
            style={{
                position: 'fixed',
                top: (filterDropdownRef.current?.getBoundingClientRect().bottom || 0) + 8,
                right: Math.max(8, window.innerWidth - (filterDropdownRef.current?.getBoundingClientRect().right || 0)),
            }}
            className="w-[calc(100vw-1rem)] sm:w-80 bg-white/95 backdrop-blur-2xl rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200/50 z-[9999] animate-in fade-in slide-in-from-top-2 duration-300 max-h-[80vh] overflow-y-auto"
        >
            <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
                {/* Status */}
                <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Status</label>
                    <div className="relative">
                        <FancySelect
                            value={filters.status}
                            onChange={(val) => setFilters({ ...filters, status: val })}
                            placeholder="Todos os status"
                            options={[{ label: 'Todos os status', value: '' }, ...STATUS_OPTIONS.map(s => ({ label: s, value: s }))]}
                        />
                    </div>
                </div>

                {/* Agência */}
                <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Agência</label>
                    <div className="relative">
                        <FancySelect
                            value={filters.agencia}
                            onChange={(val) => setFilters({ ...filters, agencia: val })}
                            placeholder="Todas as agências"
                            options={[{ label: 'Todas as agências', value: '' }, ...uniqueAgencias.map(a => ({ label: a, value: a }))]}
                        />
                    </div>
                </div>

                {/* Responsável */}
                <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Responsável</label>
                    <div className="relative">
                        <FancySelect
                            value={filters.responsavel}
                            onChange={(val) => setFilters({ ...filters, responsavel: val })}
                            placeholder="Todos os responsáveis"
                            options={[{ label: 'Todos os responsáveis', value: '' }, ...uniqueResponsaveis.map(r => ({ label: r, value: r }))]}
                        />
                    </div>
                </div>

                {/* Checkboxes lado a lado */}
                {/* Divisor */}
                <div className="border-t border-gray-100"></div>

                {/* Checkboxes */}
                <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Tipo</label>
                    <div className="space-y-2">
                        <label className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-xl cursor-pointer transition-all group border border-transparent hover:border-gray-200">
                            <input
                                type="checkbox"
                                checked={filters.processo === 'sim'}
                                onChange={(e) => setFilters({ ...filters, processo: e.target.checked ? 'sim' : '' })}
                                className="w-4 h-4 text-primary bg-white border-gray-300 rounded focus:ring-primary focus:ring-2 cursor-pointer"
                            />
                            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 select-none">Processo</span>
                        </label>
                        
                        <label className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-xl cursor-pointer transition-all group border border-transparent hover:border-gray-200">
                            <input
                                type="checkbox"
                                checked={filters.venda === 'sim'}
                                onChange={(e) => setFilters({ ...filters, venda: e.target.checked ? 'sim' : '' })}
                                className="w-4 h-4 text-primary bg-white border-gray-300 rounded focus:ring-primary focus:ring-2 cursor-pointer"
                            />
                            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 select-none">Venda</span>
                        </label>
                    </div>
                </div>

                {/* Footer com botão de limpar */}
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 rounded-b-2xl flex justify-end">
                    <button
                        onClick={handleClearFilters}
                        disabled={activeFiltersCount === 0}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Limpar Filtros
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    // Atualização rápida de status com UI otimista: atualiza localmente e tenta persistir no backend
    const handleQuickStatusUpdate = async (clientId, newStatus) => {
        // Salvar posição do scroll antes de atualizar o estado
        if (kanbanScrollRef.current) {
            scrollPositionRef.current = kanbanScrollRef.current.scrollLeft;
        }
        const prevClients = allClients;
        const prevClient = prevClients.find(c => c.id === clientId);
        const prevStatus = prevClient ? prevClient.status : null;

        // marca como atualizando (para UX, desabilitar select se necessário)
        setUpdatingStatusMap(m => ({ ...m, [clientId]: true }));

        // atualização otimista no estado local
        setAllClients(list => list.map(c => c.id === clientId ? { ...c, status: newStatus } : c));

        try {
            await saveClient({ id: clientId, status: newStatus });
            logActivity && logActivity(`Status do cliente ${clientId} alterado para ${newStatus}`);
            addToast('Status atualizado com sucesso.', 'success');
        } catch (error) {
            // reverte para o estado anterior em caso de falha
            console.error('Erro ao atualizar status:', error);
            setAllClients(list => list.map(c => c.id === clientId ? { ...c, status: prevStatus } : c));
            addToast('Erro ao atualizar status.', 'error');
        } finally {
            setUpdatingStatusMap(m => {
                const copy = { ...m };
                delete copy[clientId];
                return copy;
            });
        }
    };

    // Configuração dos sensores para drag and drop
    const sensors = useSensors(
        useSensor(MouseSensor),
        useSensor(TouchSensor)
    );

    // Handler quando o arrasto começa
    const handleDragStart = (event) => {
        // Salvar posição do scroll antes do drag
        if (kanbanScrollRef.current) {
            scrollPositionRef.current = kanbanScrollRef.current.scrollLeft;
        }
        setActiveId(event.active.id);
    };

    // Handler quando o arrasto é cancelado
    const handleDragCancel = () => {
        setActiveId(null);
    };

    // Handler para quando um card é solto em uma nova posição
    const handleDragEnd = async (event) => {
        // Salvar posição do scroll antes de atualizar o estado
        if (kanbanScrollRef.current) {
            scrollPositionRef.current = kanbanScrollRef.current.scrollLeft;
        }
        setActiveId(null);
        const { active, over } = event;

        if (!over) return;

        const activeClient = allClients.find(c => c.id === active.id);
        if (!activeClient) return;

        // Determina o novo status baseado no container (coluna) ou no card sobre o qual foi solto
        let newStatus;
        
        // Se over.id começa com 'droppable-', é uma coluna vazia
        if (typeof over.id === 'string' && over.id.startsWith('droppable-')) {
            newStatus = over.id.replace('droppable-', '');
        } else {
            // Se foi solto sobre outro card, usa o status daquele card
            const overClient = allClients.find(c => c.id === over.id);
            if (!overClient) return;
            newStatus = overClient.status;
        }
        
        // Se o status não mudou, não faz nada
        if (activeClient.status === newStatus) return;

        // Atualiza otimisticamente
        const prevStatus = activeClient.status;
        setAllClients(list => list.map(c => c.id === active.id ? { ...c, status: newStatus } : c));

        // Marca como atualizando
        setUpdatingStatusMap(m => ({ ...m, [active.id]: true }));

        try {
            await saveClient({ id: active.id, status: newStatus });
            logActivity && logActivity(`Status do cliente ${active.id} alterado para ${newStatus} via drag and drop`);
            addToast(`Cliente movido para ${newStatus}`, 'success');
        } catch (error) {
            console.error('Erro ao atualizar status via drag:', error);
            setAllClients(list => list.map(c => c.id === active.id ? { ...c, status: prevStatus } : c));
            addToast('Erro ao mover cliente', 'error');
        } finally {
            setUpdatingStatusMap(m => {
                const copy = { ...m };
                delete copy[active.id];
                return copy;
            });
        }
    };

    // KanbanBoard component: agrupa clientes por status e renderiza colunas com scroll horizontal
    const KanbanBoard = ({ clients }) => {
        // Exclui status finais por segurança
        const statuses = STATUS_OPTIONS.filter(s => !FINAL_STATUSES.includes(s));
        
        // Encontra o cliente ativo para o overlay
        const activeClient = activeId ? clients.find(c => c.id === activeId) : null;

        return (
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
            >
                <div ref={kanbanScrollRef} className="overflow-x-auto pb-4">
                    <div className="flex gap-3 sm:gap-6 px-3 sm:px-2">
                        {statuses.map(status => {
                            const items = clients.filter(c => c.status === status);
                            const itemIds = items.map(c => c.id);
                            // Adiciona um ID único para a área droppable vazia
                            const droppableId = `droppable-${status}`;

                            return (
                                <div key={status} className="min-w-[280px] sm:min-w-[320px] flex-shrink-0 bg-gradient-to-b from-gray-50 to-gray-100/30 rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-300">
                                    <div className="flex items-center justify-between mb-4 sm:mb-5">
                                        <h4 className="text-xs sm:text-sm font-bold text-gray-800">
                                            {status}
                                        </h4>
                                        <span className="text-xs font-bold text-gray-600 bg-white/80 backdrop-blur-sm px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full shadow-sm border border-gray-200">{items.length}</span>
                                    </div>

                                    <SortableContext items={items.length > 0 ? itemIds : [droppableId]} strategy={verticalListSortingStrategy}>
                                        <div className="overflow-y-auto max-h-[60vh] space-y-2.5 sm:space-y-3 pr-1 sm:pr-2 min-h-[100px]">
                                            {items.length === 0 ? (
                                                <DroppableArea id={droppableId} />
                                            ) : items.map(client => (
                                                <DraggableClientCard 
                                                    key={client.id} 
                                                    client={client} 
                                                    status={status} 
                                                    onEdit={(c) => handleOpenModal(c)} 
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </div>
                            );
                        })}
                    </div>
                </div>
                
                {/* Overlay que segue o cursor durante o arrasto */}
                <DragOverlay>
                    {activeClient ? (
                        <div className="rotate-3 scale-105">
                            <ClientCard 
                                client={activeClient} 
                                status={activeClient.status} 
                                onEdit={() => {}}
                            />
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        );
    };

    if (isLoading) {
        return <LoadingAnimation fullScreen size="lg" message="Carregando clientes..." />;
    }

    return (
        <div id="active-clients-content" className="fade-in min-h-screen bg-gray-50 sm:p-6 sm:bg-transparent">
            {/* Header fixo tipo app mobile */}
            <div className="sticky top-0 z-40 bg-white sm:bg-transparent sm:relative">
                {/* Navegação em abas estilo app mobile */}
                <div className="bg-white sm:bg-white/80 sm:backdrop-blur-sm shadow-sm sm:rounded-2xl sm:inline-flex sm:p-1.5 sm:gap-1 sm:mb-8 sm:border sm:border-gray-100 w-full sm:w-auto">
                    <div className="flex sm:contents">
                        <button
                            onClick={() => setActiveTab('active')}
                            className={`relative flex-1 sm:flex-initial sm:px-8 py-3 sm:py-3.5 font-semibold text-xs sm:text-sm transition-all duration-300 whitespace-nowrap ${
                                activeTab === 'active' 
                                    ? 'text-primary sm:bg-gradient-to-br sm:from-primary sm:to-primary/90 sm:text-white sm:shadow-lg sm:shadow-primary/25 sm:rounded-xl' 
                                    : 'text-gray-600 hover:text-gray-900 sm:hover:bg-gray-50/80 sm:rounded-xl'
                            }`}
                        >
                            <span className="relative z-10">Ativos</span>
                            {activeTab === 'active' && (
                                <>
                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-primary rounded-t-full sm:hidden"></div>
                                    <div className="hidden sm:block absolute inset-0 bg-white/20 rounded-xl animate-pulse"></div>
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('signed')}
                            className={`relative flex-1 sm:flex-initial sm:px-8 py-3 sm:py-3.5 font-semibold text-xs sm:text-sm transition-all duration-300 whitespace-nowrap ${
                                activeTab === 'signed' 
                                    ? 'text-primary sm:bg-gradient-to-br sm:from-primary sm:to-primary/90 sm:text-white sm:shadow-lg sm:shadow-primary/25 sm:rounded-xl' 
                                    : 'text-gray-600 hover:text-gray-900 sm:hover:bg-gray-50/80 sm:rounded-xl'
                            }`}
                        >
                            <span className="relative z-10">Assinados</span>
                            {activeTab === 'signed' && (
                                <>
                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-primary rounded-t-full sm:hidden"></div>
                                    <div className="hidden sm:block absolute inset-0 bg-white/20 rounded-xl animate-pulse"></div>
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('archived')}
                            className={`relative flex-1 sm:flex-initial sm:px-8 py-3 sm:py-3.5 font-semibold text-xs sm:text-sm transition-all duration-300 whitespace-nowrap ${
                                activeTab === 'archived' 
                                    ? 'text-primary sm:bg-gradient-to-br sm:from-primary sm:to-primary/90 sm:text-white sm:shadow-lg sm:shadow-primary/25 sm:rounded-xl' 
                                    : 'text-gray-600 hover:text-gray-900 sm:hover:bg-gray-50/80 sm:rounded-xl'
                            }`}
                        >
                            <span className="relative z-10">Arquivados</span>
                            {activeTab === 'archived' && (
                                <>
                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-primary rounded-t-full sm:hidden"></div>
                                    <div className="hidden sm:block absolute inset-0 bg-white/20 rounded-xl animate-pulse"></div>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

                {/* Barra de ações estilo app */}
                <div className="bg-white sm:bg-white/80 sm:backdrop-blur-xl p-3 sm:p-6 sm:rounded-3xl shadow-sm sm:shadow-lg sm:shadow-gray-200/50 sm:border sm:border-white mb-3 sm:mb-8 sticky top-[72px] sm:top-0 z-30 sm:relative">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4">
                        <div className="flex-1 w-full sm:w-auto">
                            <ModernInput
                                id="search-client"
                                Icon={Search}
                                type="text"
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-2 justify-between sm:justify-end">
                            {/* Botões de alternância de visualização - apenas na aba de processos ativos */}
                            {activeTab === 'active' && (
                                <div className="flex items-center bg-gradient-to-r from-gray-50 to-gray-100/80 rounded-xl p-1 border border-gray-200 shadow-sm">
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={`p-2 sm:p-3 rounded-lg transition-all duration-300 ${
                                            viewMode === 'list'
                                                ? 'bg-white text-primary shadow-md scale-105'
                                                : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
                                        }`}
                                        title="Visualizar em Lista"
                                    >
                                        <List size={16} className="sm:w-[18px] sm:h-[18px]" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('kanban')}
                                        className={`p-2 sm:p-3 rounded-lg transition-all duration-300 ${
                                            viewMode === 'kanban'
                                                ? 'bg-white text-primary shadow-md scale-105'
                                                : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
                                        }`}
                                        title="Visualizar em Kanban"
                                    >
                                        <LayoutGrid size={16} className="sm:w-[18px] sm:h-[18px]" />
                                    </button>
                                </div>
                            )}
                            
                            {/* Dropdown de Filtros */}
                            <div className="relative" ref={filterDropdownRef}>
                                <button 
                                    onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                                    className={`px-3 sm:px-5 py-2 sm:py-3 border rounded-2xl text-xs sm:text-sm transition-all duration-300 flex items-center gap-1.5 sm:gap-2.5 font-semibold relative shadow-sm hover:shadow-md ${
                                        activeFiltersCount > 0 
                                            ? 'border-primary bg-gradient-to-br from-primary/10 to-primary/5 text-primary hover:from-primary/15 hover:to-primary/10' 
                                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    <Filter size={14} className="sm:w-4 sm:h-4" />
                                    <span className="hidden sm:inline">Filtros</span>
                                    {activeFiltersCount > 0 && (
                                        <span className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-br from-primary to-primary/90 text-white text-[10px] sm:text-xs rounded-full flex items-center justify-center font-bold shadow-lg shadow-primary/30 animate-pulse">
                                            {activeFiltersCount}
                                        </span>
                                    )}
                                    <ChevronDown size={12} className={`sm:w-3.5 sm:h-3.5 transition-transform duration-300 ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {/* Dropdown Panel */}
                                {filterDropdownPortal}
                            </div>
                            <button onClick={() => handleOpenModal()} className="relative py-2 sm:py-3 px-4 sm:px-6 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 text-white rounded-full sm:rounded-2xl text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2.5 font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 transition-all duration-300 overflow-hidden group whitespace-nowrap active:scale-95">
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                                <PlusCircle size={18} className="relative z-10" />
                                <span className="relative z-10">Novo</span>
                            </button>
                        </div>
                    </div>
                </div>

            {(activeTab !== 'active' || viewMode === 'list') ? (
                <>
                {/* Visualização Desktop - Tabela */}
                <div className="hidden lg:block bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-gray-200/50 border border-white overflow-hidden animate-fade-in">
                    <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-left">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <button
                                        onClick={() => setSortDescriptor(prev => ({
                                            column: 'nome',
                                            direction: prev.column === 'nome' && prev.direction === 'ascending' ? 'descending' : 'ascending'
                                        }))}
                                        className="flex items-center gap-2 hover:text-primary transition-colors"
                                    >
                                        Cliente
                                        {sortDescriptor.column === 'nome' ? (
                                            sortDescriptor.direction === 'ascending' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />
                                        ) : (
                                            <ArrowUpDown size={14} className="opacity-40" />
                                        )}
                                    </button>
                                </th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <button
                                        onClick={() => setSortDescriptor(prev => ({
                                            column: 'imovel',
                                            direction: prev.column === 'imovel' && prev.direction === 'ascending' ? 'descending' : 'ascending'
                                        }))}
                                        className="flex items-center gap-2 hover:text-primary transition-colors"
                                    >
                                        Imóvel
                                        {sortDescriptor.column === 'imovel' ? (
                                            sortDescriptor.direction === 'ascending' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />
                                        ) : (
                                            <ArrowUpDown size={14} className="opacity-40" />
                                        )}
                                    </button>
                                </th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <button
                                        onClick={() => setSortDescriptor(prev => ({
                                            column: 'responsavel',
                                            direction: prev.column === 'responsavel' && prev.direction === 'ascending' ? 'descending' : 'ascending'
                                        }))}
                                        className="flex items-center gap-2 hover:text-primary transition-colors"
                                    >
                                        Responsável
                                        {sortDescriptor.column === 'responsavel' ? (
                                            sortDescriptor.direction === 'ascending' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />
                                        ) : (
                                            <ArrowUpDown size={14} className="opacity-40" />
                                        )}
                                    </button>
                                </th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <button
                                        onClick={() => setSortDescriptor(prev => ({
                                            column: 'agencia',
                                            direction: prev.column === 'agencia' && prev.direction === 'ascending' ? 'descending' : 'ascending'
                                        }))}
                                        className="flex items-center gap-2 hover:text-primary transition-colors"
                                    >
                                        Agência
                                        {sortDescriptor.column === 'agencia' ? (
                                            sortDescriptor.direction === 'ascending' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />
                                        ) : (
                                            <ArrowUpDown size={14} className="opacity-40" />
                                        )}
                                    </button>
                                </th>
                                {activeTab === 'active' && (
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        <button
                                            onClick={() => setSortDescriptor(prev => ({
                                                column: 'status',
                                                direction: prev.column === 'status' && prev.direction === 'ascending' ? 'descending' : 'ascending'
                                            }))}
                                            className="flex items-center gap-2 hover:text-primary transition-colors"
                                        >
                                            Status
                                            {sortDescriptor.column === 'status' ? (
                                                sortDescriptor.direction === 'ascending' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />
                                            ) : (
                                                <ArrowUpDown size={14} className="opacity-40" />
                                            )}
                                        </button>
                                    </th>
                                )}
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <button
                                        onClick={() => setSortDescriptor(prev => ({
                                            column: 'dataAssinaturaContrato',
                                            direction: prev.column === 'dataAssinaturaContrato' && prev.direction === 'ascending' ? 'descending' : 'ascending'
                                        }))}
                                        className="flex items-center gap-2 hover:text-primary transition-colors"
                                    >
                                        Assinatura
                                        {sortDescriptor.column === 'dataAssinaturaContrato' ? (
                                            sortDescriptor.direction === 'ascending' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />
                                        ) : (
                                            <ArrowUpDown size={14} className="opacity-40" />
                                        )}
                                    </button>
                                </th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">
                                    <button
                                        onClick={() => setSortDescriptor(prev => ({
                                            column: 'createdAt',
                                            direction: prev.column === 'createdAt' && prev.direction === 'ascending' ? 'descending' : 'ascending'
                                        }))}
                                        className="flex items-center gap-2 hover:text-primary transition-colors mx-auto"
                                    >
                                        Tempo
                                        {sortDescriptor.column === 'createdAt' ? (
                                            sortDescriptor.direction === 'ascending' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />
                                        ) : (
                                            <ArrowUpDown size={14} className="opacity-40" />
                                        )}
                                    </button>
                                </th>
                                {(activeTab === 'signed' || activeTab === 'archived') && (
                                    <>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 tracking-wider text-center">Remuneração Paga</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 tracking-wider text-center">Comissão Paga</th>
                                    </>
                                )}
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 tracking-wider text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredClients.length > 0 ? (
                                filteredClients.map(client => {
                                    const dayCounter = getDayCounter(client.createdAt);
                                    const initials = getInitials(client.nome);
                                    const palette = pickAvatarPalette(client.nome);
                                    const [imovelName, imovelMeta] = client.imovel ? client.imovel.split(' - ', 2) : [client.imovel || '', ''];
                                    return (
                                        <tr key={client.id} className="bg-white border-b border-gray-100 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent transition-all duration-200">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${palette} font-medium`}>{initials}</div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <div className="font-medium text-gray-900 truncate">{client.nome}</div>
                                                            <NewBadge creationDate={client.createdAt} />
                                                        </div>
                                                        <div className="text-xs text-gray-500 truncate">{formatCPF(client.cpf)}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="truncate text-gray-900">{imovelName}</div>
                                                <div className="text-xs text-gray-500">{imovelMeta}</div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-700">{client.responsavel || client.corretor}</td>
                                            <td className="px-6 py-4 text-gray-700">{client.agencia || '-'}</td>
                                            {activeTab === 'active' && (
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center">
                                                        <StatusSelect currentStatus={client.status} clientId={client.id} onChange={(newStatus) => handleQuickStatusUpdate(client.id, newStatus)} disabled={!!updatingStatusMap[client.id]} loading={!!updatingStatusMap[client.id]} />
                                                    </div>
                                                </td>
                                            )}
                                            <td className="px-6 py-4">
                                                {client.status === 'Assinado' ? (
                                                    <input
                                                        type="date"
                                                        value={
                                                            signatureDrafts[client.id] !== undefined
                                                                ? signatureDrafts[client.id]
                                                                : (client.dataAssinaturaContrato
                                                                    ? new Date(client.dataAssinaturaContrato).toISOString().split('T')[0]
                                                                    : '')
                                                        }
                                                        onChange={(e) => {
                                                            const val = e.target.value; // formato AAAA-MM-DD completo ou ''
                                                            setSignatureDrafts(prev => ({ ...prev, [client.id]: val }));
                                                        }}
                                                        onBlur={(e) => {
                                                            const val = e.target.value;
                                                            if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
                                                                // Só salva quando data completa selecionada/digitada
                                                                handleSignatureDate(client.id, val);
                                                                setSignatureDrafts(prev => ({ ...prev, [client.id]: undefined }));
                                                            }
                                                        }}
                                                        className="px-2 py-1 text-sm border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                    />
                                                ) : client.dataAssinaturaContrato ? (
                                                    <div className="inline-flex items-center gap-2 text-sm text-gray-600">
                                                        <Calendar size={14} className="text-gray-400" />
                                                        <span className="text-sm">{formatDate(client.dataAssinaturaContrato)}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <DayBadge creationDate={client.createdAt} />
                                            </td>
                                            {(activeTab === 'signed' || activeTab === 'archived') && (
                                                <>
                                                    <td className="px-6 py-4 text-center">
                                                        <button
                                                            onClick={() => handleToggleRemuneracaoPaga(client.id, client.remuneracaoPaga)}
                                                            className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
                                                                client.remuneracaoPaga ? 'bg-green-500' : 'bg-gray-300'
                                                            }`}
                                                            title={client.remuneracaoPaga ? 'Remuneração Paga' : 'Remuneração Pendente'}
                                                        >
                                                            <span
                                                                className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 ${
                                                                    client.remuneracaoPaga ? 'translate-x-6' : 'translate-x-1'
                                                                }`}
                                                            />
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <button
                                                            onClick={() => handleToggleComissaoPaga(client.id, client.comissaoPaga)}
                                                            disabled={!client.venda}
                                                            className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
                                                                client.venda
                                                                    ? (client.comissaoPaga ? 'bg-green-500' : 'bg-gray-300')
                                                                    : 'bg-gray-200 cursor-not-allowed opacity-50'
                                                            }`}
                                                            title={!client.venda ? 'Disponível apenas para clientes com Venda' : (client.comissaoPaga ? 'Comissão Paga' : 'Comissão Pendente')}
                                                        >
                                                            <span
                                                                className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 ${
                                                                    client.comissaoPaga ? 'translate-x-6' : 'translate-x-1'
                                                                }`}
                                                            />
                                                        </button>
                                                    </td>
                                                </>
                                            )}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => handleOpenModal(client)}
                                                        className="p-2.5 text-primary hover:bg-gradient-to-br hover:from-primary/10 hover:to-primary/5 rounded-xl transition-all duration-300 hover:scale-110 hover:shadow-md"
                                                        title="Editar"
                                                    >
                                                        <FilePenLine size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(client)}
                                                        className="p-2.5 text-red-600 hover:bg-gradient-to-br hover:from-red-50 hover:to-red-100/50 rounded-xl transition-all duration-300 hover:scale-110 hover:shadow-md"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                    {activeTab === 'active' && client.status === 'Assinado' && (
                                                        <button
                                                            onClick={() => handleFinalize(client)}
                                                            disabled={!client.dataAssinaturaContrato}
                                                            className={`p-2 rounded-lg transition-all duration-300 hover:scale-110 ${
                                                                client.dataAssinaturaContrato
                                                                    ? 'text-green-600 hover:bg-green-50'
                                                                    : 'text-gray-300 cursor-not-allowed'
                                                            }`}
                                                            title={client.dataAssinaturaContrato ? 'Finalizar' : 'Preencha a data de assinatura'}
                                                        >
                                                            <Check size={16} />
                                                        </button>
                                                    )}
                                                    {activeTab === 'signed' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleArchive(client)}
                                                                className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-all duration-300 hover:scale-110"
                                                                title="Arquivar"
                                                            >
                                                                <Archive size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleRestore(client)}
                                                                className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-all duration-300 hover:scale-110"
                                                                title="Restaurar para Processos Ativos"
                                                            >
                                                                <RotateCcw size={16} />
                                                            </button>
                                                        </>
                                                    )}
                                                    {activeTab === 'archived' && (
                                                        <button
                                                            onClick={() => handleRestoreToSigned(client)}
                                                            className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-all duration-300 hover:scale-110"
                                                            title="Restaurar para Assinados"
                                                        >
                                                            <RotateCcw size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={activeTab === 'active' ? "8" : "9"} className="text-center p-10 text-gray-500">
                                        Nenhum cliente encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    </div>
                </div>

                {/* Visualização Mobile - Cards estilo app */}
                <div className="lg:hidden px-3 pb-3 space-y-2.5 animate-fade-in">
                    {filteredClients.length > 0 ? (
                        filteredClients.map(client => {
                            const initials = getInitials(client.nome);
                            const palette = pickAvatarPalette(client.nome);
                            const [imovelName, imovelMeta] = client.imovel ? client.imovel.split(' - ', 2) : [client.imovel || '', ''];
                            
                            return (
                                <div key={client.id} className="bg-white rounded-xl shadow-md border border-gray-100/50 overflow-hidden active:scale-[0.98] transition-all duration-200">
                                    {/* Header do Card */}
                                    <div className="p-3 border-b border-gray-100">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className={`w-11 h-11 rounded-full flex items-center justify-center ${palette} font-semibold text-sm shrink-0 shadow-sm`}>
                                                    {initials}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <h3 className="font-semibold text-gray-900 truncate text-sm">{client.nome}</h3>
                                                        <NewBadge creationDate={client.createdAt} />
                                                    </div>
                                                    <p className="text-xs text-gray-500 truncate mt-0.5">{formatCPF(client.cpf)}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-2">
                                            <DayBadge creationDate={client.createdAt} />
                                        </div>
                                    </div>

                                    {/* Corpo do Card */}
                                    <div className="p-3 space-y-2.5">
                                        {/* Imóvel */}
                                        <div className="flex items-start gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                                <Home size={16} className="text-blue-600" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs text-gray-500 mb-0.5">Imóvel</p>
                                                <p className="text-sm font-medium text-gray-900 truncate">{imovelName}</p>
                                                {imovelMeta && <p className="text-xs text-gray-500 mt-0.5">{imovelMeta}</p>}
                                            </div>
                                        </div>

                                        {/* Responsável */}
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                                                <User size={16} className="text-purple-600" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs text-gray-500 mb-0.5">Responsável</p>
                                                <p className="text-sm font-medium text-gray-700 truncate">{client.responsavel || client.corretor}</p>
                                            </div>
                                        </div>

                                        {/* Agência */}
                                        {client.agencia && (
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                                                    <Building size={16} className="text-orange-600" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs text-gray-500 mb-0.5">Agência</p>
                                                    <p className="text-sm font-medium text-gray-700 truncate">{client.agencia}</p>
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === 'active' && (
                                            <div className="pt-2 border-t border-gray-100">
                                                <p className="text-xs text-gray-500 mb-2">Status atual</p>
                                                <StatusSelect 
                                                    currentStatus={client.status} 
                                                    clientId={client.id} 
                                                    onChange={(newStatus) => handleQuickStatusUpdate(client.id, newStatus)} 
                                                    disabled={!!updatingStatusMap[client.id]} 
                                                    loading={!!updatingStatusMap[client.id]} 
                                                />
                                            </div>
                                        )}

                                        {/* Data de Assinatura */}
                                        {(client.status === 'Assinado' || client.dataAssinaturaContrato) && (
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                                                    <Calendar size={16} className="text-green-600" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs text-gray-500 mb-1">Data de Assinatura</p>
                                                    {client.status === 'Assinado' ? (
                                                        <input
                                                            type="date"
                                                            value={
                                                                signatureDrafts[client.id] !== undefined
                                                                    ? signatureDrafts[client.id]
                                                                    : (client.dataAssinaturaContrato
                                                                        ? new Date(client.dataAssinaturaContrato).toISOString().split('T')[0]
                                                                        : '')
                                                            }
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setSignatureDrafts(prev => ({ ...prev, [client.id]: val }));
                                                            }}
                                                            onBlur={(e) => {
                                                                const val = e.target.value;
                                                                if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
                                                                    handleSignatureDate(client.id, val);
                                                                    setSignatureDrafts(prev => ({ ...prev, [client.id]: undefined }));
                                                                }
                                                            }}
                                                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary bg-white"
                                                        />
                                                    ) : (
                                                        <span className="text-sm font-medium text-gray-700">{formatDate(client.dataAssinaturaContrato)}</span>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Toggles de Remuneração e Comissão - apenas nas abas signed e archived */}
                                        {(activeTab === 'signed' || activeTab === 'archived') && (
                                            <div className="pt-2 border-t border-gray-100 space-y-2">
                                                {/* Remuneração Paga */}
                                                <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                        <span className="text-xs font-medium text-gray-700">Remuneração Paga</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleToggleRemuneracaoPaga(client.id, client.remuneracaoPaga)}
                                                        className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary active:scale-95 ${
                                                            client.remuneracaoPaga ? 'bg-green-500' : 'bg-gray-300'
                                                        }`}
                                                        title={client.remuneracaoPaga ? 'Remuneração Paga' : 'Remuneração Pendente'}
                                                    >
                                                        <span
                                                            className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 shadow-sm ${
                                                                client.remuneracaoPaga ? 'translate-x-6' : 'translate-x-1'
                                                            }`}
                                                        />
                                                    </button>
                                                </div>

                                                {/* Comissão Paga */}
                                                <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                        <span className="text-xs font-medium text-gray-700">Comissão Paga</span>
                                                        {!client.venda && <span className="text-[10px] text-gray-400">(Só venda)</span>}
                                                    </div>
                                                    <button
                                                        onClick={() => handleToggleComissaoPaga(client.id, client.comissaoPaga)}
                                                        disabled={!client.venda}
                                                        className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary active:scale-95 ${
                                                            client.venda
                                                                ? (client.comissaoPaga ? 'bg-green-500' : 'bg-gray-300')
                                                                : 'bg-gray-200 cursor-not-allowed opacity-50'
                                                        }`}
                                                        title={!client.venda ? 'Disponível apenas para clientes com Venda' : (client.comissaoPaga ? 'Comissão Paga' : 'Comissão Pendente')}
                                                    >
                                                        <span
                                                            className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 shadow-sm ${
                                                                client.comissaoPaga ? 'translate-x-6' : 'translate-x-1'
                                                            }`}
                                                        />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Footer com ações */}
                                    <div className="bg-gray-50/50 px-3 py-2.5 border-t border-gray-100">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => handleOpenModal(client)}
                                                className="p-2.5 text-primary hover:bg-primary/10 rounded-lg transition-all duration-200 active:scale-95"
                                                title="Editar"
                                            >
                                                <FilePenLine size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(client)}
                                                className="p-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 active:scale-95"
                                                title="Excluir"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                            {activeTab === 'active' && client.status === 'Assinado' && (
                                                <button
                                                    onClick={() => handleFinalize(client)}
                                                    disabled={!client.dataAssinaturaContrato}
                                                    className={`p-2.5 rounded-lg transition-all duration-200 active:scale-95 ${
                                                        client.dataAssinaturaContrato
                                                            ? 'text-green-600 hover:bg-green-50'
                                                            : 'text-gray-300 cursor-not-allowed'
                                                    }`}
                                                    title={client.dataAssinaturaContrato ? 'Finalizar' : 'Preencha a data de assinatura'}
                                                >
                                                    <Check size={18} />
                                                </button>
                                            )}
                                            {activeTab === 'signed' && (
                                                <>
                                                    <button
                                                        onClick={() => handleArchive(client)}
                                                        className="p-2.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-all duration-200 active:scale-95"
                                                        title="Arquivar"
                                                    >
                                                        <Archive size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRestore(client)}
                                                        className="p-2.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-all duration-200 active:scale-95"
                                                        title="Restaurar para Processos Ativos"
                                                    >
                                                        <RotateCcw size={18} />
                                                    </button>
                                                </>
                                            )}
                                            {activeTab === 'archived' && (
                                                <button
                                                    onClick={() => handleRestoreToSigned(client)}
                                                    className="p-2.5 text-primary hover:bg-primary/10 rounded-lg transition-all duration-200 active:scale-95"
                                                    title="Restaurar para Assinados"
                                                >
                                                    <RotateCcw size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-12 text-center">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Search size={24} className="text-gray-400" />
                            </div>
                            <p className="text-gray-500 text-sm">Nenhum cliente encontrado</p>
                            <p className="text-gray-400 text-xs mt-1">Tente ajustar os filtros ou busca</p>
                        </div>
                    )}
                </div>
                </>
            ) : (
                <div className="space-y-4 -mx-3 sm:mx-0">
                    <KanbanBoard clients={filteredClients} />
                </div>
            )}
            <ClientModal 
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveSuccess}
                clientToEdit={editingClient}
                onDelete={handleDelete}
            />

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmColor={confirmModal.confirmColor}
            />
            {/* Toasts empilhados com animação */}
            <div className="fixed right-2 sm:right-4 bottom-2 sm:bottom-4 left-2 sm:left-auto z-50 flex flex-col items-end gap-2" aria-live="polite">
                {toasts.map(t => (
                    <div key={t.id} className={`w-full sm:w-auto transform transition-all duration-200 ${t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                        {t.type === 'success' && (
                            <div className="px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 sm:gap-3 border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm">
                                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                                <div className="text-xs sm:text-sm">{t.message}</div>
                            </div>
                        )}
                        {t.type === 'error' && (
                            <div className="px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 sm:gap-3 border border-red-200 bg-red-50 text-red-700 shadow-sm">
                                <AlertCircle size={16} className="text-red-600 shrink-0" />
                                <div className="text-xs sm:text-sm">{t.message}</div>
                            </div>
                        )}
                        {t.type !== 'success' && t.type !== 'error' && (
                            <div className="px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 sm:gap-3 border border-gray-200 bg-white text-gray-800 shadow-sm">
                                <div className="text-xs sm:text-sm">{t.message}</div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ClientsList;
