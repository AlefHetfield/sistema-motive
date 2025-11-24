import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import { buildMonthlyReport, buildFileName, buildWeeklyReport, buildWeeklyFileName } from './reportGenerator.js';
import { dispatchReport } from './emailSender.js';

const prisma = new PrismaClient();
const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Substitui o body-parser para JSON

// --- ROTAS PARA CLIENTES (Clients) ---

// [READ] Listar todos os clientes
app.get('/api/clients', async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      orderBy: {
        createdAt: 'desc', // Ordena os mais recentes primeiro
      },
    });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: 'Não foi possível buscar os clientes.' });
  }
});

// [READ] Obter um cliente por ID
app.get('/api/clients/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const client = await prisma.client.findUnique({
      where: { id: parseInt(id) },
    });
    if (!client) {
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: 'Não foi possível buscar o cliente.' });
  }
});

// [CREATE] Criar um novo cliente
app.post('/api/clients', async (req, res) => {
  const { nome, corretor } = req.body;

  // Validação básica no backend
  if (!nome || !corretor) {
    return res.status(400).json({ 
      error: 'Dados inválidos.',
      details: 'Os campos "Nome do Cliente" e "Corretor" são obrigatórios.' 
    });
  }

  try {
    const newClient = await prisma.client.create({
      data: req.body,
    });
    // Log para confirmar a criação no terminal
    console.log('Novo cliente criado com sucesso:', newClient);
    res.status(201).json(newClient);
  } catch (error) {
    // Log detalhado do erro no servidor (Vercel Logs ou terminal local)
    console.error("Erro ao criar cliente:", error);
    // Envia uma resposta de erro mais específica para o frontend
    res.status(400).json({ 
        error: 'Dados inválidos para criar o cliente.',
        details: error.message 
    });
  }
});

// [UPDATE] Atualizar um cliente por ID
app.put('/api/clients/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const updatedClient = await prisma.client.update({
      where: { id: parseInt(id) },
      data: req.body,
    });
    res.json(updatedClient);
  } catch (error) {
    res.status(500).json({ error: 'Não foi possível atualizar o cliente.' });
  }
});

// [DELETE] Deletar um cliente por ID
app.delete('/api/clients/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.client.delete({
      where: { id: parseInt(id) },
    });
    res.status(204).send(); // 204 No Content - sucesso, sem corpo na resposta
  } catch (error) {
    res.status(500).json({ error: 'Não foi possível deletar o cliente.' });
  }
});

// --- RELATÓRIO MENSAL ---
// Endpoint manual para gerar e enviar (ou salvar) relatório do mês especificado
// GET /api/reports/monthly/run?month=11&year=2025
app.get('/api/reports/monthly/run', async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);
    const year = parseInt(req.query.year) || now.getFullYear();
    const clients = await prisma.client.findMany();
    const { workbook, metrics } = buildMonthlyReport(clients, month, year);
    const fileName = buildFileName(month, year);
    const result = await dispatchReport({ workbook, fileName, metrics });
    res.json({ ok: true, month, year, fileName, ...result });
  } catch (err) {
    console.error('Erro ao gerar relatório manual:', err);
    res.status(500).json({ ok: false, error: 'Falha ao gerar relatório', details: err.message });
  }
});

// Cron job: primeiro dia do mês às 09:00 (minuto 0, hora 9, dia 1)
// Formato: '0 9 1 * *'
cron.schedule('0 9 1 * *', async () => {
  try {
    const execDate = new Date();
    const month = execDate.getMonth() + 1; // 1-12
    const year = execDate.getFullYear();
    const clients = await prisma.client.findMany();
    const { workbook, metrics } = buildMonthlyReport(clients, month, year);
    const fileName = buildFileName(month, year);
    const result = await dispatchReport({ workbook, fileName, metrics });
    console.log(`Cron relatório mensal executado para ${fileName}`, result);
  } catch (err) {
    console.error('Erro no cron de relatório mensal:', err);
  }
}, {
  timezone: process.env.TZ || 'America/Sao_Paulo'
});

// --- RELATÓRIO SEMANAL ---
// Endpoint manual: /api/reports/weekly/run?start=2025-11-17&end=2025-11-24
app.get('/api/reports/weekly/run', async (req, res) => {
  try {
    const end = req.query.end ? new Date(req.query.end) : new Date();
    const start = req.query.start ? new Date(req.query.start) : new Date(end.getTime() - 7*24*60*60*1000);
    const clients = await prisma.client.findMany();
    const { workbook, metrics, newClients } = buildWeeklyReport(clients, start, end);
    const fileName = buildWeeklyFileName(end);
    const result = await dispatchReport({ workbook, fileName, metrics, type: 'weekly', newClients });
    res.json({ ok: true, start, end, fileName, newClients: newClients.length, ...result });
  } catch (err) {
    console.error('Erro ao gerar relatório semanal manual:', err);
    res.status(500).json({ ok: false, error: 'Falha ao gerar relatório semanal', details: err.message });
  }
});

// Cron semanal: toda segunda às 09:05
cron.schedule('5 9 * * 1', async () => {
  try {
    const end = new Date();
    const start = new Date(end.getTime() - 7*24*60*60*1000);
    const clients = await prisma.client.findMany();
    const { workbook, metrics, newClients } = buildWeeklyReport(clients, start, end);
    const fileName = buildWeeklyFileName(end);
    const result = await dispatchReport({ workbook, fileName, metrics, type: 'weekly', newClients });
    console.log(`Cron relatório semanal enviado: ${fileName} novos=${newClients.length}`, result);
  } catch (err) {
    console.error('Erro no cron de relatório semanal:', err);
  }
}, {
  timezone: process.env.TZ || 'America/Sao_Paulo'
});

// --- ROTAS PARA USUÁRIOS (Users) ---

// [READ] Listar todos os usuários
app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: {
        nome: 'asc',
      },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Não foi possível buscar os usuários.' });
  }
});

// [CREATE] Criar um novo usuário
app.post('/api/users', async (req, res) => {
  try {
    const newUser = await prisma.user.create({
      data: req.body,
    });
    res.status(201).json(newUser);
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    res.status(400).json({ 
        error: 'Dados inválidos para criar o usuário.',
        details: error.message 
    });
  }
});

// [UPDATE] Atualizar um usuário por ID
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: req.body,
    });
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: 'Não foi possível atualizar o usuário.' });
  }
});

// [DELETE] Deletar um usuário por ID
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.user.delete({
      where: { id: parseInt(id) },
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Não foi possível deletar o usuário.' });
  }
});

// Exporta o app para a Vercel
export default app;

// Inicia o servidor para desenvolvimento local (não será executado na Vercel)
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log('Cron de relatório mensal ativo (primeiro dia do mês às 09:00).');
    console.log('Cron de relatório semanal ativo (toda segunda às 09:05).');
  });
}
