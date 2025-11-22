import { useState, useEffect, useMemo } from 'react';
import { fetchClients, deleteClient, saveClient } from '../services/api';
import useActivityLog from '../hooks/useActivityLog';
import { FilePenLine, Trash2, PlusCircle, LayoutGrid, List, Building, User, MoreHorizontal, Home, Search, Clock, AlertCircle, Calendar } from 'lucide-react';
import ClientModal from '../components/ClientModal';

// Constantes e helpers replicados do main.js
const STATUS_OPTIONS = ["Aprovado", "Engenharia", "Finalização", "Conformidade", "Assinado"];
const FINAL_STATUSES = ["Assinado-Movido", "Arquivado"];

const statusBadgeMap = {
    Aprovado: 'bg-green-100 text-green-700',
    Engenharia: 'bg-yellow-100 text-yellow-800',
    'Finalização': 'bg-indigo-100 text-indigo-700',
    Conformidade: 'bg-orange-100 text-orange-800',
    Assinado: 'bg-sky-100 text-sky-700',
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

// ClientCard: componente de apresentação para cada cliente no Kanban
const ClientCard = ({ client, status, onEdit }) => {
    const initials = getInitials(client.nome);
    const palette = pickAvatarPalette(client.nome);
    const borderClass = statusBorderMap[status] || 'border-gray-200';

    return (
        <div
            onClick={() => onEdit && onEdit(client)}
            className={`bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md cursor-pointer flex flex-col border-l-4 ${borderClass}`}
        >
            <div className="flex items-start justify-between">
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{client.nome}</div>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit && onEdit(client); }}
                    className="p-1 text-gray-400 hover:text-gray-700"
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

// Badge visual para exibir os dias com ícone quando necessário
const DayBadge = ({ creationDate }) => {
    const days = getDaysDiff(creationDate);
    if (isNaN(days)) return null;

    if (days > 30) {
        return (
            <div className="rounded-md px-2 py-1 inline-flex items-center gap-2 bg-red-50 text-red-600 text-xs font-medium">
                <AlertCircle size={14} className="text-red-600" />
                <span>{days} dias</span>
            </div>
        );
    }

    // neutro/positivo
    const neutralClass = days < 10 ? 'text-green-700 bg-green-50' : 'text-gray-700 bg-gray-50';
    return (
        <div className={`rounded-md px-2 py-1 inline-flex items-center gap-2 text-xs font-medium ${neutralClass}`}>
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

// Sub-componente StatusSelect — seletor estilizado em forma de "badge" (pill)
const StatusSelect = ({ currentStatus, clientId, onChange }) => {
    const handleChange = (e) => {
        const newStatus = e.target.value;
        if (onChange) onChange(newStatus);
    };

    const badgeClass = statusBadgeMap[currentStatus] || 'bg-gray-100 text-gray-700';

    return (
        <select
            value={currentStatus}
            onChange={handleChange}
            className={`appearance-none px-3 py-1 rounded-full text-xs font-bold uppercase cursor-pointer ${badgeClass} border-0 focus:outline-none`}
            aria-label={`Status do cliente ${clientId}`}
        >
            {STATUS_OPTIONS.map(opt => (
                <option key={opt} value={opt} className="text-xs font-bold">{opt}</option>
            ))}
        </select>
    );
};

const ClientsList = () => {
    const [allClients, setAllClients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [activeTab, setActiveTab] = useState('active');
    const [viewMode, setViewMode] = useState('list');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
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
        if (window.confirm(`Tem certeza que deseja excluir o cliente '${client.nome}'?`)) {
            try {
                await deleteClient(client.id);
                logActivity(`Cliente '${client.nome}' excluído.`);
                loadClients(); // Recarrega a lista
            } catch (error) {
                console.error("Erro ao excluir cliente:", error);
                // Adicionar um toast de erro aqui seria uma boa prática
            }
        }
    };

    const filteredClients = useMemo(() => {
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

            const statusMatch = (statusFilter === '' || client.status === statusFilter);
            const search = searchTerm.trim().toLowerCase();
            const textMatch = search === '' || (
                client.nome.toLowerCase().includes(search) ||
                (client.cpf && client.cpf.replace(/\D/g, '').includes(search.replace(/\D/g, ''))) ||
                (client.imovel && client.imovel.toLowerCase().includes(search))
            );

            return tabMatch && statusMatch && textMatch;
        });
    }, [allClients, searchTerm, statusFilter, activeTab]);

    // Atualização rápida de status: salva no backend e recarrega a lista
    const handleQuickStatusUpdate = async (clientId, newStatus) => {
        try {
            await saveClient({ id: clientId, status: newStatus });
            logActivity && logActivity(`Status do cliente ${clientId} alterado para ${newStatus}`);
            await loadClients();
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
            // opcional: exibir toast/alerta para o usuário
        }
    };

    // KanbanBoard component: agrupa clientes por status e renderiza colunas com scroll horizontal
    const KanbanBoard = ({ clients }) => {
        // Exclui status finais por segurança
        const statuses = STATUS_OPTIONS.filter(s => !FINAL_STATUSES.includes(s));

        return (
            <div className="overflow-x-auto">
                <div className="flex gap-6 px-2">
                    {statuses.map(status => {
                        const items = clients.filter(c => c.status === status);
                        return (
                            <div key={status} className="min-w-[300px] flex-shrink-0 bg-gray-50/50 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-semibold text-gray-800">
                                        {status}
                                    </h4>
                                    <span className="text-xs text-gray-500">{items.length}</span>
                                </div>

                                <div className="overflow-y-auto max-h-[60vh] space-y-3 pr-2">
                                    {items.length === 0 ? (
                                            <div className="text-xs text-gray-400">Nenhum cliente</div>
                                        ) : items.map(client => (
                                            <ClientCard key={client.id} client={client} status={status} onEdit={(c) => handleOpenModal(c)} />
                                        ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div id="active-clients-content" className="fade-in p-6">
            <div className="mb-6">
                <div className="mb-3">
                    <h1 className="text-2xl font-bold text-gray-900">Gerenciamento de Clientes</h1>
                    <p className="text-sm text-gray-500">Visualize e gerencie o progresso dos financiamentos.</p>
                </div>

                <div className="flex items-center gap-6 border-b pb-2 mb-4">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={activeTab === 'active' ? 'pb-2 border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}
                    >
                        Processos Ativos
                    </button>
                    <button
                        onClick={() => setActiveTab('signed')}
                        className={activeTab === 'signed' ? 'pb-2 border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}
                    >
                        Assinados
                    </button>
                    <button
                        onClick={() => setActiveTab('archived')}
                        className={activeTab === 'archived' ? 'pb-2 border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}
                    >
                        Arquivados
                    </button>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                <Search size={16} />
                            </div>
                            <input
                                type="text"
                                id="search-client"
                                placeholder="Buscar por nome, CPF ou imóvel..."
                                className="w-full pl-10 py-2 rounded-xl bg-gray-50 border border-gray-200"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <button className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700">Filtros</button>
                            <button onClick={() => handleOpenModal()} className="py-2 px-4 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-2">
                                <PlusCircle size={16} />
                                Novo Cliente
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {viewMode === 'list' ? (
                <div className="bg-surface rounded-lg shadow-md overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/50">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Imóvel</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Responsável</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Agência</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Assinatura Prevista</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Tempo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                [...Array(5)].map((_, i) => <SkeletonRow key={i} columns={7} />)
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
                                                        <div className="font-medium text-gray-900 truncate">{client.nome}</div>
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
                                                <StatusSelect currentStatus={client.status} clientId={client.id} onChange={(newStatus) => handleQuickStatusUpdate(client.id, newStatus)} />
                                            </td>
                                            <td className="px-6 py-4">
                                                {client.dataAssinaturaContrato ? (
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
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="7" className="text-center p-10 text-gray-500">
                                        Nenhum cliente encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
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
        </div>
    );
};

export default ClientsList;
