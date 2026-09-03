import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AlertCircle,
    AlertTriangle,
    ArrowRight,
    Building2,
    CalendarDays,
    CheckCircle2,
    ChevronRight,
    Clock3,
    FileText,
    Home,
    MapPinned,
    RefreshCw,
    Sparkles,
    UserPlus,
    Users,
} from 'lucide-react';
import HealthCheck from '../components/HealthCheck';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { fetchClients, fetchProperties } from '../services/api';

const FINAL_STATUSES = ['Assinado-Movido', 'Assinado', 'Arquivado'];
const ATTENTION_STATUSES = ['Inconforme', 'Aguardando Reserva'];
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const FUNNEL_STAGES = [
    { label: 'Documentação', statuses: ['Documentação Recebida'], color: 'bg-slate-400' },
    { label: 'Aprovação', statuses: ['Aprovado'], color: 'bg-emerald-500' },
    { label: 'Engenharia', statuses: ['Solicitando Engenharia', 'Engenharia Solicitada'], color: 'bg-amber-500' },
    { label: 'Fichas e finalização', statuses: ['Baixando FGTS', 'Preenchendo Fichas', 'Assinando Fichas', 'Finalizando'], color: 'bg-sky-500' },
    { label: 'Conformidade', statuses: ['Aguardando Reserva', 'Enviando para Conformidade', 'Aguardando Conformidade', 'Inconforme', 'Conforme - Ag. Contrato'], color: 'bg-violet-500' },
    { label: 'Contrato', statuses: ['Assinando Contrato'], color: 'bg-primary' },
];

const QUICK_ACTIONS = [
    { label: 'Novo cliente', description: 'Iniciar atendimento', to: '/clients?new=1', icon: UserPlus, tone: 'bg-primary text-white shadow-primary/20' },
    { label: 'Simular crédito', description: 'Abrir simulador', to: '/simulador', icon: Building2, tone: 'bg-white text-gray-700' },
    { label: 'Gerar contrato', description: 'Criar documento', to: '/contract-generator', icon: FileText, tone: 'bg-white text-gray-700' },
    { label: 'Mapa de imóveis', description: 'Consultar opções', to: '/properties-map', icon: MapPinned, tone: 'bg-white text-gray-700' },
];

const safeDate = value => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const daysSince = value => {
    const date = safeDate(value);
    return date ? Math.max(0, Math.floor((Date.now() - date.getTime()) / DAY_IN_MS)) : null;
};

const formatRelativeTime = value => {
    const date = safeDate(value);
    if (!date) return 'agora';
    const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
    if (minutes < 1) return 'agora';
    if (minutes < 60) return `há ${minutes} min`;
    if (minutes < 1440) return `há ${Math.floor(minutes / 60)} h`;
    const days = Math.floor(minutes / 1440);
    return `há ${days} dia${days === 1 ? '' : 's'}`;
};

const formatLongDate = date => new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
}).format(date);

const activityLabel = action => ({
    created: 'cadastrou',
    updated: 'atualizou',
    status_changed: 'alterou o status de',
    deleted: 'excluiu',
}[action] || 'atualizou');

