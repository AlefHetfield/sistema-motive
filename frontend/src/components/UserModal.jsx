import { useState, useEffect } from 'react';
import { X, Mail, User, Lock, Shield, Eye, EyeOff } from 'lucide-react';
import ModernInput from './ModernInput';

const UserModal = ({ user, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        nome: '',
        email: '',
        password: '',
        role: 'CORRETOR',
        isActive: true,
    });
    const [showPassword, setShowPassword] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (user) {
            setFormData({
                nome: user.nome || '',
                email: user.email || '',
                password: '', // Não mostra senha existente
                role: user.role || 'CORRETOR',
                isActive: user.isActive ?? true,
            });
        }
    }, [user]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const dataToSend = { ...formData };
            
            // Se está editando e a senha está vazia, não envia password
            if (user && !dataToSend.password) {
                delete dataToSend.password;
            }

            await onSave(dataToSend);
        } catch (error) {
            console.error('Erro ao salvar usuário:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h3 className="text-xl font-bold text-gray-900">
                        {user ? 'Editar Usuário' : 'Novo Usuário'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Nome */}
                    <ModernInput
                        label="Nome Completo"
                        name="nome"
                        value={formData.nome}
                        onChange={handleInputChange}
                        placeholder="Digite o nome completo"
                        icon={User}
                        required
                    />

                    {/* Email */}
                    <ModernInput
                        label="Email"
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="usuario@email.com"
                        icon={Mail}
                        required
                    />

                    {/* Senha */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Senha {user && <span className="text-gray-400 font-normal">(deixe em branco para manter)</span>}
                        </label>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                <Lock size={18} />
                            </div>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                value={formData.password}
                                onChange={handleInputChange}
                                required={!user} // Obrigatório apenas na criação
                                className="w-full pl-10 pr-12 py-2.5 border border-gray-200 rounded-xl
                                         focus:ring-2 focus:ring-primary/20 focus:border-primary
                                         transition-all duration-200 outline-none"
                                placeholder={user ? 'Nova senha (opcional)' : 'Digite a senha'}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* Função */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Função
                        </label>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                <Shield size={18} />
                            </div>
                            <select
                                name="role"
                                value={formData.role}
                                onChange={handleInputChange}
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl
                                         focus:ring-2 focus:ring-primary/20 focus:border-primary
                                         transition-all duration-200 outline-none appearance-none cursor-pointer"
                            >
                                <option value="CORRETOR">Corretor</option>
                                <option value="ADM">Administrador</option>
                            </select>
                        </div>
                    </div>

                    {/* Status (apenas na edição) */}
                    {user && (
                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                            <input
                                type="checkbox"
                                id="isActive"
                                checked={formData.isActive}
                                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                                className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary/20"
                            />
                            <label htmlFor="isActive" className="text-sm font-medium text-gray-700 cursor-pointer">
                                Usuário ativo
                            </label>
                        </div>
                    )}

                    {/* Botões */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl
                                     hover:bg-gray-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-primary to-secondary text-white
                                     font-medium rounded-xl hover:shadow-lg disabled:opacity-60 
                                     disabled:cursor-not-allowed transition-all duration-200"
                        >
                            {isSaving ? 'Salvando...' : user ? 'Atualizar' : 'Criar Usuário'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserModal;
