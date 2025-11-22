import { useState, useEffect } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { fetchClients } from '../services/api';
import useActivityLog from '../hooks/useActivityLog'; // Importar o hook

// Registrar os elementos do Chart.js que serão usados
ChartJS.register(ArcElement, Tooltip, Legend);

// Constantes do projeto original
const STATUS_OPTIONS = ["Aprovado", "Engenharia", "Finalização", "Conformidade", "Assinado"];
const FINAL_STATUSES = ["Assinado-Movido", "Arquivado"];

const statusColorMap = {
    "Aprovado": "status-aprovado",
    "Engenharia": "status-engenharia",
    "Finalização": "status-finalização",
    "Conformidade": "status-conformidade",
    "Assinado": "status-assinado"
};

const chartColors = {
    "Aprovado": "#A8A29E",
    "Engenharia": "#F87171",
    "Finalização": "#FBBF24",
    "Conformidade": "#4ADE80",
    "Assinado": "#60A5FA"
};


const Dashboard = () => {
    const [stats, setStats] = useState({});
    const [chartData, setChartData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const { activities } = useActivityLog(); // Usar o hook

    useEffect(() => {
        const loadDashboardData = async () => {
            setIsLoading(true);
            try {
                const clients = await fetchClients();

                // 1. Calcular totais para os cards de KPI
                const statusCounts = clients.reduce((acc, client) => {
                    if (!FINAL_STATUSES.includes(client.status)) {
                        acc[client.status] = (acc[client.status] || 0) + 1;
                    }
                    return acc;
                }, {});
                setStats(statusCounts);

                // 2. Preparar dados para o gráfico de pizza
                const activeClients = clients.filter(client => !FINAL_STATUSES.includes(client.status));
                const chartStatusCounts = activeClients.reduce((acc, client) => {
                    acc[client.status] = (acc[client.status] || 0) + 1;
                    return acc;
                }, {});

                const labels = Object.keys(chartStatusCounts);
                const data = Object.values(chartStatusCounts);
                const backgroundColors = labels.map(label => chartColors[label] || '#CCCCCC');

                setChartData({
                    labels,
                    datasets: [{
                        label: 'Clientes',
                        data,
                        backgroundColor: backgroundColors,
                        borderColor: '#FFFFFF',
                        borderWidth: 2
                    }]
                });

            } catch (error) {
                console.error("Erro ao carregar dados do dashboard:", error);
                // Aqui você poderia definir um estado de erro para exibir na UI
            } finally {
                setIsLoading(false);
            }
        };

        loadDashboardData();
    }, []);

    if (isLoading) {
        return (
            <div className="p-6 animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="bg-gray-200 p-4 rounded-lg h-24"></div>
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
                        <div className="bg-gray-200 rounded-lg h-80"></div>
                    </div>
                    <div>
                         <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
                         <div className="bg-gray-200 rounded-lg h-80"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div id="dashboard-view" className="fade-in space-y-8 p-6">
            {/* Seção de Métricas (Funil) */}
            <div>
                <h2 className="text-lg font-semibold text-secondary mb-4">Funil de Clientes Ativos</h2>
                <div id="stats-grid" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {STATUS_OPTIONS.filter(s => !FINAL_STATUSES.includes(s)).map(status => (
                        <div key={status} className="bg-surface p-4 rounded-lg shadow-md flex items-center">
                            <div className={`p-3 rounded-full ${statusColorMap[status] || 'bg-gray-200'} mr-4`}>
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-secondary">{stats[status] || 0}</div>
                                <div className="text-sm text-text-secondary">{status}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Seção Gráfico e Atividades */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Coluna do Gráfico */}
                <div>
                    <h2 className="text-lg font-semibold text-secondary mb-4">Distribuição por Status</h2>
                    <div className="bg-surface rounded-lg shadow-md p-4 flex justify-center items-center h-80">
                        {chartData && <Pie id="status-pie-chart" data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />}
                    </div>
                </div>

                {/* Coluna de Atividades Recentes */}
                <div>
                    <h2 className="text-lg font-semibold text-secondary mb-4">Atividades Recentes</h2>
                    <div className="bg-surface rounded-lg shadow-md">
                        <ul id="recent-activity-list" className="divide-y divide-gray-200">
                            {activities.length > 0 ? (
                                activities.map(activity => (
                                    <li key={activity.id} className="p-4">
                                        <p className="text-sm text-text-primary">{activity.description}</p>
                                        <p className="text-xs text-text-secondary mt-1">
                                            {new Date(activity.date).toLocaleString()}
                                        </p>
                                    </li>
                                ))
                            ) : (
                                <li className="p-4 text-center text-gray-500">Nenhuma atividade recente.</li>
                            )}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
