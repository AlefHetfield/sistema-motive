import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, Plus, Edit2, Trash2, Shield, ShieldOff, Loader2, AlertCircle, CheckCircle, X } from 'lucide-react';
import ModernInput from '../components/ModernInput';
import UserModal from '../components/UserModal';
import ConfirmModal from '../components/ConfirmModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const UserManagement = () => {
    const { user: currentUser, isAdmin } = useAuth();
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('ALL');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, user: null, action: null });
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        if (isAdmin()) {
            fetchUsers();
        }
    }, []);

    const fetchUsers = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`${API_URL}/api/users`, {
                credentials: 'include',
            });

            if (response.ok) {
                const data = await response.json();
                setUsers(data);
            } else {
                showNotification('Erro ao carregar usuários', 'error');
            }
        } catch (error) {
            console.error('Erro ao buscar usuários:', error);
            showNotification('Erro ao conectar com o servidor', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };

    const handleCreateUser = () => {
        setSelectedUser(null);
        setIsModalOpen(true);
    };

    const handleEditUser = (user) => {
        setSelectedUser(user);
        setIsModalOpen(true);
    };

    const handleDeleteUser = (user) => {
        setConfirmModal({
            isOpen: true,
            user,
            action: 'delete',
            title: 'Deletar Usuário',
            message: `Tem certeza que deseja deletar o usuário "${user.nome}"? Esta ação não pode ser desfeita.`,
        });
    };

    const handleToggleActive = (user) => {
        setConfirmModal({
            isOpen: true,
            user,
            action: 'toggle',
            title: user.isActive ? 'Desativar Usuário' : 'Ativar Usuário',
            message: `Deseja ${user.isActive ? 'desativar' : 'ativar'} o usuário "${user.nome}"?`,
        });
    };

    const confirmAction = async () => {
        const { user, action } = confirmModal;

        try {
            if (action === 'delete') {
                await deleteUser(user.id);
            } else if (action === 'toggle') {
                await toggleUserActive(user.id, !user.isActive);
            }
        } finally {
            setConfirmModal({ isOpen: false, user: null, action: null });
        }
    };

    const deleteUser = async (userId) => {
        try {
            console.log('Tentando deletar usuário:', userId);
            const response = await fetch(`${API_URL}/api/users/${userId}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            console.log('Resposta da exclusão:', response.status, response.ok);

            if (response.ok) {
                showNotification('Usuário deletado com sucesso', 'success');
                await fetchUsers();
            } else {
                let errorMessage = 'Erro ao deletar usuário';
                try {
                    const error = await response.json();
                    errorMessage = error.error || errorMessage;
                } catch (e) {
                    console.error('Erro ao parsear resposta:', e);
                }
                showNotification(errorMessage, 'error');
            }
        } catch (error) {
            console.error('Erro ao deletar usuário:', error);
            showNotification('Erro ao deletar usuário', 'error');
        }
    };

    const toggleUserActive = async (userId, isActive) => {
        try {
            const response = await fetch(`${API_URL}/api/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ isActive }),
            });

            if (response.ok) {
                showNotification(
                    `Usuário ${isActive ? 'ativado' : 'desativado'} com sucesso`,
                    'success'
                );
                fetchUsers();
            } else {
                showNotification('Erro ao atualizar usuário', 'error');
            }
        } catch (error) {
            console.error('Erro ao atualizar usuário:', error);
            showNotification('Erro ao atualizar usuário', 'error');
        }
    };

    const handleSaveUser = async (userData) => {
        try {
            const url = selectedUser
                ? `${API_URL}/api/users/${selectedUser.id}`
                : `${API_URL}/api/users`;
            
            const method = selectedUser ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(userData),
            });

            if (response.ok) {
                showNotification(
                    selectedUser ? 'Usuário atualizado com sucesso' : 'Usuário criado com sucesso',
                    'success'
                );
                setIsModalOpen(false);
                fetchUsers();
            } else {
                const error = await response.json();
                showNotification(error.error || 'Erro ao salvar usuário', 'error');
            }
        } catch (error) {
            console.error('Erro ao salvar usuário:', error);
            showNotification('Erro ao salvar usuário', 'error');
        }
    };

    const filteredUsers = users.filter((user) => {
        const matchesSearch = user.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            user.email?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = filterRole === 'ALL' || user.role === filterRole;
        return matchesSearch && matchesRole;
    });

    const getRoleBadge = (role) => {
        return role === 'ADM' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-lg">
                <Shield size={12} />
                Administrador
            </span>
        ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-lg">
                <Users size={12} />
                Corretor
            </span>
        );
    };

    const getStatusBadge = (isActive) => {
        return isActive ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-lg">
                <CheckCircle size={12} />
                Ativo
            </span>
        ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg">
                <X size={12} />
                Inativo
            </span>
        );
    };

    if (!isAdmin()) {
        return null; // O PrivateRoute já vai bloquear, mas por segurança
    }

    return (
        <div className="space-y-6 p-6">
            {/* Notificação */}
            {notification && (
                <div
                    className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg animate-fade-in ${
                        notification.type === 'success'
                            ? 'bg-green-50 border border-green-200 text-green-700'
                            : 'bg-red-50 border border-red-200 text-red-700'
                    }`}
                >
                    {notification.type === 'success' ? (
                        <CheckCircle size={20} />
                    ) : (
                        <AlertCircle size={20} />
                    )}
                    <span className="font-medium">{notification.message}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gerenciamento de Usuários</h1>
                    <p className="text-gray-500 mt-1">Gerencie usuários e permissões do sistema</p>
                </div>
                <button
                    onClick={handleCreateUser}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-secondary text-white rounded-xl hover:shadow-lg transition-all duration-200"
                >
                    <Plus size={18} />
                    Novo Usuário
                </button>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <ModernInput
                            placeholder="Buscar por nome ou email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            icon={Users}
                        />
                    </div>
                    <div className="flex gap-2">
                        {['ALL', 'ADM', 'CORRETOR'].map((role) => (
                            <button
                                key={role}
                                onClick={() => setFilterRole(role)}
                                className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                                    filterRole === role
                                        ? 'bg-primary text-white shadow-md'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {role === 'ALL' ? 'Todos' : role === 'ADM' ? 'Admins' : 'Corretores'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Lista de Usuários */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
            ) : filteredUsers.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                    <Users size={48} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum usuário encontrado</h3>
                    <p className="text-gray-500">
                        {searchTerm || filterRole !== 'ALL'
                            ? 'Tente ajustar os filtros'
                            : 'Comece criando um novo usuário'}
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Usuário
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Função
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Último Login
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Ações
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-medium">
                                                    {user.nome?.charAt(0)?.toUpperCase() || '?'}
                                                </div>
                                                <div className="ml-3">
                                                    <div className="font-medium text-gray-900">{user.nome}</div>
                                                    <div className="text-sm text-gray-500">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {getRoleBadge(user.role)}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(user.isActive)}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {user.lastLogin
                                                ? new Date(user.lastLogin).toLocaleDateString('pt-BR')
                                                : 'Nunca'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleToggleActive(user)}
                                                    disabled={user.id === currentUser.id}
                                                    className={`p-2 rounded-lg transition-colors ${
                                                        user.id === currentUser.id
                                                            ? 'text-gray-300 cursor-not-allowed'
                                                            : user.isActive
                                                            ? 'text-orange-600 hover:bg-orange-50'
                                                            : 'text-green-600 hover:bg-green-50'
                                                    }`}
                                                    title={user.isActive ? 'Desativar' : 'Ativar'}
                                                >
                                                    {user.isActive ? <ShieldOff size={18} /> : <Shield size={18} />}
                                                </button>
                                                <button
                                                    onClick={() => handleEditUser(user)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(user)}
                                                    disabled={user.id === currentUser.id}
                                                    className={`p-2 rounded-lg transition-colors ${
                                                        user.id === currentUser.id
                                                            ? 'text-gray-300 cursor-not-allowed'
                                                            : 'text-red-600 hover:bg-red-50'
                                                    }`}
                                                    title="Deletar"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal de Usuário */}
            {isModalOpen && (
                <UserModal
                    user={selectedUser}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSaveUser}
                />
            )}

            {/* Modal de Confirmação */}
            {confirmModal.isOpen && (
                <ConfirmModal
                    isOpen={confirmModal.isOpen}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    onConfirm={confirmAction}
                    onCancel={() => setConfirmModal({ isOpen: false, user: null, action: null })}
                    confirmText="Confirmar"
                    cancelText="Cancelar"
                    confirmColor={confirmModal.action === 'delete' ? 'red' : 'blue'}
                />
            )}
        </div>
    );
};

export default UserManagement;
