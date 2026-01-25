import { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const SESSION_CACHE_KEY = 'motive_session_cache';
const SESSION_CACHE_TTL = 30 * 60 * 1000; // 30 minutos (aumentado de 5)
const LOGOUT_FLAG_KEY = 'motive_logout_intent'; // Flag para logout intencional
const KEEP_ALIVE_INTERVAL = 10 * 60 * 1000; // 10 minutos - mantém servidor acordado
const VALIDATION_TIMEOUT = 5000; // 5 segundos - timeout para validação

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

function setLogoutIntent() {
  try {
    localStorage.setItem(LOGOUT_FLAG_KEY, Date.now().toString());
  } catch {}
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

function clearLogoutIntent() {
  try {
    localStorage.removeItem(LOGOUT_FLAG_KEY);
  } catch {}
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [keepAliveId, setKeepAliveId] = useState(null);

    // Verifica a sessão ao carregar a aplicação
    useEffect(() => {
        checkAuth();
    }, []);

    // Inicia keep-alive quando usuário está autenticado
    useEffect(() => {
        if (isAuthenticated) {
            const id = startKeepAlive();
            setKeepAliveId(id);
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

    // Valida a sessão sem bloquear a UI com TIMEOUT
    const validateSessionInBackground = async () => {
        try {
            // Se foi deslogado intencionalmente, não valida
            if (getLogoutIntent()) {
                clearCachedSession();
                setUser(null);
                setIsAuthenticated(false);
                return;
            }

            // Usa AbortController para timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT);

            try {
                const response = await fetch(`${API_URL}/api/auth/me`, {
                    credentials: 'include',
                    signal: controller.signal
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
            } finally {
                clearTimeout(timeoutId);
            }
        } catch (error) {
            // Em caso de timeout ou erro, MANTÉM a sessão em cache (não limpa)
            // Isso permite que o app continue funcionando mesmo offline
            console.debug('Validação de sessão timeout/erro (mantendo cache):', error?.message);
        }
    };

    // Keep-alive: mantém o servidor acordado
    const startKeepAlive = () => {
        const intervalId = setInterval(() => {
            if (isAuthenticated) {
                // Faz uma chamada leve a cada 10 minutos para manter a conexão
                fetch(`${API_URL}/api/health`, { 
                    credentials: 'include',
                    signal: AbortSignal.timeout(3000)
                }).catch(() => {}); // Ignora erros silenciosamente
            }
        }, KEEP_ALIVE_INTERVAL);
        return intervalId;
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
            // Marca a intenção de logout ANTES de tudo
            setLogoutIntent();
            
            // Limpa o cache local
            clearCachedSession();
            
            // Faz a chamada ao servidor para limpar o cookie
            await fetch(`${API_URL}/api/auth/logout`, {
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
