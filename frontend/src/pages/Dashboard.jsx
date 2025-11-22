import { useState, useEffect } from 'react';
import { fetchClients } from '../services/api';

import { TrendingUp, TrendingDown, Users } from 'lucide-react';
// 1. Novos Imports para o gráfico
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
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
    Title,
    Tooltip,
    Legend
);

// Constantes de Status (para consistência)
const STATUS_OPTIONS = ["Aprovado", "Engenharia", "Finalização", "Conformidade", "Assinado"];
const FINAL_STATUSES = ["Assinado-Movido", "Arquivado"];

const Dashboard = () => {
    const [isLoading, setIsLoading] = useState(true);

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

    const loadDashboardData = async () => {
        setIsLoading(true);
        try {
            const fetchedClients = await fetchClients();
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
                    borderColor: 'rgb(59, 130, 246)', // Cor primária (blue-500)
                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    tension: 0.4, // Linha suave
                }],
            });

        } catch (error) {
            console.error("Erro ao carregar dados do dashboard:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadDashboardData();
    }, []);

    const stats = [
        { name: 'Clientes Ativos', stat: statusCounts.totalActive, isTotal: true },
        ...STATUS_OPTIONS.map(status => ({ name: status, stat: statusCounts[status] }))
    ];

    if (isLoading) {
        return <div className="p-6">Carregando...</div>;
    }

    return (
        <div className="p-6 space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>

            {/* 1. Seção de cards de KPI */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
                {stats.map((item) => {
                    const percentageOfTotal = statusCounts.totalActive > 0 ? (item.stat / statusCounts.totalActive) * 100 : 0;

                    return (
                        <div key={item.name} className="bg-white rounded-xl shadow-sm p-5 flex flex-col justify-between overflow-hidden">
                            <div>
                                <p className="text-sm font-medium text-gray-500 truncate">{item.name}</p>
                                <p className="mt-1 text-3xl font-semibold text-gray-900">{item.stat}</p>
                            </div>

                            {/* 2. Indicador de tendência para o card total */}
                            {item.isTotal ? (
                                <div className="mt-2 flex items-center gap-1 text-xs font-medium">
                                    {trendMetrics.monthlyGrowth.isPositive ? (
                                        <TrendingUp className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <TrendingDown className="h-4 w-4 text-red-500" />
                                    )}
                                    <span className={trendMetrics.monthlyGrowth.isPositive ? 'text-green-600' : 'text-red-600'}>
                                        {trendMetrics.monthlyGrowth.percentage}%
                                    </span>
                                    <span className="text-gray-500">vs mês anterior</span>
                                </div>
                            ) : (
                                /* 3. Barra de progresso para outros cards */
                                <div className="mt-4 h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className="bg-blue-500 h-full rounded-full"
                                        style={{ width: `${percentageOfTotal}%` }}
                                    ></div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 1. Nova seção de largura total para o Gráfico de Linha */}
            <div className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Evolução de Novos Clientes</h3>
                    <span className="text-sm font-medium text-gray-500">Últimos 6 meses</span>
                </div>
                {/* 2. Container do gráfico com altura fixa */}
                <div className="h-80">
                    {lineChartData.labels.length > 0 ? (
                        <Line data={lineChartData} options={{ responsive: true, maintainAspectRatio: false }} />
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            <p>Não há dados suficientes para exibir o gráfico.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* 3. Layout de duas colunas para os próximos componentes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Placeholder para o Gráfico de Pizza */}
                <div className="bg-white rounded-xl shadow-sm p-5 h-96 flex items-center justify-center text-gray-400">
                    (Gráfico de Pizza - Status)
                </div>
                {/* Placeholder para a Lista de Atividades */}
                <div className="bg-white rounded-xl shadow-sm p-5 h-96 flex items-center justify-center text-gray-400">
                    (Lista de Atividades Recentes)
                </div>
            </div>
        </div>
    );
};

export default Dashboard;