import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, LayoutDashboard, Users, FileText, Calculator, MapPin, Settings as SettingsIcon, UserCog } from 'lucide-react';
import logoLight from '../assets/logo-light.png';
import ChangePasswordModal from './ChangePasswordModal';

const corretorNavItems = [
    { to: '/pdf-editor', label: 'Editor de PDF', icon: FileText },
    { to: '/receipt-generator', label: 'Gerador de Recibos', icon: Calculator },
    { to: '/cep-search', label: 'Buscador de CEP', icon: MapPin },
    { to: '/settings', label: 'Configurações', icon: SettingsIcon },
];

const adminNavItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: true },
    { to: '/clients', label: 'Clientes', icon: Users, adminOnly: true },
    { to: '/pdf-editor', label: 'Editor de PDF', icon: FileText },
    { to: '/receipt-generator', label: 'Gerador de Recibos', icon: Calculator },
    { to: '/cep-search', label: 'Buscador de CEP', icon: MapPin },
    { to: '/settings', label: 'Configurações', icon: SettingsIcon },
    { to: '/users', label: 'Gerenciar Usuários', icon: UserCog, adminOnly: true },
];

const NavLink = ({ to, icon: Icon, label, expanded }) => {
    const location = useLocation();
    const isActive = location.pathname === to;
    
    return (
        <Link 
            to={to} 
            className={`group flex items-center px-3 py-3 rounded-xl transition-all duration-300 relative overflow-hidden ${
                isActive 
                    ? 'bg-primary text-white shadow-lg' 
                    : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
            }`}
            title={!expanded ? label : ''}
        >
            {/* Indicador lateral para item ativo */}
            {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r-full animate-fade-in" />
            )}
            
            {/* Ícone com animação */}
            <Icon 
                className={`w-5 h-5 flex-shrink-0 transition-all duration-300 ${
                    expanded ? 'mr-3' : 'mx-auto'
                } ${
                    isActive 
                        ? 'scale-110' 
                        : 'group-hover:scale-110 group-hover:rotate-3'
                }`} 
            />
            
            {/* Label - aparece apenas quando expandido */}
            <span 
                className={`font-medium text-sm whitespace-nowrap transition-all duration-300 ${
                    expanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden'
                }`}
            >
                {label}
            </span>
            
            {/* Background hover animado */}
            {!isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
            )}
        </Link>
    );
};

const AppLayout = () => {
    const { logout, user, isAdmin, checkAuth, isAuthenticated } = useAuth();
    const location = useLocation();
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [sidebarExpanded, setSidebarExpanded] = useState(false);
    
    // Redireciona para login se deslogou
    useEffect(() => {
        if (!isAuthenticated) {
            window.location.href = '/login';
        }
    }, [isAuthenticated]);
    
    // Verifica se precisa trocar senha ao carregar
    useEffect(() => {
        if (user?.mustChangePassword) {
            setShowPasswordModal(true);
        }
    }, [user]);

    const handlePasswordChanged = async () => {
        setShowPasswordModal(false);
        // Recarrega os dados do usuário para atualizar o estado
        await checkAuth();
    };
    
    // Define itens de navegação com base no role do usuário
    const navItems = isAdmin() ? adminNavItems : corretorNavItems;
    
    const currentPage = navItems.find(item => item.to === location.pathname);

    return (
        <div id="app-structure" className="h-screen w-full flex">
            {/* Sidebar (Menu Lateral) - Overlay com expansão ao hover */}
            <aside 
                id="sidebar" 
                className={`fixed left-0 top-0 h-full bg-secondary text-white flex flex-col shadow-2xl z-50 transition-all duration-300 ${
                    sidebarExpanded ? 'w-64' : 'w-20'
                }`}
                onMouseEnter={() => setSidebarExpanded(true)}
                onMouseLeave={() => setSidebarExpanded(false)}
            >
                {/* Gradiente decorativo no topo */}
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/20 to-transparent pointer-events-none" />
                
                {/* Logo */}
                <div className="h-16 flex items-center justify-center border-b border-gray-700/50 px-4 relative z-10">
                    {sidebarExpanded ? (
                        <img src={logoLight} alt="Logo Motive" className="h-10 transition-all duration-300" />
                    ) : (
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center transition-all duration-300">
                            <span className="text-white font-bold text-lg">M</span>
                        </div>
                    )}
                </div>
                
                {/* Navegação */}
                <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto no-scrollbar relative z-10">
                    {navItems.map((item, index) => (
                        <div 
                            key={item.to} 
                            className="animate-fade-in"
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            <NavLink 
                                to={item.to} 
                                icon={item.icon} 
                                label={item.label}
                                expanded={sidebarExpanded}
                            />
                        </div>
                    ))}
                </nav>
                
                {/* Botão de Logout */}
                <div className="p-3 border-t border-gray-700/50 relative z-10">
                    <button 
                        onClick={logout} 
                        className={`group w-full flex items-center px-3 py-3 rounded-xl transition-all duration-300 text-gray-300 hover:text-white hover:bg-red-600/90 hover:shadow-lg`}
                        title={!sidebarExpanded ? 'Sair' : ''}
                    >
                         <LogOut 
                            className={`w-5 h-5 flex-shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-12 ${
                                sidebarExpanded ? 'mr-3' : 'mx-auto'
                            }`} 
                         />
                         <span 
                            className={`font-medium text-sm whitespace-nowrap transition-all duration-300 ${
                                sidebarExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden'
                            }`}
                         >
                            Sair
                         </span>
                    </button>
                </div>
                
                {/* Decoração de fundo */}
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
            </aside>
            
            {/* Conteúdo Principal - Agora com padding-left para compensar a sidebar */}
            <main className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50 pl-20 transition-all duration-300">
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 shadow-sm">
                    <div className="flex items-center gap-3">
                        {currentPage?.icon && (
                            <div className="p-2 bg-primary/10 rounded-xl">
                                <currentPage.icon className="w-5 h-5 text-primary" />
                            </div>
                        )}
                        <div>
                            <h1 id="page-title" className="text-xl font-bold text-gray-800">
                                {currentPage?.label || 'Sistema Motive'}
                            </h1>
                            {currentPage?.label === 'Clientes' && (
                                <p className="text-xs text-gray-500 mt-0.5">Visualize e gerencie o progresso dos financiamentos em tempo real</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="font-semibold text-sm text-gray-800">{user?.nome || 'Usuário'}</p>
                            <p className="text-xs text-gray-500">
                                {user?.email || ''} 
                                {user?.role && (
                                    <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary rounded-md text-[10px] font-medium">
                                        {user.role === 'ADM' ? 'Admin' : 'Corretor'}
                                    </span>
                                )}
                            </p>
                        </div>
                        <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold text-white">
                                {user?.nome?.charAt(0)?.toUpperCase() || 'U'}
                            </span>
                        </div>
                    </div>
                </header>
                
                <div className="flex-1 overflow-y-auto no-scrollbar">
                    {/* O conteúdo da página será renderizado aqui */}
                    <Outlet />
                </div>
            </main>

            {/* Modal de Troca de Senha Obrigatória */}
            {showPasswordModal && user && (
                <ChangePasswordModal
                    user={user}
                    onSuccess={handlePasswordChanged}
                />
            )}
        </div>
    );
};

export default AppLayout;
