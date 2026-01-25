import { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const SESSION_CACHE_KEY = 'motive_session_cache';
const SESSION_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Cache local para sessão
function getCachedSession() {
  try {
    const cached = localStorage.getItem(SESSION_CACHE_KEY);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    // Se expirou, retorna null
    if (Date.now() - timestamp > SESSION_CACHE_TTL) {
      localStorage.removeItem(SESSION_CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCachedSession(data) {
  try {
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.error('Erro ao cachear sessão:', e);
  }
}

function clearCachedSession() {
  try {
    localStorage.removeItem(SESSION_CACHE_KEY);
  } catch {}
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Verifica a sessão ao carregar a aplicação
    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            // Primeiro, verifica o cache local
            const cachedUser = getCachedSession();
            if (cachedUser) {
                setUser(cachedUser);
                setIsAuthenticated(true);
                setIsLoading(false);
                
                // Revalida em background (sem bloquear UI)
                validateSessionInBackground();
                return;
            }

            // Se não há cache, faz a chamada ao servidor
            const response = await fetch(`${API_URL}/api/auth/me`, {
                credentials: 'include',
            });

            if (response.ok) {
                const userData = await response.json();
                setUser(userData);
                setIsAuthenticated(true);
                setCachedSession(userData);
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

    // Valida a sessão sem bloquear a UI
    const validateSessionInBackground = async () => {
        try {
            const response = await fetch(`${API_URL}/api/auth/me`, {
                credentials: 'include',
            });

            if (!response.ok) {
                // Sessão inválida no servidor
                setUser(null);
                setIsAuthenticated(false);
                clearCachedSession();
            } else {
                // Sessão válida - atualiza o cache
                const userData = await response.json();
                setCachedSession(userData);
            }
        } catch (error) {
            // Em caso de erro de conexão, limpa a sessão por segurança
            console.debug('Validação de sessão falhou, limpando cache:', error);
            setUser(null);
            setIsAuthenticated(false);
            clearCachedSession();
        }
    };

    const login = async (email, password) => {
        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
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
                setCachedSession(userData);
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
            // Primeiro limpa o cache local
            clearCachedSession();
            
            // Depois faz a chamada ao servidor para limpar o cookie
            await fetch(`${API_URL}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include',
            });
        } catch (error) {
            console.error('Erro ao fazer logout:', error);
        } finally {
            // Garante que o estado é limpo mesmo se a requisição falhar
            setUser(null);
            setIsAuthenticated(false);
            clearCachedSession();
            
            // Aguarda um pouco antes de redirecionar para garantir limpeza
            // Força reload da página para limpar qualquer cache do navegador
            setTimeout(() => {
                window.location.href = '/';
            }, 100);
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
