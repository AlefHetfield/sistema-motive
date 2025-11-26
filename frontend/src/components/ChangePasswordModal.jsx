import { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const ChangePasswordModal = ({ user, onSuccess }) => {
    const [formData, setFormData] = useState({
        newPassword: '',
        confirmPassword: '',
    });
    const [showPasswords, setShowPasswords] = useState({ new: false, confirm: false });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validações
        if (formData.newPassword.length < 6) {
            setError('A senha deve ter no mínimo 6 caracteres');
            return;
        }

        if (formData.newPassword !== formData.confirmPassword) {
            setError('As senhas não conferem');
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch(`${API_URL}/api/users/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    password: formData.newPassword,
                    mustChangePassword: false, // Remove a flag após trocar
                }),
            });

            if (response.ok) {
                onSuccess();
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Erro ao alterar senha');
            }
        } catch (error) {
            console.error('Erro ao alterar senha:', error);
            setError('Erro ao conectar com o servidor');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
                {/* Header */}
                <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-orange-100 rounded-lg">
                            <Lock className="text-orange-600" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">
                                Troca de Senha Obrigatória
                            </h2>
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                        Por segurança, você precisa definir uma nova senha antes de continuar.
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Usuário */}
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <p className="text-sm text-blue-900">
                            <span className="font-medium">Olá, {user.nome}!</span>
                            <br />
                            <span className="text-blue-700">
                                Esta é sua primeira vez no sistema. Escolha uma senha segura.
                            </span>
                        </p>
                    </div>

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
                                value={formData.newPassword}
                                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
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
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
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

                    {/* Erro */}
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm animate-fade-in">
                            <AlertCircle size={16} className="flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Dicas de Segurança */}
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                        <p className="text-xs font-medium text-gray-700 mb-1">💡 Dicas para uma senha forte:</p>
                        <ul className="text-xs text-gray-600 space-y-0.5">
                            <li>• Use no mínimo 6 caracteres</li>
                            <li>• Combine letras, números e símbolos</li>
                            <li>• Evite informações pessoais óbvias</li>
                        </ul>
                    </div>

                    {/* Botão */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 px-4 bg-gradient-to-r from-primary to-secondary
                                 text-white font-medium rounded-xl shadow-md
                                 hover:shadow-lg hover:scale-[1.02]
                                 active:scale-[0.98]
                                 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100
                                 transition-all duration-200 flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                <span>Alterando senha...</span>
                            </>
                        ) : (
                            'Confirmar e Continuar'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChangePasswordModal;
