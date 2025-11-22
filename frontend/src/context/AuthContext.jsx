import { createContext, useState, useContext, useEffect } from 'react';

// 1. Criação do Contexto
const AuthContext = createContext(null);

// 2. Provedor do Contexto
export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Na inicialização, verifica se o usuário já estava logado
    useEffect(() => {
        const loggedIn = localStorage.getItem('isAuthenticated') === 'true';
        if (loggedIn) {
            setIsAuthenticated(true);
        }
    }, []);

    const login = async (email, password) => {
        // Simula a verificação de credenciais do sistema legado
        const validEmail = 'motiveimoveis@gmail.com';
        const validPassword = 'motive@sistema';

        if (email === validEmail && password === validPassword) {
            localStorage.setItem('isAuthenticated', 'true');
            setIsAuthenticated(true);
            return true;
        }
        return false;
    };

    const logout = () => {
        localStorage.removeItem('isAuthenticated');
        setIsAuthenticated(false);
        // O redirecionamento será tratado pelo componente que chamar o logout
    };

    const value = {
        isAuthenticated,
        login,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// 3. Hook customizado para facilitar o uso do contexto
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth deve ser usado dentro de um AuthProvider');
    }
    return context;
};
