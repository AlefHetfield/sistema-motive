import { useState, useEffect, useMemo } from 'react';
import { fetchClients } from '../services/api';
import { FilePenLine, Trash2, PlusCircle } from 'lucide-react';
import ClientModal from '../components/ClientModal'; // Importar o modal

// Constantes e helpers replicados do main.js
const STATUS_OPTIONS = ["Aprovado", "Engenharia", "Finalização", "Conformidade", "Assinado"];
const FINAL_STATUSES = ["Assinado-Movido", "Arquivado"];

const statusColorMap = {
    "Aprovado": "status-aprovado",
    "Engenharia": "status-engenharia",
    "Finalização": "status-finalização",
    "Conformidade": "status-conformidade",
    "Assinado": "status-assinado"
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
        days: diffDays.toString().padStart(2, '0'),
        color: colorClass
    };
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

const ClientsList = () => {
    const [allClients, setAllClients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    
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

    const filteredClients = useMemo(() => {
        return allClients.filter(client =>
            !FINAL_STATUSES.includes(client.status) &&
            (statusFilter === '' || client.status === statusFilter) &&
            (
                client.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (client.cpf && client.cpf.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, '')))
            )
        );
    }, [allClients, searchTerm, statusFilter]);

    return (
        <div id="active-clients-content" className="fade-in p-6">
            <div className="filter-container mb-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="w-full md:w-1/3 relative">
                        <input
                            type="text"
                            id="search-client"
                            placeholder="Buscar cliente por nome ou CPF..."
                            className="form-input w-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="w-full md:w-auto flex items-center gap-4">
                        <select
                            id="filter-status"
                            className="form-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="">Todos os Status</option>
                            {STATUS_OPTIONS.map(status => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                        <button 
                            onClick={() => handleOpenModal()} 
                            className="py-2 px-4 rounded-md shadow-sm text-sm font-medium btn-primary whitespace-nowrap flex items-center gap-2"
                        >
                           <PlusCircle size={18} /> Adicionar Cliente
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-surface rounded-lg shadow-md overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3">Nome do Cliente</th>
                            <th scope="col" className="px-6 py-3">CPF</th>
                            <th scope="col" className="px-6 py-3">Imóvel</th>
                            <th scope="col" className="px-6 py-3">Corretor</th>
                            <th scope="col" className="px-6 py-3">Status</th>
                            <th scope="col" className="px-6 py-3 text-center">Dias</th>
                            <th scope="col" className="px-6 py-3 text-center whitespace-nowrap">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            [...Array(5)].map((_, i) => <SkeletonRow key={i} columns={7} />)
                        ) : filteredClients.length > 0 ? (
                            filteredClients.map(client => {
                                const dayCounter = getDayCounter(client.createdAt);
                                return (
                                    <tr key={client.id} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{client.nome}</td>
                                        <td className="px-6 py-4">{formatCPF(client.cpf)}</td>
                                        <td className="px-6 py-4">{client.imovel}</td>
                                        <td className="px-6 py-4">{client.corretor}</td>
                                        <td className="px-6 py-4">
                                            <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${statusColorMap[client.status]}`}>
                                                {client.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${dayCounter.color}`}>{dayCounter.days}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center space-x-3 whitespace-nowrap">
                                            <button onClick={() => handleOpenModal(client)} className="p-1 text-primary hover:text-blue-800" title="Editar">
                                                <FilePenLine size={18} />
                                            </button>
                                            <button className="p-1 text-red-600 hover:text-red-800" title="Excluir">
                                                <Trash2 size={18} />
                                            </button>
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
