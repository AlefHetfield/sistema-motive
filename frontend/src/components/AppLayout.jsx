import { useState, useEffect, useRef } from 'react';
import { Menu, X } from 'lucide-react';
import useMobileLayout from '../hooks/useMobileLayout';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, LayoutDashboard, Users, FileText, FileSignature, Calculator, Landmark, MapPin, MapPinned, ListTodo, FileSearch, Pin, PinOff, Settings as SettingsIcon, UserCog } from 'lucide-react';
import logoLight from '../assets/logo-light.png';
import ChangePasswordModal from './ChangePasswordModal';
import TaskNotifications from './TaskNotifications';

const corretorNavItems = [
    { to: '/tasks', label: 'Tarefas', icon: ListTodo, group: 'Operação' },
    { to: '/properties-map', label: 'Mapa de Imóveis', icon: MapPinned, group: 'Operação' },
    { to: '/simulador', label: 'Simulador Habitacional', icon: Landmark, group: 'Ferramentas comerciais' },
    { to: '/receipt-generator', label: 'Gerador de Recibos', icon: Calculator, group: 'Ferramentas comerciais' },
    { to: '/contract-generator', label: 'Gerador de Contratos', icon: FileSignature, group: 'Ferramentas comerciais' },
    { to: '/pdf-editor', label: 'Editor de PDF', icon: FileText, group: 'Documentos' },
    { to: '/matriculas', label: 'Buscador de Matrículas', icon: FileSearch, group: 'Documentos' },
    { to: '/cep-search', label: 'Buscador de CEP', icon: MapPin, group: 'Documentos' },
    { to: '/settings', label: 'Configurações', icon: SettingsIcon, group: 'Administração' },
];

const assistenteNavItems = [
    { to: '/clients', label: 'Clientes', icon: Users, group: 'Operação' },
    { to: '/tasks', label: 'Tarefas', icon: ListTodo, group: 'Operação' },
    { to: '/properties-map', label: 'Mapa de Imóveis', icon: MapPinned, group: 'Operação' },
    { to: '/simulador', label: 'Simulador Habitacional', icon: Landmark, group: 'Ferramentas comerciais' },
    { to: '/receipt-generator', label: 'Gerador de Recibos', icon: Calculator, group: 'Ferramentas comerciais' },
    { to: '/contract-generator', label: 'Gerador de Contratos', icon: FileSignature, group: 'Ferramentas comerciais' },
    { to: '/pdf-editor', label: 'Editor de PDF', icon: FileText, group: 'Documentos' },
    { to: '/matriculas', label: 'Buscador de Matrículas', icon: FileSearch, group: 'Documentos' },
    { to: '/cep-search', label: 'Buscador de CEP', icon: MapPin, group: 'Documentos' },
    { to: '/settings', label: 'Configurações', icon: SettingsIcon, group: 'Administração' },
];

const adminNavItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Operação' },
    { to: '/clients', label: 'Clientes', icon: Users, group: 'Operação' },
    { to: '/tasks', label: 'Tarefas', icon: ListTodo, group: 'Operação' },
    { to: '/properties-map', label: 'Mapa de Imóveis', icon: MapPinned, group: 'Operação' },
    { to: '/simulador', label: 'Simulador Habitacional', icon: Landmark, group: 'Ferramentas comerciais' },
    { to: '/receipt-generator', label: 'Gerador de Recibos', icon: Calculator, group: 'Ferramentas comerciais' },
    { to: '/contract-generator', label: 'Gerador de Contratos', icon: FileSignature, group: 'Ferramentas comerciais' },
    { to: '/pdf-editor', label: 'Editor de PDF', icon: FileText, group: 'Documentos' },
    { to: '/matriculas', label: 'Buscador de Matrículas', icon: FileSearch, group: 'Documentos' },
    { to: '/cep-search', label: 'Buscador de CEP', icon: MapPin, group: 'Documentos' },
    { to: '/settings', label: 'Configurações', icon: SettingsIcon, group: 'Administração' },
    { to: '/users', label: 'Gerenciar Usuários', icon: UserCog, group: 'Administração' },
];

const pageDescriptions = {
    '/dashboard': 'Acompanhe os principais indicadores e atividades da operação.',
    '/clients': 'Visualize e gerencie o progresso dos financiamentos em tempo real.',
    '/tasks': 'Organize tarefas, responsáveis e pendências dos clientes.',
    '/properties-map': 'Localize, organize e atualize os imóveis disponíveis no mapa.',
    '/simulador': 'Compare condições de financiamento e gere propostas para seus clientes.',
    '/receipt-generator': 'Calcule valores e gere recibos de pró-labore em PDF.',
    '/contract-generator': 'Preencha, revise e gere contratos de compra e venda em Word.',
    '/pdf-editor': 'Edite e prepare documentos em PDF para os seus processos.',
    '/matriculas': 'Encontre matrículas por rua, número, bairro, lote e quadra.',
    '/cep-search': 'Consulte endereços completos a partir do CEP.',
    '/settings': 'Ajuste as preferências e configurações do sistema.',
    '/users': 'Cadastre usuários e controle os acessos da equipe.',
};

