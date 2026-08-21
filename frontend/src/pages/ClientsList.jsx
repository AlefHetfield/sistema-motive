import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import FancySelect from '../components/FancySelect';
import { fetchClients, deleteClient, saveClient } from '../services/api';
import useActivityLog from '../hooks/useActivityLog';
import { useAuth } from '../context/AuthContext';
import { FilePenLine, Trash2, PlusCircle, List, Building, User, MoreHorizontal, Home, Search, Clock, AlertCircle, AlertTriangle, Calendar, CheckCircle2, FileCheck, Check, X, Archive, RotateCcw, Filter, ChevronDown, Sparkles, ArrowUpDown, ArrowUp, ArrowDown, LayoutGrid, PauseCircle, PlayCircle } from 'lucide-react';
import KanbanBoard from '../components/KanbanBoard';
import LoadingAnimation from '../components/LoadingAnimation';
import ClientModal from '../components/ClientModal';
import ConfirmModal from '../components/ConfirmModal';
import CompleteProcessModal from '../components/CompleteProcessModal';
import ClientDetailsDrawer from '../components/ClientDetailsDrawer';
import PauseClientModal from '../components/PauseClientModal';
import { ModernInput } from '../components/ModernInput';

// Constantes e helpers replicados do main.js
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
const SIGNED_STATUSES = ["Assinado-Movido", "Assinado"];
const FINAL_STATUSES = [...SIGNED_STATUSES, "Arquivado"];

const statusConfig = {
    'Documentação Recebida': { style: 'bg-gray-50 text-gray-700 border border-gray-100', icon: FileCheck },
    Aprovado: { style: 'bg-emerald-50 text-emerald-700 border border-emerald-100', icon: CheckCircle2 },
    'Solicitando Engenharia': { style: 'bg-amber-50 text-amber-700 border border-amber-100', icon: Clock },
    'Engenharia Solicitada': { style: 'bg-orange-50 text-orange-700 border border-orange-100', icon: AlertCircle },
    'Baixando FGTS': { style: 'bg-yellow-50 text-yellow-700 border border-yellow-100', icon: Clock },
    'Preenchendo Fichas': { style: 'bg-teal-50 text-teal-700 border border-teal-100', icon: FileCheck },
    'Assinando Fichas': { style: 'bg-cyan-50 text-cyan-700 border border-cyan-100', icon: Calendar },
    'Finalizando': { style: 'bg-purple-50 text-purple-700 border border-purple-100', icon: FileCheck },
    'Aguardando Reserva': { style: 'bg-blue-50 text-blue-700 border border-blue-100', icon: Calendar },
    'Enviando para Conformidade': { style: 'bg-pink-50 text-pink-700 border border-pink-100', icon: AlertCircle },
    'Aguardando Conformidade': { style: 'bg-rose-50 text-rose-700 border border-rose-100', icon: AlertCircle },
    'Inconforme': { style: 'bg-red-50 text-red-700 border border-red-100', icon: AlertTriangle },
    'Conforme - Ag. Contrato': { style: 'bg-lime-50 text-lime-700 border border-lime-100', icon: FileCheck },
    'Assinando Contrato': { style: 'bg-indigo-50 text-indigo-700 border border-indigo-100', icon: FileCheck },
    Assinado: { style: 'bg-green-50 text-green-700 border border-green-100', icon: CheckCircle2 },
    'Assinado-Movido': { style: 'bg-emerald-50 text-emerald-700 border border-emerald-100', icon: CheckCircle2 },
    Arquivado: { style: 'bg-gray-100 text-gray-600 border border-gray-200', icon: Archive },
    default: { style: 'bg-gray-50 text-gray-600 border border-gray-100', icon: CheckCircle2 }
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

const formatDate = (isoDate) => {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return '';
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
};

const getWaitResumeLabel = (dateValue) => {
    if (!dateValue) return 'Sem previsão de retomada';
    const date = new Date(dateValue).toISOString().slice(0, 10);
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const today = new Date(now.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
    if (date < today) return `Retomada atrasada · ${formatDate(dateValue)}`;
    if (date === today) return 'Retomar hoje';
    return `Retomar em ${formatDate(dateValue)}`;
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
    const displayStatus = SIGNED_STATUSES.includes(status) ? 'Assinado' : status;
    return (
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cfg.style}`} title={displayStatus} aria-busy={loading} role="status">
            {loading ? (
                <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
            ) : (
                <Icon size={14} aria-hidden className="shrink-0" />
            )}
            <span>{displayStatus}</span>
        </div>
    );
};

const SortableHeader = ({ label, column, sortDescriptor, onSort, align = 'left' }) => {
    const active = sortDescriptor.column === column;
    return (
        <th className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 ${align === 'right' ? 'text-right' : 'text-left'}`}>
            <button
                type="button"
                onClick={() => onSort(column)}
                className={`inline-flex items-center gap-1.5 transition-colors hover:text-primary ${align === 'right' ? 'float-right' : ''}`}
            >
                {label}
                {active ? (
                    sortDescriptor.direction === 'ascending'
                        ? <ArrowUp size={13} className="text-primary" />
                        : <ArrowDown size={13} className="text-primary" />
                ) : <ArrowUpDown size={13} className="opacity-40" />}
            </button>
        </th>
    );
};

