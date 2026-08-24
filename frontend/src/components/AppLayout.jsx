import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, LayoutDashboard, Users, FileText, FileSignature, Calculator, Landmark, MapPin, MapPinned, Pin, PinOff, Settings as SettingsIcon, UserCog } from 'lucide-react';
import logoLight from '../assets/logo-light.png';
import ChangePasswordModal from './ChangePasswordModal';

const corretorNavItems = [
    { to: '/properties-map', label: 'Mapa de Imóveis', icon: MapPinned, group: 'Operação' },
    { to: '/simulador', label: 'Simulador Habitacional', icon: Landmark, group: 'Ferramentas comerciais' },
    { to: '/receipt-generator', label: 'Gerador de Recibos', icon: Calculator, group: 'Ferramentas comerciais' },
    { to: '/contract-generator', label: 'Gerador de Contratos', icon: FileSignature, group: 'Ferramentas comerciais' },
    { to: '/pdf-editor', label: 'Editor de PDF', icon: FileText, group: 'Documentos' },
    { to: '/cep-search', label: 'Buscador de CEP', icon: MapPin, group: 'Documentos' },
    { to: '/settings', label: 'Configurações', icon: SettingsIcon, group: 'Administração' },
];

const assistenteNavItems = [
    { to: '/clients', label: 'Clientes', icon: Users, group: 'Operação' },
    { to: '/properties-map', label: 'Mapa de Imóveis', icon: MapPinned, group: 'Operação' },
    { to: '/simulador', label: 'Simulador Habitacional', icon: Landmark, group: 'Ferramentas comerciais' },
    { to: '/receipt-generator', label: 'Gerador de Recibos', icon: Calculator, group: 'Ferramentas comerciais' },
    { to: '/contract-generator', label: 'Gerador de Contratos', icon: FileSignature, group: 'Ferramentas comerciais' },
    { to: '/pdf-editor', label: 'Editor de PDF', icon: FileText, group: 'Documentos' },
    { to: '/cep-search', label: 'Buscador de CEP', icon: MapPin, group: 'Documentos' },
    { to: '/settings', label: 'Configurações', icon: SettingsIcon, group: 'Administração' },
];

const adminNavItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Operação' },
    { to: '/clients', label: 'Clientes', icon: Users, group: 'Operação' },
    { to: '/properties-map', label: 'Mapa de Imóveis', icon: MapPinned, group: 'Operação' },
    { to: '/simulador', label: 'Simulador Habitacional', icon: Landmark, group: 'Ferramentas comerciais' },
    { to: '/receipt-generator', label: 'Gerador de Recibos', icon: Calculator, group: 'Ferramentas comerciais' },
    { to: '/contract-generator', label: 'Gerador de Contratos', icon: FileSignature, group: 'Ferramentas comerciais' },
    { to: '/pdf-editor', label: 'Editor de PDF', icon: FileText, group: 'Documentos' },
    { to: '/cep-search', label: 'Buscador de CEP', icon: MapPin, group: 'Documentos' },
    { to: '/settings', label: 'Configurações', icon: SettingsIcon, group: 'Administração' },
    { to: '/users', label: 'Gerenciar Usuários', icon: UserCog, group: 'Administração' },
];

const pageDescriptions = {
    '/dashboard': 'Acompanhe os principais indicadores e atividades da operação.',
    '/clients': 'Visualize e gerencie o progresso dos financiamentos em tempo real.',
    '/properties-map': 'Localize, organize e atualize os imóveis disponíveis no mapa.',
    '/simulador': 'Compare condições de financiamento e gere propostas para seus clientes.',
    '/receipt-generator': 'Calcule valores e gere recibos de pró-labore em PDF.',
    '/contract-generator': 'Preencha, revise e gere contratos de compra e venda em Word.',
    '/pdf-editor': 'Edite e prepare documentos em PDF para os seus processos.',
    '/cep-search': 'Consulte endereços completos a partir do CEP.',
    '/settings': 'Ajuste as preferências e configurações do sistema.',
    '/users': 'Cadastre usuários e controle os acessos da equipe.',
};

