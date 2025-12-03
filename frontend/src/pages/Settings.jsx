import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Lock, Shield, Eye, EyeOff, CheckCircle, AlertCircle, Loader2, FileText, Send } from 'lucide-react';
import ModernInput from '../components/ModernInput';
import LoadingSpinner from '../components/LoadingSpinner';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const Settings = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');
    const [notification, setNotification] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Perfil
    const [profileData, setProfileData] = useState({
        nome: user?.nome || '',
        email: user?.email || '',
    });

    // Senha
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false,
    });

    // Backup
    const [sendingBackup, setSendingBackup] = useState(false);

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await fetch(`${API_URL}/api/auth/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(profileData),
            });

            if (response.ok) {
                showNotification('Perfil atualizado com sucesso!', 'success');
                // Recarrega a página para atualizar o contexto
                setTimeout(() => window.location.reload(), 1500);
            } else {
                const error = await response.json();
                showNotification(error.error || 'Erro ao atualizar perfil', 'error');
            }
        } catch (error) {
            console.error('Erro ao atualizar perfil:', error);
            showNotification('Erro ao conectar com o servidor', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendBackup = async () => {
        setSendingBackup(true);
        try {
            const response = await fetch(`${API_URL}/api/reports/weekly/run`, {
                method: 'GET',
                credentials: 'include',
            });

            if (response.ok) {
                showNotification('Relatório enviado com sucesso!', 'success');
            } else {
                const error = await response.json();
                showNotification(error.error || 'Erro ao enviar relatório', 'error');
            }
        } catch (error) {
            console.error('Erro ao enviar backup:', error);
            showNotification('Erro ao conectar com o servidor', 'error');
        } finally {
            setSendingBackup(false);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            showNotification('As senhas não conferem', 'error');
            return;
        }

        if (passwordData.newPassword.length < 6) {
            showNotification('A nova senha deve ter no mínimo 6 caracteres', 'error');
            return;
        }

        setIsLoading(true);

        try {
            // Usa rota dedicada que não exige ADM
            const response = await fetch(`${API_URL}/api/auth/change-password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ password: passwordData.newPassword }),
            });

            if (response.ok) {
                showNotification('Senha alterada com sucesso!', 'success');
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            } else {
                const error = await response.json();
                showNotification(error.error || 'Erro ao alterar senha', 'error');
            }
        } catch (error) {
            console.error('Erro ao alterar senha:', error);
            showNotification('Erro ao conectar com o servidor', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const tabs = [
        { id: 'profile', label: 'Perfil', icon: User },
        { id: 'security', label: 'Segurança', icon: Lock },
        ...(user?.role === 'ADM' ? [{ id: 'reports', label: 'Relatórios', icon: FileText }] : []),
    ];

    return (
        <div className="p-6 space-y-6 animate-fade-in">
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
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
                <p className="text-gray-500 mt-1">Gerencie suas preferências e segurança</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-3 font-medium transition-all duration-200 border-b-2 ${
                                activeTab === tab.id
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Icon size={18} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Conteúdo */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                {activeTab === 'profile' && (
                    <div className="max-w-2xl">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Informações do Perfil</h2>
                        
                        {/* Info Card */}
                        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                            <Shield className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                            <div>
                                <p className="text-sm font-medium text-blue-900">
                                    Você está logado como {user?.role === 'ADM' ? 'Administrador' : 'Corretor'}
                                </p>
                                <p className="text-xs text-blue-700 mt-1">
                                    {user?.role === 'ADM' 
                                        ? 'Você tem acesso total ao sistema'
                                        : 'Você tem acesso às funcionalidades de corretor'}
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleProfileUpdate} className="space-y-4">
                            <ModernInput
                                label="Nome Completo"
                                value={profileData.nome}
                                onChange={(e) => setProfileData({ ...profileData, nome: e.target.value })}
                                placeholder="Seu nome completo"
                                icon={User}
                                required
                            />

                            <ModernInput
                                label="Email"
                                type="email"
                                value={profileData.email}
                                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                                placeholder="seu@email.com"
                                icon={Mail}
                                required
                            />

                            <div className="flex justify-end pt-4">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="px-6 py-2.5 bg-gradient-to-r from-primary to-secondary text-white
                                             font-medium rounded-xl hover:shadow-lg disabled:opacity-60 
                                             disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                                >
                                    {isLoading ? (
                                        <>
                                            <LoadingSpinner size={18} />
                                            Salvando...
                                        </>
                                    ) : (
                                        'Salvar Alterações'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {activeTab === 'security' && (
                    <div className="max-w-2xl">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Alterar Senha</h2>
                        
                        <form onSubmit={handlePasswordChange} className="space-y-4">
                            {/* Nova Senha */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Nova Senha
                                </label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type={showPasswords.new ? 'text' : 'password'}
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        required
                                        minLength={6}
                                        className="w-full pl-10 pr-12 py-2.5 border border-gray-200 rounded-xl
                                                 focus:ring-2 focus:ring-primary/20 focus:border-primary
                                                 transition-all duration-200 outline-none"
                                        placeholder="Mínimo 6 caracteres"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirmar Senha */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Confirmar Nova Senha
                                </label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type={showPasswords.confirm ? 'text' : 'password'}
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        required
                                        minLength={6}
                                        className="w-full pl-10 pr-12 py-2.5 border border-gray-200 rounded-xl
                                                 focus:ring-2 focus:ring-primary/20 focus:border-primary
                                                 transition-all duration-200 outline-none"
                                        placeholder="Digite novamente a senha"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="px-6 py-2.5 bg-gradient-to-r from-primary to-secondary text-white
                                             font-medium rounded-xl hover:shadow-lg disabled:opacity-60 
                                             disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                                >
                                    {isLoading ? (
                                        <>
                                            <LoadingSpinner size={18} />
                                            Alterando...
                                        </>
                                    ) : (
                                        'Alterar Senha'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {activeTab === 'reports' && (
                    <div className="max-w-2xl">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Relatórios e Backup</h2>
                        
                        {/* Info sobre backup automático */}
                        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                            <Shield className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                            <div>
                                <p className="text-sm font-medium text-blue-900">
                                    Relatórios Automáticos Configurados
                                </p>
                                <p className="text-xs text-blue-700 mt-1">
                                    • Relatório Mensal: Todo dia 1 às 09:00<br />
                                    • Relatório Semanal: Todas as segundas às 09:05
                                </p>
                            </div>
                        </div>

                        {/* Seção de envio manual */}
                        <div className="space-y-4">
                            <div className="p-6 bg-gradient-to-br from-primary/5 to-secondary/5 rounded-xl border border-primary/20">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <Send className="text-primary" size={24} />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                            Enviar Relatório Manualmente
                                        </h3>
                                        <p className="text-sm text-gray-600 mb-4">
                                            Envie um relatório semanal imediatamente com os dados atuais do sistema.
                                            O relatório será enviado por email com um arquivo Excel anexado.
                                        </p>
                                        <button
                                            onClick={handleSendBackup}
                                            disabled={sendingBackup}
                                            className="px-6 py-2.5 bg-gradient-to-r from-primary to-secondary text-white
                                                     font-medium rounded-xl hover:shadow-lg disabled:opacity-60 
                                                     disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                                        >
                                            {sendingBackup ? (
                                                <>
                                                    <LoadingSpinner size={18} />
                                                    Enviando relatório...
                                                </>
                                            ) : (
                                                <>
                                                    <Send size={18} />
                                                    Enviar Relatório Agora
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Info adicional */}
                            <div className="p-4 bg-gray-50 rounded-xl">
                                <h4 className="text-sm font-semibold text-gray-900 mb-2">ℹ️ Informações sobre o Relatório</h4>
                                <ul className="text-xs text-gray-600 space-y-1">
                                    <li>• O relatório inclui todos os clientes ativos dos últimos 7 dias</li>
                                    <li>• Formato: Excel (.xlsx) com métricas detalhadas</li>
                                    <li>• Destinatários configurados nas variáveis de ambiente</li>
                                    <li>• O envio pode levar alguns segundos para processar</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Settings;