const NavLink = ({ to, icon, label, expanded, onNavigate }) => {
    const location = useLocation();
    const isActive = location.pathname === to;
    const IconComponent = icon;
    
    return (
        <Link 
            to={to} 
            onClick={onNavigate}
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
    const mobile = useMobileLayout();
    const [mobileMenu, setMobileMenu] = useState(false);
    const sidebarRef = useRef(null);
    const menuButtonRef = useRef(null);
    const mobileOpen = mobile && mobileMenu === location.key;
    useEffect(() => {
        const media = window.matchMedia('(max-width: 1023px)');
        const close = () => setMobileMenu(false);
        media.addEventListener('change', close);
        return () => media.removeEventListener('change', close);
    }, []);
    useEffect(() => {
        if (!mobileOpen) return;
        const trigger = menuButtonRef.current;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        sidebarRef.current?.querySelector('button')?.focus();
        const keyboard = event => {
            if (event.key === 'Escape') { event.preventDefault(); setMobileMenu(false); }
            if (event.key === 'Tab') {
                const nodes = sidebarRef.current?.querySelectorAll('a[href], button:not([disabled])');
                if (!nodes?.length) return;
                const first = nodes[0], last = nodes[nodes.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
        };
        document.addEventListener('keydown', keyboard);
        return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keyboard); trigger?.focus(); };
    }, [mobileOpen]);
    const [sidebarHovered, setSidebarHovered] = useState(false);
    const [sidebarPinned, setSidebarPinned] = useState(() => {
        try {
            return window.localStorage.getItem('motive-sidebar-pinned') === 'true';
        } catch {
            return false;
        }
    });
    const sidebarExpanded = mobile || sidebarPinned || sidebarHovered;
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
        <div id="app-structure" className="flex h-dvh w-full min-w-0 overflow-hidden">
            {mobileOpen && <button type="button" tabIndex={-1} aria-label="Fechar menu" onClick={() => setMobileMenu(false)} className="fixed inset-0 z-[79] bg-slate-950/50" />}
            {/* Sidebar (Menu Lateral) - Overlay com expansão ao hover */}
            <aside 
                id="sidebar" 
                ref={sidebarRef}
                inert={mobile && !mobileOpen}
                aria-label="Menu principal"
                role={mobileOpen ? 'dialog' : undefined}
                aria-modal={mobileOpen || undefined}
                className={`fixed left-0 top-0 h-dvh bg-secondary text-white flex flex-col shadow-2xl transition-all duration-200 ${
                    mobile ? `z-[80] w-[min(20rem,85vw)] ${mobileOpen ? 'translate-x-0' : '-translate-x-full invisible'}` : `z-50 ${sidebarExpanded ? 'w-64' : 'w-20'}`
                }`}
                onMouseEnter={() => { if (!mobile) setSidebarHovered(true); }}
                onMouseLeave={() => setSidebarHovered(false)}
            >
                {/* Gradiente decorativo no topo */}
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/20 to-transparent pointer-events-none" />
                
                {/* Logo */}
                <div className={`relative z-10 flex h-16 items-center border-b border-gray-700/50 px-4 ${sidebarExpanded ? 'justify-between' : 'justify-center'}`}>
                    {sidebarExpanded ? (
                        <>
                            <img src={logoLight} alt="Logo Motive" className="h-9 max-w-[164px] object-contain transition-all duration-200" />
                            <button type="button" onClick={mobile ? () => setMobileMenu(false) : toggleSidebarPinned} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors ${sidebarPinned && !mobile ? 'bg-primary text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`} title={mobile ? 'Fechar menu' : sidebarPinned ? 'Soltar menu lateral' : 'Manter menu aberto'} aria-label={mobile ? 'Fechar menu' : sidebarPinned ? 'Soltar menu lateral' : 'Manter menu aberto'}>
                                {mobile ? <X size={22} /> : sidebarPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
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
                                        onNavigate={() => setMobileMenu(false)}
                                    />
                                ))}
                            </div>
                        </section>
                    ))}
                </nav>
                
                {/* Botão de Logout */}
                <div className="p-3 border-t border-gray-700/50 relative z-10">
                    {mobile && <div className="mb-2 px-3 text-sm"><p className="truncate font-semibold text-white">{user?.nome}</p><p className="break-all text-xs text-gray-400">{user?.email}</p></div>}
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
            <main inert={mobileOpen} className={`flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-50 transition-[padding] duration-200 ${mobile ? 'pl-0' : sidebarPinned ? 'pl-64' : 'pl-20'}`}>
                <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 lg:h-[72px] lg:px-6">
                    {mobile && <button ref={menuButtonRef} type="button" onClick={() => setMobileMenu(location.key)} aria-label="Abrir menu" aria-expanded={mobileOpen} aria-controls="sidebar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-primary hover:bg-gray-100"><Menu size={23} /></button>}
                    <div className="flex min-w-0 items-center gap-3">
                        {currentPage?.icon && (
                            <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/5 lg:flex">
                                <currentPage.icon className="h-5 w-5 text-primary" />
                            </div>
                        )}
                        <div className="min-w-0">
                            <h1 id="page-title" className="truncate text-lg font-bold leading-tight text-gray-900">
                                {currentPage?.label || 'Sistema Motive'}
                            </h1>
                            <p className="mt-1 hidden truncate text-xs text-gray-500 lg:block">
                                {pageDescriptions[location.pathname] || 'Ferramentas para a operação da Motive.'}
                            </p>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 lg:gap-4">
                        {isAuthenticated && user?.id && <TaskNotifications key={user.id} />}
                        <div className="hidden text-right lg:block">
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
                        <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary lg:flex">
                            <span className="text-sm font-bold text-white">
                                {user?.nome?.charAt(0)?.toUpperCase() || 'U'}
                            </span>
                        </div>
                    </div>
                </header>
                
                <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain no-scrollbar">
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