const NavLink = ({ to, icon, label, expanded }) => {
    const location = useLocation();
    const isActive = location.pathname === to;
    const IconComponent = icon;
    
    return (
        <Link 
            to={to} 
            className={`group relative flex items-center overflow-hidden rounded-xl px-3 py-2.5 transition-colors duration-200 ${
                isActive 
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
            title={!expanded ? label : ''}
        >
            {/* Indicador lateral para item ativo */}
            {isActive && (
                <div className="absolute bottom-2 left-0 top-2 w-0.5 rounded-r-full bg-white/90" />
            )}
            
            {/* Ícone com animação */}
            <IconComponent
                className={`h-5 w-5 flex-shrink-0 transition-[margin] duration-200 ${
                    expanded ? 'mr-3' : 'mx-auto'
                }`} 
            />
            
            {/* Label - aparece apenas quando expandido */}
            <span 
                className={`whitespace-nowrap text-sm font-medium transition-all duration-200 ${
                    expanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden'
                }`}
            >
                {label}
            </span>
            
        </Link>
    );
};

const AppLayout = () => {
    const { logout, user, checkAuth, isAuthenticated } = useAuth();
    const location = useLocation();
    const [sidebarHovered, setSidebarHovered] = useState(false);
    const [sidebarPinned, setSidebarPinned] = useState(() => {
        try {
            return window.localStorage.getItem('motive-sidebar-pinned') === 'true';
        } catch {
            return false;
        }
    });
    const sidebarExpanded = sidebarPinned || sidebarHovered;
    const showPasswordModal = Boolean(user?.mustChangePassword);
    
    // Redireciona para login se deslogou
    useEffect(() => {
        if (!isAuthenticated) {
            window.location.href = '/login';
        }
    }, [isAuthenticated]);
    
    const handlePasswordChanged = async () => {
        // Recarrega os dados do usuário para atualizar o estado
        await checkAuth();
    };
    
    // Define itens de navegação com base no role do usuário
    let navItems;
    if (user?.role === 'ADM') {
        navItems = adminNavItems;
    } else if (user?.role === 'ASSISTENTE') {
        navItems = assistenteNavItems;
    } else {
        navItems = corretorNavItems;
    }
    
    const currentPage = navItems.find(item => item.to === location.pathname);
    const navGroups = navItems.reduce((groups, item) => {
        const group = groups.find(entry => entry.label === item.group);
        if (group) group.items.push(item);
        else groups.push({ label: item.group, items: [item] });
        return groups;
    }, []);

    const toggleSidebarPinned = () => {
        setSidebarPinned(current => {
            const next = !current;
            try {
                window.localStorage.setItem('motive-sidebar-pinned', String(next));
            } catch {
                // O menu continua funcionando mesmo quando o navegador bloqueia o armazenamento local.
            }
            return next;
        });
    };

    return (
        <div id="app-structure" className="h-screen w-full flex">
            {/* Sidebar (Menu Lateral) - Overlay com expansão ao hover */}
            <aside 
                id="sidebar" 
                className={`fixed left-0 top-0 h-full bg-secondary text-white flex flex-col shadow-2xl z-50 transition-all duration-300 ${
                    sidebarExpanded ? 'w-64' : 'w-20'
                }`}
                onMouseEnter={() => setSidebarHovered(true)}
                onMouseLeave={() => setSidebarHovered(false)}
            >
                {/* Gradiente decorativo no topo */}
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/20 to-transparent pointer-events-none" />
                
                {/* Logo */}
                <div className={`relative z-10 flex h-16 items-center border-b border-gray-700/50 px-4 ${sidebarExpanded ? 'justify-between' : 'justify-center'}`}>
                    {sidebarExpanded ? (
                        <>
                            <img src={logoLight} alt="Logo Motive" className="h-9 max-w-[164px] object-contain transition-all duration-200" />
                            <button type="button" onClick={toggleSidebarPinned} className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${sidebarPinned ? 'bg-primary text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`} title={sidebarPinned ? 'Soltar menu lateral' : 'Manter menu aberto'} aria-label={sidebarPinned ? 'Soltar menu lateral' : 'Manter menu aberto'}>
                                {sidebarPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                            </button>
                        </>
                    ) : (
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center transition-all duration-300">
                            <span className="text-white font-bold text-lg">M</span>
                        </div>
                    )}
                </div>
                
                {/* Navegação */}
                <nav className="no-scrollbar relative z-10 flex-1 overflow-y-auto p-3">
                    {navGroups.map((group, groupIndex) => (
                        <section key={group.label} className={groupIndex === 0 ? '' : 'mt-3'}>
                            {sidebarExpanded ? (
                                <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">{group.label}</p>
                            ) : groupIndex > 0 ? (
                                <div className="mx-2 mb-2 border-t border-white/10" />
                            ) : null}
                            <div className="space-y-1">
                                {group.items.map(item => (
                                    <NavLink
                                        key={item.to}
                                        to={item.to}
                                        icon={item.icon}
                                        label={item.label}
                                        expanded={sidebarExpanded}
                                    />
                                ))}
                            </div>
                        </section>
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
            <main className={`flex h-full flex-1 flex-col overflow-hidden bg-gray-50 transition-[padding] duration-300 ${sidebarPinned ? 'pl-64' : 'pl-20'}`}>
                <header className="h-[72px] bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
                    <div className="flex min-w-0 items-center gap-3">
                        {currentPage?.icon && (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/5">
                                <currentPage.icon className="h-5 w-5 text-primary" />
                            </div>
                        )}
                        <div className="min-w-0">
                            <h1 id="page-title" className="truncate text-lg font-bold leading-tight text-gray-900">
                                {currentPage?.label || 'Sistema Motive'}
                            </h1>
                            <p className="mt-1 truncate text-xs text-gray-500">
                                {pageDescriptions[location.pathname] || 'Ferramentas para a operação da Motive.'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="font-semibold text-sm text-gray-800">{user?.nome || 'Usuário'}</p>
                            <p className="text-xs text-gray-500">
                                {user?.email || ''} 
                                {user?.role && (
                                    <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary rounded-md text-[10px] font-medium">
                                        {user.role === 'ADM' ? 'Admin' : user.role === 'ASSISTENTE' ? 'Assistente' : 'Corretor'}
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