const MetricCard = props => {
    const Icon = props.icon;
    return (
    <Link
        to={props.to}
        className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    >
        <div className="flex items-start justify-between gap-4">
            <div>
                <p className="text-sm font-medium text-gray-500">{props.label}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">{props.value}</p>
            </div>
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${props.tone}`}>
                <Icon size={21} />
            </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
            <span className="truncate text-xs text-gray-500">{props.helper}</span>
            <ChevronRight size={15} className="shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>
    </Link>
    );
};

const Dashboard = () => {
    const { user } = useAuth();
    const [clients, setClients] = useState([]);
    const [properties, setProperties] = useState([]);
    const [activities, setActivities] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const loadDashboardData = async () => {
        setIsLoading(true);
        setError('');
        try {
            const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? window.location.origin : 'http://localhost:3000');
            const [clientData, propertyData, activityResponse] = await Promise.all([
                fetchClients(),
                fetchProperties(),
                fetch(`${API_BASE_URL}/api/activities/recent?limit=6`, { credentials: 'include' }),
            ]);
            setClients(Array.isArray(clientData) ? clientData : []);
            setProperties(Array.isArray(propertyData) ? propertyData : []);
            if (activityResponse.ok) setActivities(await activityResponse.json());
        } catch (loadError) {
            console.error('Erro ao carregar o dashboard:', loadError);
            setError('Não foi possível carregar todos os dados do painel.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadDashboardData();
    }, []);

    const dashboard = useMemo(() => {
        const active = clients.filter(client => !FINAL_STATUSES.includes(client.status));
        const operational = active.filter(client => !client.emEspera);
        const waitingAction = operational.filter(client => ATTENTION_STATUSES.includes(client.status));
        const stalled = operational.filter(client => {
            const age = daysSince(client.ultimaAtualizacao || client.updatedAt || client.createdAt);
            return age !== null && age >= 7;
        });
        const today = new Date();
        const signedThisMonth = clients.filter(client => {
            if (!['Assinado-Movido', 'Assinado'].includes(client.status)) return false;
            const signedAt = safeDate(client.dataAssinaturaContrato || client.ultimaAtualizacao || client.updatedAt);
            return signedAt && signedAt.getMonth() === today.getMonth() && signedAt.getFullYear() === today.getFullYear();
        });
        const overdueProperties = properties.filter(property => {
            if (property.status === 'Confirmar disponibilidade') return true;
            if (property.status !== 'Disponível') return false;
            const age = daysSince(property.lastAvailabilityCheck);
            return age === null || age >= 15;
        });

        const stalledIds = new Set(stalled.map(client => client.id));
        const priorityClients = operational
            .filter(client => ATTENTION_STATUSES.includes(client.status) || stalledIds.has(client.id))
            .map(client => ({
                id: `client-${client.id}`,
                title: client.nome || 'Cliente sem nome',
                description: client.status === 'Inconforme'
                    ? 'Pendência de conformidade'
                    : client.status === 'Aguardando Reserva'
                        ? 'Aguardando reserva do imóvel'
                        : `Sem atualização há ${daysSince(client.ultimaAtualizacao || client.updatedAt || client.createdAt)} dias`,
                status: client.status,
                kind: client.status === 'Inconforme' ? 'danger' : client.status === 'Aguardando Reserva' ? 'warning' : 'neutral',
                to: `/clients?client=${client.id}`,
                score: client.status === 'Inconforme' ? 3 : client.status === 'Aguardando Reserva' ? 2 : 1,
            }));

        const priorityProperties = overdueProperties.slice(0, 4).map(property => ({
            id: `property-${property.id}`,
            title: property.title || property.code || 'Imóvel sem título',
            description: property.status === 'Confirmar disponibilidade'
                ? 'Disponibilidade precisa ser confirmada'
                : property.lastAvailabilityCheck
                    ? `Disponibilidade sem revisão há ${daysSince(property.lastAvailabilityCheck)} dias`
                    : 'Disponibilidade ainda não revisada',
            status: 'Mapa',
            kind: 'property',
            to: `/properties-map?property=${property.id}`,
            score: property.status === 'Confirmar disponibilidade' ? 2 : 1,
        }));

        const priorities = [...priorityClients, ...priorityProperties]
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);

        const funnel = FUNNEL_STAGES.map(stage => ({
            ...stage,
            count: operational.filter(client => stage.statuses.includes(client.status)).length,
        }));

        return { active, operational, waitingAction, stalled, signedThisMonth, overdueProperties, priorities, funnel };
    }, [clients, properties]);

    if (isLoading) {
        return (
            <div className="space-y-5 p-4 sm:p-6">
                <div className="h-28 animate-pulse rounded-2xl bg-gray-200" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[1, 2, 3, 4].map(item => <div key={item} className="h-36 animate-pulse rounded-2xl bg-gray-200" />)}
                </div>
                <div className="grid gap-5 xl:grid-cols-3">
                    <div className="h-96 animate-pulse rounded-2xl bg-gray-200 xl:col-span-2" />
                    <div className="h-96 animate-pulse rounded-2xl bg-gray-200" />
                </div>
            </div>
        );
    }

    const firstName = user?.nome?.trim().split(/\s+/)[0] || 'bem-vindo';
    const maxFunnelCount = Math.max(...dashboard.funnel.map(stage => stage.count), 1);

    return (
        <div className="min-h-full bg-gray-50/70 p-4 sm:p-6">
            <div className="mx-auto max-w-[1600px] space-y-5">
                <HealthCheck />

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-800 via-slate-700 to-primary shadow-sm">
                    <div className="relative px-5 py-6 sm:px-7">
                        <div className="absolute -right-16 -top-24 h-60 w-60 rounded-full bg-white/10 blur-2xl" />
                        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                            <div className="text-white">
                                <p className="text-sm font-medium capitalize text-white/65">{formatLongDate(new Date())}</p>
                                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Olá, {firstName}. Aqui está o que pede atenção.</h1>
                                <p className="mt-2 max-w-2xl text-sm text-white/70">Acompanhe clientes, pendências e imóveis em um único painel de trabalho.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {QUICK_ACTIONS.map(action => {
                                    const QuickIcon = action.icon;
                                    return (
                                    <Link key={action.label} to={action.to} className={`group flex min-w-0 items-center gap-3 rounded-xl border border-white/15 px-3 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${action.tone}`}>
                                        <QuickIcon size={19} className="shrink-0" />
                                        <span className="min-w-0">
                                            <span className="block truncate text-xs font-bold">{action.label}</span>
                                            <span className={`hidden truncate text-[10px] sm:block ${action.tone.includes('text-white') ? 'text-white/65' : 'text-gray-400'}`}>{action.description}</span>
                                        </span>
                                    </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </section>

                {error && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <span className="flex items-center gap-2"><AlertCircle size={17} />{error}</span>
                        <button type="button" onClick={loadDashboardData} className="inline-flex items-center gap-1.5 font-semibold hover:underline"><RefreshCw size={15} />Tentar novamente</button>
                    </div>
                )}

                <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="Clientes ativos" value={dashboard.active.length} helper={`${dashboard.operational.length} em andamento`} icon={Users} tone="bg-blue-50 text-primary" to="/clients" />
                    <MetricCard label="Aguardando ação" value={dashboard.waitingAction.length} helper="Inconformes ou aguardando reserva" icon={AlertTriangle} tone="bg-red-50 text-red-600" to="/clients" />
                    <MetricCard label="Parados há 7+ dias" value={dashboard.stalled.length} helper="Clientes sem atualização recente" icon={Clock3} tone="bg-amber-50 text-amber-600" to="/clients" />
                    <MetricCard label="Assinados no mês" value={dashboard.signedThisMonth.length} helper="Contratos concluídos neste mês" icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" to="/clients" />
                </section>

                <section className="grid gap-5 xl:grid-cols-3">
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm xl:col-span-2">
                        <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-4">
                            <div>
                                <div className="flex items-center gap-2"><Sparkles size={19} className="text-amber-500" /><h2 className="font-bold text-gray-900">Prioridades de hoje</h2></div>
                                <p className="mt-1 text-xs text-gray-500">Pendências organizadas por urgência</p>
                            </div>
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">{dashboard.priorities.length}</span>
                        </div>

                        <div className="divide-y divide-gray-100">
                            {dashboard.priorities.length > 0 ? dashboard.priorities.map(item => {
                                const itemStyle = item.kind === 'danger'
                                    ? { icon: AlertCircle, box: 'bg-red-50 text-red-600', accent: 'bg-red-500' }
                                    : item.kind === 'warning'
                                        ? { icon: CalendarDays, box: 'bg-amber-50 text-amber-600', accent: 'bg-amber-500' }
                                        : item.kind === 'property'
                                            ? { icon: Home, box: 'bg-violet-50 text-violet-600', accent: 'bg-violet-500' }
                                            : { icon: Clock3, box: 'bg-slate-100 text-slate-600', accent: 'bg-slate-400' };
                                const ItemIcon = itemStyle.icon;
                                return (
                                    <Link key={item.id} to={item.to} className="group relative flex items-center gap-3 px-5 py-3.5 transition hover:bg-gray-50">
                                        <span className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${itemStyle.accent}`} />
                                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${itemStyle.box}`}><ItemIcon size={17} /></span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold text-gray-900">{item.title}</span>
                                            <span className="mt-0.5 block truncate text-xs text-gray-500">{item.description}</span>
                                        </span>
                                        <StatusBadge status={item.status} size="xs" />
                                        <ChevronRight size={16} className="shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                                    </Link>
                                );
                            }) : (
                                <div className="px-6 py-14 text-center">
                                    <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
                                    <p className="mt-3 text-sm font-semibold text-gray-800">Nenhuma prioridade pendente</p>
                                    <p className="mt-1 text-xs text-gray-500">Tudo em dia por aqui.</p>
                                </div>
                            )}
                        </div>

                        {dashboard.priorities.length > 0 && (
                            <div className="border-t border-gray-100 bg-gray-50/70 px-5 py-3 text-right">
                                <Link to="/clients" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">Ver todos os clientes <ArrowRight size={14} /></Link>
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div><h2 className="font-bold text-gray-900">Funil de atendimento</h2><p className="mt-1 text-xs text-gray-500">{dashboard.operational.length} processos em andamento</p></div>
                            <Users size={19} className="text-primary" />
                        </div>
                        <div className="mt-5 space-y-4">
                            {dashboard.funnel.map(stage => (
                                <div key={stage.label}>
                                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="font-medium text-gray-600">{stage.label}</span><span className="font-bold text-gray-900">{stage.count}</span></div>
                                    <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full transition-all duration-700 ${stage.color}`} style={{ width: `${Math.max(stage.count ? 8 : 0, (stage.count / maxFunnelCount) * 100)}%` }} /></div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-5 rounded-xl border border-violet-100 bg-violet-50 px-3.5 py-3">
                            <div className="flex items-center justify-between"><span className="text-xs font-medium text-violet-700">Imóveis a revisar</span><span className="text-lg font-bold text-violet-900">{dashboard.overdueProperties.length}</span></div>
                            <Link to="/properties-map" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:underline">Abrir mapa <ArrowRight size={13} /></Link>
                        </div>
                    </div>
                </section>

                <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                        <div><h2 className="font-bold text-gray-900">Atividade recente</h2><p className="mt-1 text-xs text-gray-500">Últimas movimentações da equipe</p></div>
                        <Clock3 size={18} className="text-gray-400" />
                    </div>
                    {activities.length > 0 ? (
                        <div className="grid divide-y divide-gray-100 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-3">
                            {activities.map((activity, index) => (
                                <Link key={`${activity.id}-${index}`} to={`/clients?client=${activity.clientId}`} className="group flex min-w-0 items-start gap-3 px-5 py-4 transition hover:bg-gray-50">
                                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Users size={15} /></span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm text-gray-700"><strong className="font-semibold text-gray-900">{activity.userName}</strong> {activityLabel(activity.action)} <strong className="font-semibold text-gray-900">{activity.clientNome}</strong></span>
                                        <span className="mt-1 block truncate text-xs text-gray-400">{activity.action === 'status_changed' ? `${activity.statusAntes || 'Sem status'} → ${activity.statusDepois || 'Sem status'} · ` : ''}{formatRelativeTime(activity.createdAt)}</span>
                                    </span>
                                </Link>
                            ))}
                        </div>
                    ) : <p className="px-5 py-8 text-center text-sm text-gray-400">Nenhuma atividade recente.</p>}
                </section>
            </div>
        </div>
    );
};

export default Dashboard;
