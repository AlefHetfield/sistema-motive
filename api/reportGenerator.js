import XLSX from 'xlsx';
import { format } from 'date-fns';

// Status finais usados no sistema
const FINAL_STATUSES = ['Assinado-Movido', 'Arquivado'];

export function buildMonthlyReport(clients, month, year) {
  // month: 1-12
  const monthIndex = month - 1;
  const periodLabel = `${String(month).padStart(2, '0')}/${year}`;

  // Métricas principais
  const totalClients = clients.length;
  const newClientsThisMonth = clients.filter(c => c.createdAt && new Date(c.createdAt).getMonth() === monthIndex && new Date(c.createdAt).getFullYear() === year).length;
  const signedThisMonth = clients.filter(c => c.dataAssinaturaContrato && new Date(c.dataAssinaturaContrato).getMonth() === monthIndex && new Date(c.dataAssinaturaContrato).getFullYear() === year).length;

  const activeClients = clients.filter(c => !FINAL_STATUSES.includes(c.status || ''));
  const signedClients = clients.filter(c => (c.status === 'Assinado-Movido'));
  const archivedClients = clients.filter(c => (c.status === 'Arquivado'));

  const conversionRate = activeClients.length > 0 ? (signedClients.length / activeClients.length) : 0;

  // Tempo médio desde criação até assinatura (dias)
  const signedWithCreation = signedClients.filter(c => c.createdAt && c.dataAssinaturaContrato);
  const avgDaysToSign = signedWithCreation.length ? (
    signedWithCreation.reduce((acc, c) => {
      const created = new Date(c.createdAt);
      const signed = new Date(c.dataAssinaturaContrato);
      const diffDays = Math.round((signed - created) / (1000 * 60 * 60 * 24));
      return acc + diffDays;
    }, 0) / signedWithCreation.length
  ) : 0;

  const metrics = {
    periodo: periodLabel,
    totalClientes,
    novosNoPeriodo: newClientsThisMonth,
    assinadosNoPeriodo: signedThisMonth,
    ativos: activeClients.length,
    assinados: signedClients.length,
    arquivados: archivedClients.length,
    taxaConversao: Number(conversionRate.toFixed(4)),
    mediaDiasAteAssinatura: Number(avgDaysToSign.toFixed(2))
  };

  // Construção do workbook
  const wb = XLSX.utils.book_new();

  // Sheet de clientes
  const clientRows = clients.map(c => ({
    ID: c.id,
    Nome: c.nome || '',
    CPF: c.cpf || '',
    Imovel: c.imovel || '',
    Corretor: c.corretor || '',
    Responsavel: c.responsavel || '',
    Agencia: c.agencia || '',
    Modalidade: c.modalidade || '',
    Status: c.status || '',
    CriadoEm: c.createdAt ? format(new Date(c.createdAt), 'dd/MM/yyyy HH:mm') : '',
    Assinatura: c.dataAssinaturaContrato ? format(new Date(c.dataAssinaturaContrato), 'dd/MM/yyyy') : '',
    Observacoes: c.observacoes || ''
  }));
  const clientsSheet = XLSX.utils.json_to_sheet(clientRows);
  XLSX.utils.book_append_sheet(wb, clientsSheet, 'Clientes');

  // Sheet de resumo
  const summaryRows = Object.entries(metrics).map(([k, v]) => ({ Metric: k, Valor: v }));
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Resumo');

  return { workbook: wb, metrics };
}

export function buildFileName(month, year) {
  return `relatorio_clientes_${year}-${String(month).padStart(2, '0')}.xlsx`;
}

// Weekly report builder: last 7 days (or custom range)
export function buildWeeklyReport(clients, startDate, endDate) {
  // Normalize dates
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();
  const periodLabel = `${format(start, 'dd/MM/yyyy')} - ${format(end, 'dd/MM/yyyy')}`;

  const isInRange = (d) => d && new Date(d) >= start && new Date(d) <= end;

  const newClients = clients.filter(c => isInRange(c.createdAt));
  const signedClientsInRange = clients.filter(c => isInRange(c.dataAssinaturaContrato));
  const activeClients = clients.filter(c => !FINAL_STATUSES.includes(c.status || ''));
  const signedClients = clients.filter(c => c.status === 'Assinado-Movido');

  const conversionRate = activeClients.length ? (signedClients.length / activeClients.length) : 0;

  // Tempo médio para assinatura para assinados dentro do range de assinatura
  const signedRangeWithCreation = signedClientsInRange.filter(c => c.createdAt && c.dataAssinaturaContrato);
  const avgDaysToSign = signedRangeWithCreation.length ? (
    signedRangeWithCreation.reduce((acc, c) => {
      const created = new Date(c.createdAt);
      const signed = new Date(c.dataAssinaturaContrato);
      const diffDays = Math.round((signed - created) / (1000 * 60 * 60 * 24));
      return acc + diffDays;
    }, 0) / signedRangeWithCreation.length
  ) : 0;

  const metrics = {
    periodoSemanal: periodLabel,
    novosNaSemana: newClients.length,
    assinadosNaSemana: signedClientsInRange.length,
    taxaConversaoAtual: Number(conversionRate.toFixed(4)),
    mediaDiasAteAssinaturaSemana: Number(avgDaysToSign.toFixed(2)),
    totalBase: clients.length
  };

  // Workbook com todas as linhas (backup completo) + sheet WeeklyResumo + sheet NovosSemana
  const wb = XLSX.utils.book_new();
  const clientRows = clients.map(c => ({
    ID: c.id,
    Nome: c.nome || '',
    CPF: c.cpf || '',
    Imovel: c.imovel || '',
    Corretor: c.corretor || '',
    Responsavel: c.responsavel || '',
    Agencia: c.agencia || '',
    Modalidade: c.modalidade || '',
    Status: c.status || '',
    CriadoEm: c.createdAt ? format(new Date(c.createdAt), 'dd/MM/yyyy HH:mm') : '',
    Assinatura: c.dataAssinaturaContrato ? format(new Date(c.dataAssinaturaContrato), 'dd/MM/yyyy') : '',
    Observacoes: c.observacoes || ''
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientRows), 'BackupClientes');

  const weeklySummaryRows = Object.entries(metrics).map(([k,v]) => ({ Metric: k, Valor: v }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(weeklySummaryRows), 'WeeklyResumo');

  const newClientRows = newClients.map(c => ({
    ID: c.id,
    Nome: c.nome || '',
    Status: c.status || '',
    Corretor: c.corretor || '',
    Responsavel: c.responsavel || '',
    CriadoEm: c.createdAt ? format(new Date(c.createdAt), 'dd/MM/yyyy HH:mm') : ''
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(newClientRows), 'NovosSemana');

  return { workbook: wb, metrics, newClients };
}

export function buildWeeklyFileName(endDate = new Date()) {
  return `relatorio_semanal_${format(new Date(endDate), 'yyyy-MM-dd')}.xlsx`;
}
