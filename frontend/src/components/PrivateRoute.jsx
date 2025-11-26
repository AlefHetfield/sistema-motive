import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

const PrivateRoute = ({ children, requiredRole }) => {
    const { isAuthenticated, isLoading, user } = useAuth();
    const location = useLocation();

    // Mostra loading enquanto verifica autenticação
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Carregando...</p>
                </div>
            </div>
        );
    }

    // Se não estiver autenticado, redireciona para login
    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Se requer uma role específica e o usuário não tem, mostra acesso negado
    if (requiredRole && user?.role !== requiredRole) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Acesso Negado</h2>
                    <p className="text-gray-600 mb-6">
                        Você não tem permissão para acessar esta página.
                    </p>
                    <button
                        onClick={() => window.history.back()}
                        className="px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
                    >
                        Voltar
                    </button>
                </div>
            </div>
        );
    }

    return children;
};

export default PrivateRoute;
