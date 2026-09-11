/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useContext, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';

const AuthContext = createContext(null);

const SESSION_CACHE_KEY = 'motive_session_cache';
const LOGOUT_FLAG_KEY = 'motive_logout_intent'; // Flag para logout intencional
const KEEP_ALIVE_INTERVAL = 10 * 60 * 1000; // 10 minutos - mantém servidor acordado

function clearCachedSession() {
  try {
    localStorage.removeItem(SESSION_CACHE_KEY);
  } catch {
    // O armazenamento pode estar indisponível em modo privado.
  }
}

function setLogoutIntent() {
  try {
    localStorage.setItem(LOGOUT_FLAG_KEY, Date.now().toString());
  } catch {
    // O armazenamento pode estar indisponível em modo privado.
  }
}

function getLogoutIntent() {
  try {
    const intent = localStorage.getItem(LOGOUT_FLAG_KEY);
    if (!intent) return null;
    // Limpa após 2 segundos
    const age = Date.now() - parseInt(intent);
    if (age > 2000) {
      localStorage.removeItem(LOGOUT_FLAG_KEY);
      return null;
    }
    return intent;
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Verifica a sessão ao carregar a aplicação
    useEffect(() => {
        checkAuth();
    }, []);

    useEffect(() => {
        const handleUnauthorized = () => {
            clearCachedSession();
            setUser(null);
            setIsAuthenticated(false);
        };
        window.addEventListener('motive:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('motive:unauthorized', handleUnauthorized);
    }, []);

    // Inicia keep-alive quando usuário está autenticado
    useEffect(() => {
        if (isAuthenticated) {
            const id = startKeepAlive();
            return () => clearInterval(id);
        }
    }, [isAuthenticated]);

    const checkAuth = async () => {
        try {
            // Se foi deslogado intencionalmente, não tenta restaurar sessão
            if (getLogoutIntent()) {
                setUser(null);
                setIsAuthenticated(false);
                clearCachedSession();
                setIsLoading(false);
                return;
            }

            // A API é a fonte de verdade. O cache local nunca autentica sozinho.
            const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
                credentials: 'include',
            });

            if (response.ok) {
                const userData = await response.json();
                setUser(userData);
                setIsAuthenticated(true);
                clearCachedSession();
            } else {
                setUser(null);
                setIsAuthenticated(false);
                clearCachedSession();
            }
        } catch (error) {
            console.error('Erro ao verificar autenticação:', error);
            setUser(null);
            setIsAuthenticated(false);
            clearCachedSession();
        } finally {
            setIsLoading(false);
        }
    };

    // Keep-alive: mantém o servidor acordado
    const startKeepAlive = () => {
        const intervalId = setInterval(() => {
            if (isAuthenticated) {
                // Faz uma chamada leve a cada 10 minutos para manter a conexão
                fetch(`${API_BASE_URL}/api/health`, {
                    credentials: 'include',
                    signal: AbortSignal.timeout(3000)
                }).catch(() => {}); // Ignora erros silenciosamente
            }
        }, KEEP_ALIVE_INTERVAL);
        return intervalId;
    };

    const login = async (email, password) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ email, password }),
            });

            if (response.ok) {
                const userData = await response.json();
                setUser(userData);
                setIsAuthenticated(true);
                clearCachedSession();
                return { success: true, user: userData };
            } else {
                const error = await response.json();
                clearCachedSession();
                return { success: false, error: error.error || 'Credenciais inválidas' };
            }
        } catch (error) {
            console.error('Erro no login:', error);
            clearCachedSession();
            return { success: false, error: 'Erro ao conectar com o servidor' };
        }
    };

    const logout = async () => {
        try {
            // Marca a intenção de logout ANTES de tudo
            setLogoutIntent();
            
            // Limpa o cache local
            clearCachedSession();
            
            // Faz a chamada ao servidor para limpar o cookie
            await fetch(`${API_BASE_URL}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include',
            });
        } catch (error) {
            console.error('Erro ao fazer logout:', error);
        } finally {
            // Garante que o estado é limpo
            setUser(null);
            setIsAuthenticated(false);
            clearCachedSession();
            
            // Redireciona para login
            window.location.href = '/login';
        }
    };

    const hasRole = (role) => {
        return user?.role === role;
    };

    const isAdmin = () => {
        return user?.role === 'ADM';
    };

    const value = {
        user,
        isAuthenticated,
        isLoading,
        login,
        logout,
        checkAuth,
        hasRole,
        isAdmin,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth deve ser usado dentro de um AuthProvider');
    }
    return context;
};
