import { useState, useEffect } from 'react';
import { fetchUsers, deleteUser } from '../services/api';
import UserModal from '../components/UserModal';
import { PlusCircle, FilePenLine, Trash2 } from 'lucide-react';

const SkeletonRow = ({ columns }) => (
    <tr className="bg-white border-b">
        {[...Array(columns)].map((_, i) => (
            <td key={i} className="px-6 py-4">
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
            </td>
        ))}
    </tr>
);

const Settings = () => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    const loadUsers = async () => {
        setIsLoading(true);
        try {
            const data = await fetchUsers();
            setUsers(data);
        } catch (error) {
            console.error("Erro ao buscar usuários:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleOpenModal = (user = null) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingUser(null);
    };

    const handleSaveSuccess = () => {
        handleCloseModal();
        loadUsers();
    };

    const handleDelete = async (userId) => {
        if (window.confirm('Você tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.')) {
            try {
                await deleteUser(userId);
                loadUsers(); // Recarrega a lista após a exclusão
            } catch (error) {
                console.error("Erro ao excluir usuário:", error);
            }
        }
    };

    const RoleBadge = ({ role }) => {
        const isAdmin = role === 'Administrador';
        const roleClass = isAdmin ? 'bg-primary/20 text-primary' : 'bg-gray-200 text-gray-800';
        return <span className={`text-xs font-medium px-2.5 py-0.5 rounded ${roleClass}`}>{role}</span>;
    };

    return (
        <div id="settings-view" className="fade-in p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-secondary">Gerenciamento de Usuários</h2>
                <button 
                    onClick={() => handleOpenModal()} 
                    className="py-2 px-4 rounded-md shadow-sm text-sm font-medium btn-primary whitespace-nowrap flex items-center gap-2"
                >
                    <PlusCircle size={18} /> Adicionar Usuário
                </button>
            </div>

            <div className="bg-surface rounded-lg shadow-md overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3">Nome</th>
                            <th scope="col" className="px-6 py-3">Email</th>
                            <th scope="col" className="px-6 py-3">Função</th>
                            <th scope="col" className="px-6 py-3 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                             [...Array(3)].map((_, i) => <SkeletonRow key={i} columns={4} />)
                        ) : users.length > 0 ? (
                            users.map(user => (
                                <tr key={user.id} className="bg-white border-b hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{user.nome}</td>
                                    <td className="px-6 py-4">{user.email}</td>
                                    <td className="px-6 py-4">
                                        <RoleBadge role={user.role} />
                                    </td>
                                    <td className="px-6 py-4 text-center space-x-4 whitespace-nowrap">
                                        <button onClick={() => handleOpenModal(user)} className="font-medium text-primary hover:underline">
                                            <FilePenLine size={18} className="inline-block" />
                                        </button>
                                        <button onClick={() => handleDelete(user.id)} className="font-medium text-red-600 hover:underline">
                                            <Trash2 size={18} className="inline-block" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                             <tr>
                                <td colSpan="4" className="text-center p-10">
                                    <p className="text-gray-500">Nenhum usuário cadastrado.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <UserModal 
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveSuccess}
                userToEdit={editingUser}
            />
        </div>
    );
};

export default Settings;
