import { useState, useEffect } from 'react';
import { fetchClients } from '../services/api';
import HealthCheck from '../components/HealthCheck';

import { TrendingUp, TrendingDown, Users, Clock, AlertTriangle, Award, Sparkles, CheckCircle2, FileCheck, AlertCircle, Calendar } from 'lucide-react';
// 1. Novos Imports para o gráfico
import { Line, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';

// Registrar os componentes do Chart.js
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
);

// Constantes de Status (para consistência)
const STATUS_OPTIONS = ["Aprovado", "Engenharia", "Finalização", "Conformidade", "Assinado"];
const FINAL_STATUSES = ["Assinado-Movido", "Arquivado"];

const Dashboard = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [allClients, setAllClients] = useState([]);

    // Estado para as contagens por status
    const [statusCounts, setStatusCounts] = useState({
        totalActive: 0,
        Aprovado: 0,
        Engenharia: 0,
        Finalização: 0,
        Conformidade: 0,
        Assinado: 0,
    });
    // 2. Novos estados para métricas e gráfico
    const [trendMetrics, setTrendMetrics] = useState({ monthlyGrowth: { percentage: 0, isPositive: true } });
    const [lineChartData, setLineChartData] = useState({ labels: [], datasets: [] });
    const [doughnutData, setDoughnutData] = useState({ labels: [], datasets: [] });
    const [recentClients, setRecentClients] = useState([]);
    const [topPerformers, setTopPerformers] = useState([]);
    const [avgDaysByStatus, setAvgDaysByStatus] = useState([]);
    const [recentActivities, setRecentActivities] = useState([]);

    const loadDashboardData = async () => {
        setIsLoading(true);
        try {
            const fetchedClients = await fetchClients();
            setAllClients(fetchedClients);
            const activeClients = fetchedClients.filter(c => !FINAL_STATUSES.includes(c.status));

            // Calcular contagens por status
            const counts = { totalActive: activeClients.length };
            STATUS_OPTIONS.forEach(status => {
                counts[status] = activeClients.filter(c => c.status === status).length;
            });
            setStatusCounts(counts);

            // 3. Lógica de cálculo
            const now = new Date();
            const thisMonth = now.getMonth();
            const thisYear = now.getFullYear();
            const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
            const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

            const newClientsThisMonth = activeClients.filter(c => {
                const createdAt = new Date(c.createdAt);
                return createdAt.getMonth() === thisMonth && createdAt.getFullYear() === thisYear;
            }).length;

            const newClientsLastMonth = activeClients.filter(c => {
                const createdAt = new Date(c.createdAt);
                return createdAt.getMonth() === lastMonth && createdAt.getFullYear() === lastMonthYear;
            }).length;

            const growth = newClientsLastMonth > 0 ? ((newClientsThisMonth - newClientsLastMonth) / newClientsLastMonth) * 100 : (newClientsThisMonth > 0 ? 100 : 0);
            setTrendMetrics({ monthlyGrowth: { percentage: growth.toFixed(1), isPositive: growth >= 0 } });

            // Preparar dados para o gráfico de linha (últimos 6 meses)
            const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
            const labels = [];
            const data = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date(thisYear, thisMonth - i, 1);
                labels.push(monthNames[d.getMonth()]);
                const monthClients = activeClients.filter(c => {
                    const createdAt = new Date(c.createdAt);
                    return createdAt.getMonth() === d.getMonth() && createdAt.getFullYear() === d.getFullYear();
                }).length;
                data.push(monthClients);
            }

            setLineChartData({
                labels,
                datasets: [{
                    label: 'Novos Clientes',
                    data,
                    borderColor: 'rgb(91, 124, 153)', // Cor primária Motive
                    backgroundColor: 'rgba(91, 124, 153, 0.1)',
                    tension: 0.4,
                    fill: true,
                }],
            });

            // Preparar dados para o gráfico de pizza (distribuição por status)
            const statusColors = {
                'Aprovado': 'rgb(16, 185, 129)', // green
                'Engenharia': 'rgb(251, 191, 36)', // amber
                'Finalização': 'rgb(168, 85, 247)', // purple
                'Conformidade': 'rgb(249, 115, 22)', // orange
                'Assinado': 'rgb(59, 130, 246)', // blue
            };

            setDoughnutData({
                labels: STATUS_OPTIONS,
                datasets: [{
                    data: STATUS_OPTIONS.map(status => counts[status]),
                    backgroundColor: STATUS_OPTIONS.map(status => statusColors[status]),
                    borderWidth: 2,
                    borderColor: '#fff',
                }],
            });

            // Clientes mais recentes (últimos 5)
            const sortedByDate = [...activeClients].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setRecentClients(sortedByDate.slice(0, 5));

            // Top performers (corretores com mais clientes)
            const performerMap = {};
            activeClients.forEach(c => {
                const name = c.responsavel || c.corretor || 'Não atribuído';
                performerMap[name] = (performerMap[name] || 0) + 1;
            });
            const topPerfs = Object.entries(performerMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, count]) => ({ name, count }));
            setTopPerformers(topPerfs);

            // Tempo médio por status (em dias)
            const avgDays = STATUS_OPTIONS.map(status => {
                const clientsInStatus = activeClients.filter(c => c.status === status);
                if (clientsInStatus.length === 0) return { status, avgDays: 0 };
                
                const totalDays = clientsInStatus.reduce((sum, c) => {
                    const created = new Date(c.createdAt);
                    const today = new Date();
                    const diffDays = Math.floor((today - created) / (1000 * 60 * 60 * 24));
                    return sum + diffDays;
                }, 0);
                
                return { status, avgDays: Math.round(totalDays / clientsInStatus.length) };
            });
            setAvgDaysByStatus(avgDays);

            // Buscar últimas atividades
            const activitiesResponse = await fetch(`${window.location.origin}/api/activities/recent?limit=9`, {
                credentials: 'include'
            });
            if (activitiesResponse.ok) {
                const activities = await activitiesResponse.json();
                setRecentActivities(activities);
            }

        } catch (error) {
            console.error("Erro ao carregar dados do dashboard:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadDashboardData();
    }, []);

    const isNewClient = (creationDate) => {
        if (!creationDate) return false;
        const now = new Date();
        const created = new Date(creationDate);
        const diffHours = (now - created) / (1000 * 60 * 60);
        return diffHours < 24;
    };

    const formatDate = (isoDate) => {
        if (!isoDate) return '';
        const d = new Date(isoDate);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}`;
    };

    const statusIcons = {
        'Aprovado': CheckCircle2,
        'Engenharia': Clock,
        'Finalização': FileCheck,
        'Conformidade': AlertCircle,
        'Assinado': CheckCircle2,
    };

    const statusColorClasses = {
        'Aprovado': 'bg-emerald-50 text-emerald-700 border-emerald-200',
        'Engenharia': 'bg-amber-50 text-amber-700 border-amber-200',
        'Finalização': 'bg-purple-50 text-purple-700 border-purple-200',
        'Conformidade': 'bg-orange-50 text-orange-700 border-orange-200',
        'Assinado': 'bg-blue-50 text-blue-700 border-blue-200',
    };

    if (isLoading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 animate-fade-in">
            <HealthCheck />
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
                    <p className="text-gray-500 mt-1">Visão geral do desempenho e métricas</p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-500">Atualizado em</p>
                    <p className="text-sm font-medium text-gray-700">{new Date().toLocaleString('pt-BR')}</p>
                </div>
            </div>

            {/* Cards de métricas principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total de Clientes Ativos */}
                <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl shadow-lg p-6 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 opacity-10">
                        <Users size={120} />
                    </div>
                    <div className="relative z-10">
                        <p className="text-white/80 text-sm font-medium">Clientes Ativos</p>
                        <p className="text-4xl font-bold mt-2">{statusCounts.totalActive}</p>
                        <div className="mt-3 flex items-center gap-2">
                            {trendMetrics.monthlyGrowth.isPositive ? (
                                <TrendingUp size={16} />
                            ) : (
                                <TrendingDown size={16} />
                            )}
                            <span className="text-sm font-medium">
                                {trendMetrics.monthlyGrowth.percentage}% vs mês anterior
                            </span>
                        </div>
                    </div>
                </div>

                {/* Aprovado */}
                <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm font-medium">Aprovado</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">{statusCounts.Aprovado}</p>
                        </div>
                        <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                            <CheckCircle2 size={24} className="text-emerald-600" />
                        </div>
                    </div>
                    <div className="mt-4 h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div 
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${statusCounts.totalActive > 0 ? (statusCounts.Aprovado / statusCounts.totalActive) * 100 : 0}%` }}
                        />
                    </div>
                </div>

                {/* Engenharia */}
                <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm font-medium">Engenharia</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">{statusCounts.Engenharia}</p>
                        </div>
                        <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
                            <Clock size={24} className="text-amber-600" />
                        </div>
                    </div>
                    <div className="mt-4 h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div 
                            className="bg-amber-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${statusCounts.totalActive > 0 ? (statusCounts.Engenharia / statusCounts.totalActive) * 100 : 0}%` }}
                        />
                    </div>
                </div>

                {/* Conformidade */}
                <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm font-medium">Conformidade</p>
                            <p className="text-3xl font-bold text-gray-900 mt-2">{statusCounts.Conformidade}</p>
                        </div>
                        <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center">
                            <AlertCircle size={24} className="text-orange-600" />
                        </div>
                    </div>
                    <div className="mt-4 h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div 
                            className="bg-orange-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${statusCounts.totalActive > 0 ? (statusCounts.Conformidade / statusCounts.totalActive) * 100 : 0}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Grid Principal - 3 colunas com Últimas Alterações ocupando 2 linhas */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Coluna 1 e 2: Evolução + Clientes e Distribuição */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Gráfico de Linha - Evolução */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800">Evolução de Novos Clientes</h3>
                                <p className="text-sm text-gray-500 mt-1">Últimos 6 meses</p>
                            </div>
                        </div>
                        <div className="h-72">
                            {lineChartData.labels.length > 0 ? (
                                <Line 
                                    data={lineChartData} 
                                    options={{ 
                                        responsive: true, 
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: { display: false }
                                        }
                                    }} 
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-400">
                                    <p>Sem dados disponíveis</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Grid de 2 colunas - Clientes Recentes e Distribuição */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Clientes Recentes */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Sparkles size={20} className="text-primary" />
                                <h3 className="text-lg font-semibold text-gray-800">Clientes Recentes</h3>
                            </div>
                            <div className="space-y-3">
                                {recentClients.length > 0 ? recentClients.map(client => (
                                    <div key={client.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-gray-900 truncate text-sm">{client.nome}</p>
                                                {isNewClient(client.createdAt) && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-red-500 text-white">
                                                        NOVO
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5">{formatDate(client.createdAt)}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${statusColorClasses[client.status] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                                            {client.status}
                                        </span>
                                    </div>
                                )) : (
                                    <p className="text-gray-400 text-sm text-center py-8">Nenhum cliente recente</p>
                                )}
                            </div>
                        </div>

                        {/* Gráfico de Pizza - Distribuição por Status */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <div className="mb-6">
                                <h3 className="text-lg font-semibold text-gray-800">Distribuição por Status</h3>
                                <p className="text-sm text-gray-500 mt-1">Visão geral</p>
                            </div>
                            <div className="h-56 flex items-center justify-center">
                                {doughnutData.labels.length > 0 && statusCounts.totalActive > 0 ? (
                                    <Doughnut 
                                        data={doughnutData} 
                                        options={{ 
                                            responsive: true, 
                                            maintainAspectRatio: true,
                                            plugins: {
                                                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
                                            }
                                        }} 
                                    />
                                ) : (
                                    <p className="text-gray-400">Sem clientes ativos</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Coluna 3: Últimas Alterações (altura dupla - row-span-2) */}
                <div className="lg:row-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-full">
                    <div className="flex items-center gap-2 mb-4">
                        <Clock size={20} className="text-purple-500" />
                        <h3 className="text-lg font-semibold text-gray-800">Últimas Alterações</h3>
                    </div>
                    <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100% - 3rem)' }}>
                        {recentActivities.map((activity, index) => {
                            const activityDate = new Date(activity.createdAt);
                            const timeAgo = Math.floor((new Date() - activityDate) / (1000 * 60));
                            const timeText = timeAgo < 60 ? `${timeAgo}min atrás` : 
                                           timeAgo < 1440 ? `${Math.floor(timeAgo / 60)}h atrás` : 
                                           `${Math.floor(timeAgo / 1440)}d atrás`;
                            
                            const actionText = activity.action === 'created' ? 'Criou' :
                                             activity.action === 'status_changed' ? 'Mudou status' :
                                             'Atualizou';
                            
                            const statusToShow = activity.action === 'status_changed' ? 
                                               `${activity.statusAntes} → ${activity.statusDepois}` :
                                               activity.statusDepois || activity.statusAntes || '-';
                            
                            return (
                                <div key={`${activity.id}-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                                            <Calendar size={16} className="text-purple-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 truncate text-sm">{activity.clientNome}</p>
                                            <p className="text-xs text-gray-500">
                                                {actionText} por <span className="font-medium text-gray-700">{activity.userName}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-4">
                                        <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${statusColorClasses[activity.statusDepois] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                                            {statusToShow}
                                        </span>
                                        <p className="text-xs text-gray-500 mt-1">{timeText}</p>
                                    </div>
                                </div>
                            );
                        })}
                        {recentActivities.length === 0 && (
                            <p className="text-gray-400 text-sm text-center py-8">Nenhuma alteração recente</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;