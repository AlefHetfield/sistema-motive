import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import ModernInput from '../components/ModernInput';
import logoDark from '../assets/logo-dark.png';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login, isAuthenticated, isLoading } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            const result = await login(email, password);
            
            if (result.success) {
                navigate('/dashboard');
            } else {
                setError(result.error || 'Credenciais inválidas. Tente novamente.');
            }
        } catch (err) {
            setError('Ocorreu um erro ao tentar fazer login.');
            console.error('Erro no login:', err);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // Se já estiver autenticado, redireciona
    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    // Mostra loading inicial enquanto verifica autenticação
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/5 via-white to-secondary/5">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-4">
            <div className="w-full max-w-md animate-fade-in">
                <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
                    {/* Logo e Header */}
                    <div className="text-center mb-8">
                        <div className="inline-block p-3 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl mb-4">
                            <img 
                                src={logoDark} 
                                alt="Logo Motive" 
                                className="w-32 h-auto"
                            />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">
                            Sistema Motive
                        </h1>
                        <p className="text-gray-500">
                            Entre com suas credenciais
                        </p>
                    </div>

                    {/* Formulário */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Email */}
                        <ModernInput
                            label="Email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="seu@email.com"
                            icon={Mail}
                            required
                            autoComplete="email"
                        />

                        {/* Senha */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Senha
                            </label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                    <Lock size={18} />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                    className="w-full pl-10 pr-12 py-2.5 border border-gray-200 rounded-xl
                                             focus:ring-2 focus:ring-primary/20 focus:border-primary
                                             transition-all duration-200 outline-none"
                                    placeholder="Digite sua senha"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 
                                             hover:text-gray-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Mensagem de Erro */}
                        {error && (
                            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 
                                          rounded-xl text-red-700 text-sm animate-fade-in">
                                <AlertCircle size={16} className="flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Botão de Login */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-3 px-4 bg-gradient-to-r from-primary to-secondary
                                     text-white font-medium rounded-xl shadow-md
                                     hover:shadow-lg hover:scale-[1.02]
                                     active:scale-[0.98]
                                     disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100
                                     transition-all duration-200 flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>Entrando...</span>
                                </>
                            ) : (
                                'Entrar no Sistema'
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-6 text-center text-xs text-gray-500">
                        Sistema de Gestão Imobiliária
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;