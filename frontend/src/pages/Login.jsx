import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import ModernInput from '../components/ModernInput';
import LoadingAnimation from '../components/LoadingAnimation';
import LoadingSpinner from '../components/LoadingSpinner';
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
        return <LoadingAnimation fullScreen size="lg" message="Verificando autenticação..." />;
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
                            <div className="relative group rounded-xl border border-gray-200 bg-gray-50/70 hover:border-gray-300 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 transition-all duration-200">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-primary">
                                    <Lock size={18} />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                    className="w-full pl-10 pr-12 py-3 rounded-xl bg-transparent border-none focus:ring-0 outline-none"
                                    placeholder="Digite sua senha"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 group-focus-within:text-primary transition-colors px-2 py-2 rounded-lg hover:bg-gray-100 active:scale-95"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            <div className="mt-2 text-right">
                                <button
                                    type="button"
                                    onClick={() => alert('Contate o administrador para redefinir sua senha.')}
                                    className="text-xs font-medium text-primary hover:text-secondary transition-colors underline-offset-4 hover:underline"
                                >
                                    Esqueci minha senha
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
                            className="w-full min-h-[52px] py-3 px-4 bg-gradient-to-r from-primary to-secondary
                                     text-white font-medium rounded-xl shadow-md
                                     hover:shadow-xl hover:-translate-y-0.5
                                     active:translate-y-0 active:scale-[0.99]
                                     disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-md
                                     transition-[transform,box-shadow] duration-200 flex items-center justify-center"
                        >
                            <span className="inline-flex items-center justify-center gap-2 min-w-[170px] transition-opacity duration-200">
                                {isSubmitting ? (
                                    <>
                                        <LoadingSpinner size={18} />
                                        <span>Entrando...</span>
                                    </>
                                ) : (
                                    'Entrar no Sistema'
                                )}
                            </span>
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