const ClientActionsMenu = ({ client, activeTab, onDelete, onRestore, onPause, onResume }) => {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, right: 0 });
    const buttonRef = useRef(null);
    const menuRef = useRef(null);

    const toggleMenu = () => {
        if (!open && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setPosition({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) });
        }
        setOpen(current => !current);
    };

    useEffect(() => {
        if (!open) return;
        const close = (event) => {
            if (!buttonRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
        };
        const closeOnEscape = (event) => event.key === 'Escape' && setOpen(false);
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [open]);

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={toggleMenu}
                className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
                aria-label={`Mais ações para ${client.nome}`}
                aria-haspopup="menu"
                aria-expanded={open}
            >
                <MoreHorizontal size={18} />
            </button>
            {open && createPortal(
                <div
                    ref={menuRef}
                    role="menu"
                    style={{ top: position.top, right: position.right }}
                    className="fixed z-[9999] w-56 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl"
                >
                    {activeTab === 'signed' && (
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => { setOpen(false); onRestore(client); }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                        >
                            <RotateCcw size={16} className="text-purple-600" />
                            Restaurar para ativos
                        </button>
                    )}
                    {activeTab === 'active' && (client.emEspera ? (
                        <button type="button" role="menuitem" onClick={() => { setOpen(false); onResume(client); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50">
                            <PlayCircle size={16} />
                            Retomar atendimento
                        </button>
                    ) : (
                        <button type="button" role="menuitem" onClick={() => { setOpen(false); onPause(client); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-amber-700 hover:bg-amber-50">
                            <PauseCircle size={16} />
                            Colocar em espera
                        </button>
                    ))}
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setOpen(false); onDelete(client); }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                        <Trash2 size={16} />
                        Excluir cliente
                    </button>
                </div>,
                document.body
            )}
        </>
    );
};

const ClientsList = () => {
    const { user } = useAuth();
    const [allClients, setAllClients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [toasts, setToasts] = useState([]);
    const toastTimersRef = useRef({});
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('active');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [updatingStatusMap, setUpdatingStatusMap] = useState({});
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, confirmColor: 'blue' });
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
    const [filters, setFilters] = useState({ agencia: '', responsavel: '', status: '', venda: '', modalidade: '' });
    const [monthYearFilter, setMonthYearFilter] = useState('');
    const [sortDescriptor, setSortDescriptor] = useState({ column: null, direction: null });
    const [viewMode, setViewMode] = useState('table'); // 'table' ou 'kanban'
    const [showAllStats, setShowAllStats] = useState(false);
    const [expandedMobileCards, setExpandedMobileCards] = useState({});
    const [completionClient, setCompletionClient] = useState(null);
    const [detailsClientId, setDetailsClientId] = useState(null);
    const [pauseClient, setPauseClient] = useState(null);
    const [waitingOnly, setWaitingOnly] = useState(false);
    const { logActivity } = useActivityLog();
    const filterDropdownRef = useRef(null);
    
    // Verifica se o usuário é assistente (não vê dados de financiamento)
    const isAssistant = user?.role === 'ASSISTENTE';
    const detailsClient = detailsClientId ? allClients.find(client => client.id === detailsClientId) : null;
    
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

            if (isNewClient) {
                logActivity && logActivity(`Cliente '${savedClient.nome}' adicionado.`);
                addToast(`Cliente ${savedClient.nome} adicionado com sucesso`, 'success');
            } else {
                logActivity && logActivity(`Cliente '${savedClient.nome}' atualizado.`);
                addToast(`Cliente ${savedClient.nome} atualizado com sucesso`, 'success');
            }

            handleCloseModal();
            loadClients(); // Recarrega os dados para exibir as atualizações
        } catch (error) {
            console.error('Erro ao salvar cliente:', error);
            addToast(`Erro ao salvar cliente: ${error.message || 'Tente novamente'}`, 'error');
            throw error;
        }
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

    const handleRequestCompletion = (client) => {
        setCompletionClient(client);
    };

    const handleCompleteProcess = async (client, dateValue) => {
        const [year, month, day] = dateValue.split('-');
        const signatureDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toISOString();

        try {
            await saveClient({ id: client.id, status: 'Assinado-Movido', dataAssinaturaContrato: signatureDate });
            logActivity && logActivity(`Cliente '${client.nome}' concluído e movido para Assinados`);
            addToast(`${client.nome} concluído com sucesso`, 'success');
            setCompletionClient(null);
            await loadClients();
        } catch (error) {
            console.error('Erro ao concluir processo:', error);
            throw new Error('Não foi possível concluir o processo. Tente novamente.');
        }
    };

    const handlePauseClient = async (client, waitData) => {
        const resumeDate = waitData.resumeDate
            ? new Date(`${waitData.resumeDate}T00:00:00.000Z`).toISOString()
            : null;
        try {
            await saveClient({
                id: client.id,
                emEspera: true,
                motivoEspera: waitData.reason,
                observacaoEspera: waitData.note || null,
                dataRetomada: resumeDate,
            });
            logActivity && logActivity(`Cliente '${client.nome}' colocado em espera`);
            addToast(`${client.nome} foi colocado em espera`, 'success');
            setPauseClient(null);
            await loadClients();
        } catch (error) {
            console.error('Erro ao colocar cliente em espera:', error);
            throw new Error('Não foi possível colocar o cliente em espera.');
        }
    };

    const handleResumeClient = (client) => {
        setConfirmModal({
            isOpen: true,
            title: 'Retomar atendimento',
            message: `Retomar o atendimento de ${client.nome} na etapa “${client.status}”?`,
            confirmColor: 'green',
            onConfirm: async () => {
                try {
                    await saveClient({ id: client.id, emEspera: false });
                    logActivity && logActivity(`Atendimento de '${client.nome}' retomado`);
                    addToast(`${client.nome} voltou ao fluxo ativo`, 'success');
                    setConfirmModal({ isOpen: false });
                    await loadClients();
                } catch (error) {
                    console.error('Erro ao retomar cliente:', error);
                    addToast('Não foi possível retomar o atendimento', 'error');
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

    const uniqueModalidades = useMemo(() => {
        const modalidades = allClients.map(c => c.modalidade).filter(Boolean);
        return [...new Set(modalidades)].sort();
    }, [allClients]);

    // Obter meses/anos únicos das datas de assinatura
    const uniqueMonthYears = useMemo(() => {
        const monthYears = allClients
            .filter(c => c.dataAssinaturaContrato)
            .map(c => {
                const date = new Date(c.dataAssinaturaContrato);
                const year = date.getFullYear();
                const month = date.getMonth();
                return { year, month, value: `${year}-${String(month + 1).padStart(2, '0')}` };
            });
        
        // Remover duplicatas
        const unique = [...new Map(monthYears.map(item => [item.value, item])).values()];
        
        // Ordenar por data (mais recente primeiro)
        unique.sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
        });
        
        // Formatar para exibição
        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                           'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        
        return unique.map(item => ({
            value: item.value,
            label: `${monthNames[item.month]} ${item.year}`
        }));
    }, [allClients]);

    const handleClearFilters = () => {
        setFilters({ agencia: '', responsavel: '', status: '', venda: '', modalidade: '' });
        setWaitingOnly(false);
    };

    const activeFiltersCount = Object.values(filters).filter(v => v !== '').length
        + (monthYearFilter && activeTab !== 'active' ? 1 : 0)
        + (waitingOnly && activeTab === 'active' ? 1 : 0);

    const activeFilterChips = useMemo(() => {
        const labels = {
            agencia: 'Agência',
            responsavel: 'Responsável',
            status: 'Status',
            venda: 'Venda',
            modalidade: 'Modalidade',
        };

        const chips = Object.entries(filters)
            .filter(([, value]) => value !== '')
            .map(([key, value]) => ({
                key,
                label: labels[key],
                value: key === 'venda' ? 'Sim' : value,
            }));

        if (monthYearFilter && activeTab !== 'active') {
            const period = uniqueMonthYears.find(item => item.value === monthYearFilter);
            chips.push({ key: 'monthYear', label: 'Período', value: period?.label || monthYearFilter });
        }

        if (waitingOnly && activeTab === 'active') {
            chips.push({ key: 'waiting', label: 'Situação', value: 'Em espera' });
        }

        return chips;
    }, [activeTab, filters, monthYearFilter, uniqueMonthYears, waitingOnly]);

    const handleRemoveFilter = (key) => {
        if (key === 'monthYear') {
            setMonthYearFilter('');
            return;
        }
        if (key === 'waiting') {
            setWaitingOnly(false);
            return;
        }
        setFilters(current => ({ ...current, [key]: '' }));
    };

    const handleSort = (column) => {
        setSortDescriptor(previous => ({
            column,
            direction: previous.column === column && previous.direction === 'ascending' ? 'descending' : 'ascending',
        }));
    };

    const filteredClients = useMemo(() => {
        const search = searchTerm.trim().toLowerCase();
        
        const filtered = allClients.filter(client => {
            // tab filtering
            let tabMatch = true;
            if (activeTab === 'active') {
                // active excludes final statuses
                tabMatch = !FINAL_STATUSES.includes(client.status);
            } else if (activeTab === 'signed') {
                tabMatch = SIGNED_STATUSES.includes(client.status);
            } else if (activeTab === 'archived') {
                tabMatch = client.status === 'Arquivado';
            }

            // Filtros avançados
            const agenciaMatch = filters.agencia === '' || client.agencia === filters.agencia;
            const responsavelMatch = filters.responsavel === '' || (client.responsavel === filters.responsavel || client.corretor === filters.responsavel);
            const statusMatch = filters.status === '' || client.status === filters.status;
            const vendaMatch = filters.venda === '' || (filters.venda === 'sim' ? client.venda : !client.venda);
            const modalidadeMatch = filters.modalidade === '' || client.modalidade === filters.modalidade;
            const waitingMatch = !waitingOnly || client.emEspera;
            
            // Filtro de mês/ano de assinatura (apenas para abas signed e archived)
            let monthYearMatch = true;
            if (monthYearFilter && (activeTab === 'signed' || activeTab === 'archived') && client.dataAssinaturaContrato) {
                const [filterYear, filterMonth] = monthYearFilter.split('-');
                const signatureDate = new Date(client.dataAssinaturaContrato);
                const clientYear = signatureDate.getFullYear().toString();
                const clientMonth = (signatureDate.getMonth() + 1).toString().padStart(2, '0');
                monthYearMatch = clientYear === filterYear && clientMonth === filterMonth;
            } else if (monthYearFilter && (activeTab === 'signed' || activeTab === 'archived')) {
                monthYearMatch = false; // Se filtro ativo mas cliente sem data, não exibir
            }
            
            // Se não há busca, retorna apenas filtros
            if (search === '') {
                return tabMatch && agenciaMatch && responsavelMatch && statusMatch && vendaMatch && modalidadeMatch && waitingMatch && monthYearMatch;
            }
            
            // Busca em nome
            const nomeMatch = client.nome && client.nome.toLowerCase().includes(search);
            
            // Busca em CPF (só faz busca se o termo tiver números)
            const searchNumeros = search.replace(/\D/g, '');
            const cpfMatch = searchNumeros.length > 0 && client.cpf && client.cpf.replace(/\D/g, '').includes(searchNumeros);
            
            // Busca em imóvel
            const imovelMatch = client.imovel && client.imovel.toLowerCase().includes(search);
            
            const textMatch = nomeMatch || cpfMatch || imovelMatch;

            return tabMatch && agenciaMatch && responsavelMatch && statusMatch && vendaMatch && modalidadeMatch && waitingMatch && monthYearMatch && textMatch;
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
                } else if (sortDescriptor.column === 'valorFinanciado') {
                    // Ordenação de valores numéricos
                    first = first ? parseFloat(first) : 0;
                    second = second ? parseFloat(second) : 0;
                }

                let cmp = first < second ? -1 : first > second ? 1 : 0;

                if (sortDescriptor.direction === 'descending') {
                    cmp *= -1;
                }

                return cmp;
            });
        }

        if (activeTab === 'active') {
            filtered.sort((a, b) => Number(Boolean(a.emEspera)) - Number(Boolean(b.emEspera)));
        }

        return filtered;
    }, [allClients, searchTerm, filters, activeTab, sortDescriptor, monthYearFilter, waitingOnly]);

    // Calcular estatísticas financeiras
    const financialStats = useMemo(() => {
        const financiamentoTotal = filteredClients.reduce((sum, client) => {
            const valor = Number(client.valorFinanciado) || 0;
            return sum + valor;
        }, 0);

        const remuneracao = filteredClients.reduce((sum, client) => {
            const valor = Number(client.valorFinanciado) || 0;
            let valorConsiderado = valor;
            
            // Se for FGTS, trava em 200.000
            if (client.modalidade?.toUpperCase() === 'FGTS' && valor > 200000) {
                valorConsiderado = 200000;
            }
            
            // 0,8% do valor considerado
            return sum + (valorConsiderado * 0.008);
        }, 0);

        // Contadores por status
        const total = filteredClients.length;
        const waiting = filteredClients.filter(c => c.emEspera).length;
        const operationalClients = filteredClients.filter(c => !c.emEspera);
        const aprovados = operationalClients.filter(c => c.status === 'Aprovado').length;
        const engenhariaSolicitada = operationalClients.filter(c => c.status === 'Engenharia Solicitada').length;
        const aguardandoReserva = operationalClients.filter(c => c.status === 'Aguardando Reserva').length;
        const aguardandoConformidade = operationalClients.filter(c => c.status === 'Aguardando Conformidade').length;
        const inconformes = operationalClients.filter(c => c.status === 'Inconforme').length;

        return {
            total,
            aprovados,
            engenhariaSolicitada,
            aguardandoReserva,
            aguardandoConformidade,
            inconformes,
            waiting,
            financiamentoTotal,
            remuneracao,
        };
    }, [filteredClients]);

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

                {/* Modalidade */}
                <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Modalidade</label>
                    <div className="relative">
                        <FancySelect
                            value={filters.modalidade}
                            onChange={(val) => setFilters({ ...filters, modalidade: val })}
                            placeholder="Todas as modalidades"
                            options={[{ label: 'Todas as modalidades', value: '' }, ...uniqueModalidades.map(m => ({ label: m, value: m }))]}
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

    if (isLoading) {
        return <LoadingAnimation fullScreen size="lg" message="Carregando clientes..." />;
    }

    return (
        <div id="active-clients-content" className="fade-in min-h-screen bg-gray-50 sm:p-6 sm:bg-transparent">
            <div className="sticky top-0 z-40 border-b border-gray-200 bg-white sm:relative sm:mb-4 sm:rounded-xl sm:border sm:shadow-sm">
                <div className="flex" role="tablist" aria-label="Situação dos clientes">
                    {[
                        { id: 'active', label: 'Ativos' },
                        { id: 'signed', label: 'Assinados' },
                        { id: 'archived', label: 'Arquivados' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            onClick={() => {
                                setActiveTab(tab.id);
                                if (tab.id !== 'active') setWaitingOnly(false);
                            }}
                            className={`relative flex-1 px-4 py-3 text-sm font-semibold transition-colors sm:flex-none sm:px-7 ${
                                activeTab === tab.id
                                    ? 'text-primary'
                                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                            }`}
                        >
                            {tab.label}
                            {activeTab === tab.id && <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-primary" />}
                        </button>
                    ))}
                </div>
            </div>

            <section className="sticky top-[49px] z-30 mb-4 border-b border-gray-200 bg-white p-3 shadow-sm sm:relative sm:top-0 sm:rounded-xl sm:border sm:p-4" aria-label="Ferramentas de clientes">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
                        <div className="min-w-0 flex-1">
                            <ModernInput
                                id="search-client"
                                Icon={Search}
                                type="text"
                                placeholder="Buscar por nome, CPF ou imóvel"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {(activeTab === 'signed' || activeTab === 'archived') && uniqueMonthYears.length > 0 && (
                            <div className="sm:w-52">
                                <FancySelect
                                    value={monthYearFilter}
                                    onChange={(val) => setMonthYearFilter(val)}
                                    placeholder="Todos os períodos"
                                    options={[{ label: 'Todos os períodos', value: '' }, ...uniqueMonthYears]}
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between gap-2 lg:justify-end">
                        {activeTab === 'active' && (
                            <button
                                type="button"
                                aria-pressed={waitingOnly}
                                onClick={() => setWaitingOnly(current => !current)}
                                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${waitingOnly ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
                                title="Mostrar clientes em espera"
                            >
                                <PauseCircle size={16} />
                                <span className="hidden sm:inline">Em espera</span>
                                {financialStats.waiting > 0 && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] leading-none text-amber-800">{financialStats.waiting}</span>}
                            </button>
                        )}
                        <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-1" aria-label="Modo de visualização">
                            <button
                                type="button"
                                aria-pressed={viewMode === 'table'}
                                onClick={() => setViewMode('table')}
                                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${viewMode === 'table' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                            >
                                <List size={16} />
                                <span className="hidden sm:inline">Lista</span>
                            </button>
                            <button
                                type="button"
                                aria-pressed={viewMode === 'kanban'}
                                onClick={() => setViewMode('kanban')}
                                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${viewMode === 'kanban' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                            >
                                <LayoutGrid size={16} />
                                <span className="hidden sm:inline">Kanban</span>
                            </button>
                        </div>

                        <div className="relative" ref={filterDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${activeFiltersCount > 0 ? 'border-primary/40 bg-primary/5 text-primary' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
                            >
                                <Filter size={16} />
                                <span className="hidden sm:inline">Filtros</span>
                                {activeFiltersCount > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] leading-none text-white">{activeFiltersCount}</span>}
                                <ChevronDown size={14} className={`transition-transform ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {filterDropdownPortal}
                        </div>

                        <button
                            type="button"
                            onClick={() => handleOpenModal()}
                            className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                            <PlusCircle size={18} />
                            <span>Novo cliente</span>
                        </button>
                    </div>
                </div>

                {activeFilterChips.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                        <span className="text-xs font-medium text-gray-500">Filtros ativos:</span>
                        {activeFilterChips.map(chip => (
                            <button
                                key={chip.key}
                                type="button"
                                onClick={() => handleRemoveFilter(chip.key)}
                                className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                                title={`Remover filtro ${chip.label}`}
                            >
                                <span>{chip.label}: {chip.value}</span>
                                <X size={12} />
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => { handleClearFilters(); setMonthYearFilter(''); }}
                            className="px-2 py-1 text-xs font-semibold text-gray-500 hover:text-gray-800"
                        >
                            Limpar todos
                        </button>
                    </div>
                )}
            </section>

            {/* Visualização Kanban - Apenas para aba "active" */}
            {viewMode === 'kanban' && activeTab === 'active' && (
                <div className="animate-fade-in">
                    <KanbanBoard 
                        clients={filteredClients}
                        onUpdate={loadClients}
                        onRequestCompletion={handleRequestCompletion}
                        onPauseClient={setPauseClient}
                        onResumeClient={handleResumeClient}
                    />
                </div>
            )}

            {/* Mensagem quando modo Kanban em abas não "active" */}
            {viewMode === 'kanban' && activeTab !== 'active' && (
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-gray-200/50 border border-white p-12 text-center">
                    <LayoutGrid size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-600 font-medium">Modo Kanban está disponível apenas para clientes Ativos</p>
                    <button
                        onClick={() => setActiveTab('active')}
                        className="mt-4 px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
                    >
                        Ver Clientes Ativos
                    </button>
                </div>
            )}

            {viewMode === 'table' && (
                <section className="mx-3 mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:mx-0" aria-label="Resumo dos clientes">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-900">Resumo da seleção</h2>
                            <p className="text-xs text-gray-500">Os valores acompanham a busca e os filtros aplicados.</p>
                        </div>
                        {activeTab === 'active' && (
                            <button
                                type="button"
                                onClick={() => setShowAllStats(current => !current)}
                                className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80"
                                aria-expanded={showAllStats}
                            >
                                {showAllStats ? 'Ocultar detalhes' : 'Ver detalhes'}
                                <ChevronDown size={14} className={`transition-transform ${showAllStats ? 'rotate-180' : ''}`} />
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                            <div className="mb-2 flex items-center gap-2 text-gray-500">
                                <User size={16} />
                                <span className="text-xs font-semibold uppercase tracking-wide">Clientes</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{financialStats.total}</p>
                        </div>

                        {!isAssistant ? (
                            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                                <div className="mb-2 flex items-center gap-2 text-blue-700">
                                    <Building size={16} />
                                    <span className="text-xs font-semibold uppercase tracking-wide">Financiamento</span>
                                </div>
                                <p className="text-xl font-bold text-blue-950">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(financialStats.financiamentoTotal)}
                                </p>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                                <div className="mb-2 flex items-center gap-2 text-emerald-700">
                                    <CheckCircle2 size={16} />
                                    <span className="text-xs font-semibold uppercase tracking-wide">Aprovados</span>
                                </div>
                                <p className="text-2xl font-bold text-emerald-950">{financialStats.aprovados}</p>
                            </div>
                        )}

                        {activeTab === 'active' ? (
                            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                                <div className="mb-2 flex items-center gap-2 text-amber-700">
                                    <AlertTriangle size={16} />
                                    <span className="text-xs font-semibold uppercase tracking-wide">Aguardando ação</span>
                                </div>
                                <p className="text-2xl font-bold text-amber-950">{financialStats.inconformes + financialStats.aguardandoReserva}</p>
                                <p className="mt-1 text-xs text-amber-700">Inconformes ou aguardando reserva</p>
                            </div>
                        ) : !isAssistant ? (
                            <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-4">
                                <div className="mb-2 flex items-center gap-2 text-purple-700">
                                    <CheckCircle2 size={16} />
                                    <span className="text-xs font-semibold uppercase tracking-wide">Remuneração</span>
                                </div>
                                <p className="text-xl font-bold text-purple-950">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(financialStats.remuneracao)}
                                </p>
                            </div>
                        ) : null}
                    </div>

                    {activeTab === 'active' && showAllStats && (
                        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 lg:grid-cols-5">
                            {[
                                { label: 'Aprovados', value: financialStats.aprovados, color: 'text-emerald-700' },
                                { label: 'Engenharia solicitada', value: financialStats.engenhariaSolicitada, color: 'text-orange-700' },
                                { label: 'Aguardando reserva', value: financialStats.aguardandoReserva, color: 'text-blue-700' },
                                { label: 'Inconformes', value: financialStats.inconformes, color: 'text-red-700' },
                                { label: 'Em espera', value: financialStats.waiting, color: 'text-amber-700' },
                            ].map(item => (
                                <div key={item.label} className="rounded-lg border border-gray-100 px-3 py-2.5">
                                    <p className="text-xs text-gray-500">{item.label}</p>
                                    <p className={`mt-1 text-xl font-bold ${item.color}`}>{item.value}</p>
                                </div>
                            ))}
                            {!isAssistant && (
                                <div className="col-span-2 rounded-lg border border-purple-100 bg-purple-50/40 px-3 py-2.5 lg:col-span-5">
                                    <p className="text-xs text-purple-700">Remuneração estimada</p>
                                    <p className="mt-1 text-lg font-bold text-purple-950">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(financialStats.remuneracao)}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </section>
            )}

            {/* Visualização Desktop - Tabela */}
            {viewMode === 'table' && (
                <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:block">
                    <div className="max-h-[calc(100vh-250px)] overflow-auto">
                        <table className="w-full min-w-[1080px] text-left">
                            <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 backdrop-blur">
                                <tr>
                                    <SortableHeader label="Cliente" column="nome" sortDescriptor={sortDescriptor} onSort={handleSort} />
                                    <SortableHeader label="Imóvel" column="imovel" sortDescriptor={sortDescriptor} onSort={handleSort} />
                                    <SortableHeader label="Atendimento" column="responsavel" sortDescriptor={sortDescriptor} onSort={handleSort} />
                                    <SortableHeader label="Status" column="status" sortDescriptor={sortDescriptor} onSort={handleSort} />
                                    {activeTab !== 'active' && <SortableHeader label="Concluído em" column="dataAssinaturaContrato" sortDescriptor={sortDescriptor} onSort={handleSort} />}
                                    {!isAssistant && <SortableHeader label="Financeiro" column="valorFinanciado" sortDescriptor={sortDescriptor} onSort={handleSort} align="right" />}
                                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredClients.length > 0 ? filteredClients.map(client => {
                                    const initials = getInitials(client.nome);
                                    const palette = pickAvatarPalette(client.nome);
                                    const [imovelName, imovelMeta] = client.imovel ? client.imovel.split(' - ', 2) : [client.imovel || '', ''];
                                    return (
                                        <tr key={client.id} className={`group transition-all ${client.emEspera ? 'bg-slate-50/90 opacity-70 hover:opacity-90' : 'bg-white hover:bg-gray-50/80'}`}>
                                            <td className="px-4 py-3">
                                                <div className="flex min-w-[200px] items-center gap-3">
                                                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${palette}`}>{initials}</div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <button type="button" onClick={() => setDetailsClientId(client.id)} className="truncate text-left text-sm font-semibold text-gray-900 hover:text-primary" title="Ver detalhes do cliente">{client.nome}</button>
                                                            <NewBadge creationDate={client.createdAt} />
                                                            {client.emEspera && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800"><PauseCircle size={11} />Em espera</span>}
                                                        </div>
                                                        <span className="text-xs text-gray-500">{formatCPF(client.cpf) || 'CPF não informado'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="max-w-[220px]">
                                                    <p className="truncate text-sm font-medium text-gray-800">{imovelName || 'Imóvel não informado'}</p>
                                                    <p className="truncate text-xs text-gray-500">{[imovelMeta, client.cidade, client.matricula && `Matrícula ${client.matricula}`].filter(Boolean).join(' · ') || 'Sem detalhes'}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="max-w-[180px]">
                                                    <p className="truncate text-sm font-medium text-gray-800">{client.corretor || client.responsavel || 'Não definido'}</p>
                                                    <p className="truncate text-xs text-gray-500">{[client.responsavel && client.responsavel !== client.corretor ? `Responsável: ${client.responsavel}` : null, client.agencia].filter(Boolean).join(' · ') || 'Sem agência'}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {activeTab === 'active' ? (
                                                    <div>
                                                        <StatusSelect currentStatus={client.status} clientId={client.id} onChange={(newStatus) => handleQuickStatusUpdate(client.id, newStatus)} disabled={client.emEspera || !!updatingStatusMap[client.id]} loading={!!updatingStatusMap[client.id]} />
                                                        {client.emEspera && <p className={`mt-1 text-[11px] font-medium ${client.dataRetomada && new Date(client.dataRetomada).toISOString().slice(0, 10) <= new Date().toISOString().slice(0, 10) ? 'text-amber-700' : 'text-gray-500'}`}>{getWaitResumeLabel(client.dataRetomada)}</p>}
                                                    </div>
                                                ) : <StatusBadge status={client.status} />}
                                            </td>
                                            {activeTab !== 'active' && (
                                                <td className="px-4 py-3">
                                                    {client.dataAssinaturaContrato ? (
                                                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-gray-600"><Calendar size={14} />{formatDate(client.dataAssinaturaContrato)}</span>
                                                    ) : <span className="text-xs text-gray-400">Não informada</span>}
                                                </td>
                                            )}
                                            {!isAssistant && (
                                                <td className="px-4 py-3 text-right">
                                                    <p className="whitespace-nowrap text-sm font-semibold text-gray-900">{client.valorFinanciado ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(client.valorFinanciado)) : '—'}</p>
                                                    <p className="text-xs text-gray-500">{[client.modalidade, client.venda ? 'Venda' : null].filter(Boolean).join(' · ') || 'Sem modalidade'}</p>
                                                    {(activeTab === 'signed' || activeTab === 'archived') && (
                                                        <div className="mt-1.5 flex justify-end gap-1.5">
                                                            <button type="button" onClick={() => handleToggleRemuneracaoPaga(client.id, client.remuneracaoPaga)} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${client.remuneracaoPaga ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`} title="Alternar remuneração paga">Rem. {client.remuneracaoPaga ? 'paga' : 'pendente'}</button>
                                                            <button type="button" onClick={() => handleToggleComissaoPaga(client.id, client.comissaoPaga)} disabled={!client.venda} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${!client.venda ? 'cursor-not-allowed bg-gray-50 text-gray-300' : client.comissaoPaga ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`} title="Alternar comissão paga">Com. {client.comissaoPaga ? 'paga' : 'pendente'}</button>
                                                        </div>
                                                    )}
                                                </td>
                                            )}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button type="button" onClick={() => handleOpenModal(client)} className="rounded-lg p-2 text-primary transition-colors hover:bg-primary/10" title="Editar cliente"><FilePenLine size={17} /></button>
                                                    {activeTab === 'active' && !client.emEspera && client.status === 'Assinando Contrato' && (
                                                        <button type="button" onClick={() => handleRequestCompletion(client)} className="rounded-lg p-2 text-emerald-600 transition-colors hover:bg-emerald-50" title="Concluir processo"><CheckCircle2 size={17} /></button>
                                                    )}
                                                    {activeTab === 'signed' && <button type="button" onClick={() => handleArchive(client)} className="rounded-lg p-2 text-orange-600 hover:bg-orange-50" title="Arquivar cliente"><Archive size={17} /></button>}
                                                    {activeTab === 'archived' && <button type="button" onClick={() => handleRestoreToSigned(client)} className="rounded-lg p-2 text-primary hover:bg-primary/10" title="Restaurar para assinados"><RotateCcw size={17} /></button>}
                                                    <ClientActionsMenu client={client} activeTab={activeTab} onDelete={handleDelete} onRestore={handleRestore} onPause={setPauseClient} onResume={handleResumeClient} />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={(isAssistant ? 5 : 6) + (activeTab !== 'active' ? 1 : 0)} className="px-6 py-14 text-center">
                                            <Search size={24} className="mx-auto mb-2 text-gray-300" />
                                            <p className="text-sm font-medium text-gray-600">Nenhum cliente encontrado</p>
                                            <p className="mt-1 text-xs text-gray-400">{searchTerm || activeFilterChips.length ? 'Tente ajustar a busca ou remover filtros.' : 'Não há clientes nesta categoria.'}</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

                {/* Visualização Mobile - Cards estilo app */}
                {viewMode === 'table' && (
                <div className="lg:hidden px-3 pb-3 space-y-2.5 animate-fade-in">
                    {filteredClients.length > 0 ? (
                        filteredClients.map(client => {
                            const initials = getInitials(client.nome);
                            const palette = pickAvatarPalette(client.nome);
                            const [imovelName, imovelMeta] = client.imovel ? client.imovel.split(' - ', 2) : [client.imovel || '', ''];
                            const isExpanded = !!expandedMobileCards[client.id];
                            
                            return (
                                <article key={client.id} className={`overflow-hidden rounded-xl border border-gray-200 shadow-sm transition-opacity ${client.emEspera ? 'bg-slate-50 opacity-70' : 'bg-white'}`}>
                                    {/* Header do Card */}
                                    <div className="p-3 border-b border-gray-100">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className={`w-11 h-11 rounded-full flex items-center justify-center ${palette} font-semibold text-sm shrink-0 shadow-sm`}>
                                                    {initials}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <button type="button" onClick={() => setDetailsClientId(client.id)} className="block max-w-full truncate text-left text-sm font-semibold text-gray-900 hover:text-primary">{client.nome}</button>
                                                        <NewBadge creationDate={client.createdAt} />
                                                        {client.emEspera && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800"><PauseCircle size={11} />Em espera</span>}
                                                    </div>
                                                    <p className="text-xs text-gray-500 truncate mt-0.5">{formatCPF(client.cpf)}</p>
                                                    
                                                    {/* Badges de Contexto */}
                                                    {(client.venda || client.modalidade) && (
                                                        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                                            {client.venda && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200">
                                                                    Venda
                                                                </span>
                                                            )}
                                                            {client.modalidade && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                                                                    {client.modalidade}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {!isAssistant && <div className="mt-2">
                                            {client.valorFinanciado ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 text-green-700 text-xs font-semibold">
                                                    💰 R$ {parseFloat(client.valorFinanciado).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 text-xs">
                                                    Sem valor financiado
                                                </span>
                                            )}
                                        </div>}
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

                                        {/* Detalhes de atendimento */}
                                        {isExpanded && (client.agencia || client.cidade || client.matricula) && (
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                                                    <Building size={16} className="text-orange-600" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs text-gray-500 mb-0.5">Local e cadastro</p>
                                                    <p className="text-sm font-medium text-gray-700 truncate">{[client.agencia, client.cidade].filter(Boolean).join(' · ')}</p>
                                                    {client.matricula && <p className="mt-0.5 text-xs text-gray-500">Matrícula {client.matricula}</p>}
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === 'active' ? (
                                            <div className="pt-2 border-t border-gray-100">
                                                <p className="text-xs text-gray-500 mb-2">Status atual</p>
                                                <StatusSelect 
                                                    currentStatus={client.status} 
                                                    clientId={client.id} 
                                                    onChange={(newStatus) => handleQuickStatusUpdate(client.id, newStatus)} 
                                                    disabled={client.emEspera || !!updatingStatusMap[client.id]}
                                                    loading={!!updatingStatusMap[client.id]} 
                                                />
                                                {client.emEspera && <p className="mt-2 text-xs font-medium text-amber-700">{getWaitResumeLabel(client.dataRetomada)}</p>}
                                            </div>
                                        ) : (
                                            <div className="border-t border-gray-100 pt-2">
                                                <StatusBadge status={client.status} />
                                            </div>
                                        )}

                                        {/* Data de conclusão, somente leitura */}
                                        {isExpanded && activeTab !== 'active' && (
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                                                    <Calendar size={16} className="text-green-600" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs text-gray-500 mb-1">Concluído em</p>
                                                    <span className={`text-sm font-medium ${client.dataAssinaturaContrato ? 'text-gray-700' : 'text-gray-400'}`}>
                                                        {client.dataAssinaturaContrato ? formatDate(client.dataAssinaturaContrato) : 'Data não informada'}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Toggles de Remuneração e Comissão - apenas nas abas signed e archived */}
                                        {isExpanded && !isAssistant && (activeTab === 'signed' || activeTab === 'archived') && (
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

                                        <button
                                            type="button"
                                            onClick={() => setExpandedMobileCards(previous => ({ ...previous, [client.id]: !isExpanded }))}
                                            className="flex w-full items-center justify-center gap-1 border-t border-gray-100 pt-2 text-xs font-semibold text-primary"
                                            aria-expanded={isExpanded}
                                        >
                                            {isExpanded ? 'Ocultar detalhes' : 'Ver detalhes'}
                                            <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                        </button>
                                    </div>

                                    {/* Footer com ações */}
                                    <div className="border-t border-gray-100 bg-gray-50/70 px-3 py-2.5">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button type="button" onClick={() => handleOpenModal(client)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10">
                                                <FilePenLine size={17} />
                                                Editar
                                            </button>
                                            {activeTab === 'active' && !client.emEspera && client.status === 'Assinando Contrato' && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRequestCompletion(client)}
                                                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-green-600 hover:bg-green-50"
                                                    title="Concluir processo"
                                                >
                                                    <CheckCircle2 size={17} />
                                                    Concluir
                                                </button>
                                            )}
                                            {activeTab === 'signed' && (
                                                <button type="button" onClick={() => handleArchive(client)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-orange-600 hover:bg-orange-50">
                                                    <Archive size={17} />
                                                    Arquivar
                                                </button>
                                            )}
                                            {activeTab === 'archived' && (
                                                <button type="button" onClick={() => handleRestoreToSigned(client)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10">
                                                    <RotateCcw size={17} />
                                                    Restaurar
                                                </button>
                                            )}
                                            <ClientActionsMenu client={client} activeTab={activeTab} onDelete={handleDelete} onRestore={handleRestore} onPause={setPauseClient} onResume={handleResumeClient} />
                                        </div>
                                    </div>
                                </article>
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
                )}

            <ClientModal 
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveClient}
                clientToEdit={editingClient}
                onDelete={handleDelete}
            />

            {detailsClient && (
                <ClientDetailsDrawer
                    key={detailsClient.id}
                    client={detailsClient}
                    activeTab={activeTab}
                    isAssistant={isAssistant}
                    onClose={() => setDetailsClientId(null)}
                    onEdit={(client) => {
                        setDetailsClientId(null);
                        handleOpenModal(client);
                    }}
                    onComplete={(client) => {
                        setDetailsClientId(null);
                        handleRequestCompletion(client);
                    }}
                    onArchive={(client) => {
                        setDetailsClientId(null);
                        handleArchive(client);
                    }}
                    onRestore={(client) => {
                        setDetailsClientId(null);
                        if (activeTab === 'archived') handleRestoreToSigned(client);
                        else handleRestore(client);
                    }}
                    onDelete={(client) => {
                        setDetailsClientId(null);
                        handleDelete(client);
                    }}
                    onPause={(client) => {
                        setDetailsClientId(null);
                        setPauseClient(client);
                    }}
                    onResume={(client) => {
                        setDetailsClientId(null);
                        handleResumeClient(client);
                    }}
                />
            )}

            {pauseClient && (
                <PauseClientModal
                    key={pauseClient.id}
                    client={pauseClient}
                    onClose={() => setPauseClient(null)}
                    onConfirm={handlePauseClient}
                />
            )}

            {completionClient && (
                <CompleteProcessModal
                    key={completionClient.id}
                    client={completionClient}
                    onClose={() => setCompletionClient(null)}
                    onConfirm={handleCompleteProcess}
                />
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
