import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, LayoutDashboard, Users, FileText, Calculator, MapPin, Settings as SettingsIcon } from 'lucide-react';
import logoLight from '../assets/logo-light.png';

const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/clients', label: 'Clientes', icon: Users },
    { to: '/pdf-editor', label: 'Editor de PDF', icon: FileText },
    { to: '/receipt-generator', label: 'Gerador de Recibos', icon: Calculator },
    { to: '/cep-search', label: 'Buscador de CEP', icon: MapPin },
    { to: '/settings', label: 'Configurações', icon: SettingsIcon },
];

const NavLink = ({ to, children }) => {
    const location = useLocation();
    const isActive = location.pathname === to;
    const activeClass = 'bg-gray-700 text-white';
    const inactiveClass = 'hover:bg-gray-700 text-gray-300';
    return (
        <Link to={to} className={`flex items-center px-4 py-2 rounded-lg transition-colors duration-200 ${isActive ? activeClass : inactiveClass}`}>
            {children}
        </Link>
    );
};

const AppLayout = () => {
    const { logout } = useAuth();
    const location = useLocation();
    
    const currentPage = navItems.find(item => item.to === location.pathname);

    return (
        <div id="app-structure" className="h-screen w-full flex">
            {/* Sidebar (Menu Lateral) */}
            <aside id="sidebar" className="w-64 bg-secondary text-white flex flex-col shrink-0">
                <div className="h-16 flex items-center justify-center border-b border-gray-700 px-4">
                     <img src={logoLight} alt="Logo Motive" className="h-10" />
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map(item => (
                        <NavLink key={item.to} to={item.to}>
                            <item.icon className="w-5 h-5 mr-3" />
                            <span className="sidebar-text">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>
                <div className="p-4 border-t border-gray-700">
                    <button onClick={logout} className="w-full flex items-center px-4 py-2 rounded-lg hover:bg-red-700 text-gray-300">
                         <LogOut className="w-5 h-5 mr-3" />
                         <span>Sair</span>
                    </button>
                </div>
            </aside>
            
            {/* Conteúdo Principal */}
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-6 shrink-0">
                    <h1 id="page-title" className="text-xl font-semibold text-secondary">
                        {currentPage?.label || 'Sistema Motive'}
                    </h1>
                    <div className="text-right">
                        <p className="font-semibold text-sm text-secondary">Gerenciamento</p>
                        <p className="text-xs text-text-secondary">motiveimoveis@gmail.com</p>
                    </div>
                </header>
                
                <div className="flex-1 overflow-y-auto no-scrollbar">
                    {/* O conteúdo da página será renderizado aqui */}
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AppLayout;
