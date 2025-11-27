import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { fetchClients, deleteClient, saveClient } from '../services/api';
import useActivityLog from '../hooks/useActivityLog';
import { FilePenLine, Trash2, PlusCircle, LayoutGrid, List, Building, User, MoreHorizontal, Home, Search, Clock, AlertCircle, Calendar, CheckCircle2, FileCheck, GripVertical, Check, X, Archive, RotateCcw, Filter, ChevronDown, Sparkles } from 'lucide-react';
import ClientModal from '../components/ClientModal';
import ConfirmModal from '../components/ConfirmModal';
import { ModernInput } from '../components/ModernInput';
import { DndContext, closestCenter, PointerSensor, MouseSensor, TouchSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Constantes e helpers replicados do main.js
const STATUS_OPTIONS = ["Aprovado", "Engenharia", "Finalização", "Conformidade", "Assinado"];
const FINAL_STATUSES = ["Assinado-Movido", "Arquivado"];

const statusConfig = {
    Aprovado: { style: 'bg-emerald-50 text-emerald-700 border border-emerald-100', icon: CheckCircle2 },
    Assinado: { style: 'bg-blue-50 text-blue-700 border border-blue-100', icon: CheckCircle2 },
    Engenharia: { style: 'bg-amber-50 text-amber-700 border border-amber-100', icon: Clock },
    'Finalização': { style: 'bg-purple-50 text-purple-700 border border-purple-100', icon: FileCheck },
    Conformidade: { style: 'bg-orange-50 text-orange-700 border border-orange-100', icon: AlertCircle },
    default: { style: 'bg-gray-50 text-gray-600 border border-gray-100', icon: CheckCircle2 }
};

const statusDotMap = {
    Aprovado: 'bg-green-400',
    Engenharia: 'bg-yellow-400',
    'Finalização': 'bg-indigo-400',
    Conformidade: 'bg-orange-400',
    Assinado: 'bg-sky-400',
};

const statusBorderMap = {
    Aprovado: 'border-green-400',
    Engenharia: 'border-yellow-400',
    'Finalização': 'border-indigo-400',
    Conformidade: 'border-orange-400',
    Assinado: 'border-sky-400',
};

// DroppableArea: área de drop para colunas vazias
const DroppableArea = ({ id }) => {
    const { setNodeRef } = useSortable({ id });
    
    return (
        <div 
            ref={setNodeRef}
            className="text-xs text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center bg-gray-50/50 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300"
        >
            Arraste clientes aqui
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
            className={`bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-gray-200 transition-all duration-300 flex flex-col border-l-4 ${borderClass}`}
        >
            <div className="flex items-start justify-between">
                <div 
                    {...attributes}
                    {...listeners}
                    className="flex items-center gap-2 min-w-0 flex-1 cursor-grab active:cursor-grabbing"
                >
                    <div className="text-gray-400 flex-shrink-0">
                        <GripVertical size={16} />
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">
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

            <div className="mt-3 space-y-2 text-xs text-gray-500" onClick={() => onEdit && onEdit(client)}>
                <div className="flex items-center gap-2">
                    <Home size={14} />
                    <span className="truncate">{client.imovel}</span>
                </div>
                <div className="flex items-center gap-2">
                    <User size={14} />
                    <span className="truncate">{client.corretor}</span>
                </div>
            </div>

            <div className="mt-3 border-t pt-2 flex justify-end text-xs text-gray-500" onClick={() => onEdit && onEdit(client)}>
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
            className={`bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-gray-200 transition-all duration-300 cursor-pointer flex flex-col border-l-4 ${borderClass}`}
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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500 text-white shadow-sm animate-pulse">
            <Sparkles size={10} />
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
            <div className="rounded-full px-3 py-1.5 inline-flex items-center gap-2 bg-red-50 text-red-600 text-xs font-medium border border-red-100 animate-fade-in">
                <AlertCircle size={14} className="text-red-600" />
                <span>{days} dias</span>
            </div>
        );
    }

    // neutro/positivo
    const neutralClass = days < 10 ? 'text-green-700 bg-green-50 border-green-100' : 'text-gray-700 bg-gray-50 border-gray-100';
    return (
        <div className={`rounded-full px-3 py-1.5 inline-flex items-center gap-2 text-xs font-medium border ${neutralClass} animate-fade-in`}>
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
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [activeTab, setActiveTab] = useState('active');
    const [viewMode, setViewMode] = useState('list');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [updatingStatusMap, setUpdatingStatusMap] = useState({});
    const [activeId, setActiveId] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, confirmColor: 'blue' });
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [filters, setFilters] = useState({ agencia: '', responsavel: '', status: '' });
    const { logActivity } = useActivityLog();
    
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

    const handleOpenModal = (client = null) => {
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
        setFilters({ agencia: '', responsavel: '', status: '' });
        setIsFilterModalOpen(false);
    };

    const handleApplyFilters = () => {
        setIsFilterModalOpen(false);
    };

    const activeFiltersCount = Object.values(filters).filter(v => v !== '').length;

    const filteredClients = useMemo(() => {
        const search = searchTerm.trim().toLowerCase();
        
        return allClients.filter(client => {
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
            
            // Se não há busca, retorna apenas filtros
            if (search === '') {
                return tabMatch && agenciaMatch && responsavelMatch && statusMatch;
            }
            
            // Busca em nome
            const nomeMatch = client.nome && client.nome.toLowerCase().includes(search);
            
            // Busca em CPF (só faz busca se o termo tiver números)
            const searchNumeros = search.replace(/\D/g, '');
            const cpfMatch = searchNumeros.length > 0 && client.cpf && client.cpf.replace(/\D/g, '').includes(searchNumeros);
            
            // Busca em imóvel
            const imovelMatch = client.imovel && client.imovel.toLowerCase().includes(search);
            
            const textMatch = nomeMatch || cpfMatch || imovelMatch;

            return tabMatch && agenciaMatch && responsavelMatch && statusMatch && textMatch;
        });
    }, [allClients, searchTerm, filters, activeTab]);

    // Atualização rápida de status com UI otimista: atualiza localmente e tenta persistir no backend
    const handleQuickStatusUpdate = async (clientId, newStatus) => {
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
        setActiveId(event.active.id);
    };

    // Handler quando o arrasto é cancelado
    const handleDragCancel = () => {
        setActiveId(null);
    };

    // Handler para quando um card é solto em uma nova posição
    const handleDragEnd = async (event) => {
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
                <div className="overflow-x-auto">
                    <div className="flex gap-6 px-2">
                        {statuses.map(status => {
                            const items = clients.filter(c => c.status === status);
                            const itemIds = items.map(c => c.id);
                            // Adiciona um ID único para a área droppable vazia
                            const droppableId = `droppable-${status}`;

                            return (
                                <div key={status} className="min-w-[300px] flex-shrink-0 bg-gray-50/80 rounded-2xl p-4 border border-gray-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-sm font-semibold text-gray-800">
                                            {status}
                                        </h4>
                                        <span className="text-xs font-medium text-gray-500 bg-white px-2.5 py-1 rounded-full">{items.length}</span>
                                    </div>

                                    <SortableContext items={items.length > 0 ? itemIds : [droppableId]} strategy={verticalListSortingStrategy}>
                                        <div className="overflow-y-auto max-h-[60vh] space-y-3 pr-2 min-h-[100px]">
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

    return (
        <div id="active-clients-content" className="fade-in p-6">
            <div className="mb-8">
                <div className="mb-6">
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">Gerenciamento de Clientes</h2>
                    <p className="text-gray-500">Visualize e gerencie o progresso dos financiamentos em tempo real</p>
                </div>

                <div className="bg-gray-50 p-1 rounded-2xl inline-flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`px-6 py-3 rounded-xl font-medium text-sm transition-all duration-300 ${activeTab === 'active' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                    >
                        Processos Ativos
                    </button>
                    <button
                        onClick={() => setActiveTab('signed')}
                        className={`px-6 py-3 rounded-xl font-medium text-sm transition-all duration-300 ${activeTab === 'signed' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                    >
                        Assinados
                    </button>
                    <button
                        onClick={() => setActiveTab('archived')}
                        className={`px-6 py-3 rounded-xl font-medium text-sm transition-all duration-300 ${activeTab === 'archived' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                    >
                        Arquivados
                    </button>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6 animate-fade-in">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                            <ModernInput
                                id="search-client"
                                Icon={Search}
                                type="text"
                                placeholder="Buscar por nome, CPF ou imóvel..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Botões de alternância de visualização - apenas na aba de processos ativos */}
                            {activeTab === 'active' && (
                                <div className="flex items-center bg-gray-50 rounded-xl p-1 border border-gray-200">
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={`p-2.5 rounded-lg transition-all duration-300 ${
                                            viewMode === 'list'
                                                ? 'bg-white text-primary shadow-sm'
                                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                        }`}
                                        title="Visualizar em Lista"
                                    >
                                        <List size={18} />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('kanban')}
                                        className={`p-2.5 rounded-lg transition-all duration-300 ${
                                            viewMode === 'kanban'
                                                ? 'bg-white text-primary shadow-sm'
                                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                        }`}
                                        title="Visualizar em Kanban"
                                    >
                                        <LayoutGrid size={18} />
                                    </button>
                                </div>
                            )}
                            
                            <button 
                                onClick={() => setIsFilterModalOpen(true)}
                                className={`px-4 py-2.5 border rounded-2xl text-sm transition-all duration-300 flex items-center gap-2 font-medium relative ${
                                    activeFiltersCount > 0 
                                        ? 'border-primary bg-primary/5 text-primary hover:bg-primary/10' 
                                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                <Filter size={16} />
                                Filtros
                                {activeFiltersCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-xs rounded-full flex items-center justify-center font-semibold">
                                        {activeFiltersCount}
                                    </span>
                                )}
                            </button>
                            <button onClick={() => handleOpenModal()} className="py-2.5 px-5 bg-primary hover:bg-primary/90 text-white rounded-2xl text-sm flex items-center gap-2 font-medium shadow-sm hover:shadow-md transition-all duration-300">
                                <PlusCircle size={16} />
                                Novo Cliente
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {(activeTab !== 'active' || viewMode === 'list') ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 animate-fade-in">
                    <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-left">
                        <thead className="bg-gray-50/80 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Imóvel</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Responsável</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Agência</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Assinatura</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Tempo</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                [...Array(5)].map((_, i) => <SkeletonRow key={i} columns={8} />)
                            ) : filteredClients.length > 0 ? (
                                filteredClients.map(client => {
                                    const dayCounter = getDayCounter(client.createdAt);
                                    const initials = getInitials(client.nome);
                                    const palette = pickAvatarPalette(client.nome);
                                    const [imovelName, imovelMeta] = client.imovel ? client.imovel.split(' - ', 2) : [client.imovel || '', ''];
                                    return (
                                        <tr key={client.id} className="bg-white border-b hover:bg-gray-50">
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
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <StatusSelect currentStatus={client.status} clientId={client.id} onChange={(newStatus) => handleQuickStatusUpdate(client.id, newStatus)} disabled={!!updatingStatusMap[client.id]} loading={!!updatingStatusMap[client.id]} />
                                                </div>
                                            </td>
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
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => handleOpenModal(client)}
                                                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-all duration-300 hover:scale-110"
                                                        title="Editar"
                                                    >
                                                        <FilePenLine size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(client)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-300 hover:scale-110"
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
                                    <td colSpan="8" className="text-center p-10 text-gray-500">
                                        Nenhum cliente encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <KanbanBoard clients={filteredClients} />
                    )}
                </div>
            )}
            <ClientModal 
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveSuccess}
                clientToEdit={editingClient}
            />
            {/* Modal de Filtros */}
            {isFilterModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div 
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setIsFilterModalOpen(false)}
                    />
                    
                    <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Filter size={20} className="text-primary" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">Filtros Avançados</h3>
                            </div>
                            <button
                                onClick={() => setIsFilterModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Filtro por Status */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                                <select
                                    value={filters.status}
                                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                >
                                    <option value="">Todos os status</option>
                                    {STATUS_OPTIONS.map(status => (
                                        <option key={status} value={status}>{status}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Filtro por Agência */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Agência</label>
                                <select
                                    value={filters.agencia}
                                    onChange={(e) => setFilters({ ...filters, agencia: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                >
                                    <option value="">Todas as agências</option>
                                    {uniqueAgencias.map(agencia => (
                                        <option key={agencia} value={agencia}>{agencia}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Filtro por Responsável */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Responsável</label>
                                <select
                                    value={filters.responsavel}
                                    onChange={(e) => setFilters({ ...filters, responsavel: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                >
                                    <option value="">Todos os responsáveis</option>
                                    {uniqueResponsaveis.map(resp => (
                                        <option key={resp} value={resp}>{resp}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                            <button
                                onClick={handleClearFilters}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                            >
                                Limpar Filtros
                            </button>
                            <button
                                onClick={handleApplyFilters}
                                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors font-medium"
                            >
                                Aplicar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmColor={confirmModal.confirmColor}
            />
            {/* Toasts empilhados com animação */}
            <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2" aria-live="polite">
                {toasts.map(t => (
                    <div key={t.id} className={`transform transition-all duration-200 ${t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                        {t.type === 'success' && (
                            <div className="px-4 py-2 rounded-lg flex items-center gap-3 border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm">
                                <CheckCircle2 size={16} className="text-emerald-600" />
                                <div className="text-sm">{t.message}</div>
                            </div>
                        )}
                        {t.type === 'error' && (
                            <div className="px-4 py-2 rounded-lg flex items-center gap-3 border border-red-200 bg-red-50 text-red-700 shadow-sm">
                                <AlertCircle size={16} className="text-red-600" />
                                <div className="text-sm">{t.message}</div>
                            </div>
                        )}
                        {t.type !== 'success' && t.type !== 'error' && (
                            <div className="px-4 py-2 rounded-lg flex items-center gap-3 border border-gray-200 bg-white text-gray-800 shadow-sm">
                                <div className="text-sm">{t.message}</div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ClientsList;
