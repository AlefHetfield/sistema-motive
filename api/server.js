import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import { buildMonthlyReport, buildFileName, buildWeeklyReport, buildWeeklyFileName } from './reportGenerator.js';
import { dispatchReport } from './emailSender.js';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';

// Configurar Prisma com pool de conexões para Vercel
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// ========== AUTENTICAÇÃO E AUTORIZAÇÃO ==========

// Helpers de sessão via cookies
const SESSION_COOKIE = 'motive_session';

function createSession(res, payload) {
  const value = Buffer.from(JSON.stringify(payload)).toString('base64');
  res.cookie(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8 horas
  });
}

function destroySession(res) {
  res.clearCookie(SESSION_COOKIE);
}

function readSession(req) {
  const raw = req.cookies?.[SESSION_COOKIE];
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

// Middleware de autenticação
function requireAuth(req, res, next) {
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: 'Não autenticado' });
  req.user = session;
  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const session = readSession(req);
    if (!session) return res.status(401).json({ error: 'Não autenticado' });
    if (!allowedRoles.includes(session.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    req.user = session;
    next();
  };
}

// ========== ROTAS DE AUTENTICAÇÃO ==========

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('Tentativa de login:', email);
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user || !user.isActive) {
      console.log('Usuário não encontrado ou inativo:', email);
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    console.log('Comparando senha para:', email);
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    console.log('Resultado da comparação:', passwordMatch);
    
    if (!passwordMatch) {
      console.log('Senha incorreta para:', email);
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Atualiza último login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Cria sessão
    createSession(res, {
      id: user.id,
      email: user.email,
      role: user.role,
      nome: user.nome
    });

    res.json({
      id: user.id,
      nome: user.nome,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro ao processar login' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  destroySession(res);
  res.json({ success: true });
});

// Trocar própria senha (não requer ADM)
app.put('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
    }

    // Hash da nova senha
    const passwordHash = await bcrypt.hash(password, 10);

    // Atualiza a senha do usuário logado
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { 
        passwordHash,
        mustChangePassword: false 
      },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        mustChangePassword: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Erro ao trocar senha:', error);
    res.status(500).json({ error: 'Erro ao trocar senha' });
  }
});

// Atualizar próprio perfil (não requer ADM)
app.put('/api/auth/profile', requireAuth, async (req, res) => {
  try {
    const { nome, email } = req.body;

    if (!nome || !email) {
      return res.status(400).json({ error: 'Nome e email são obrigatórios' });
    }

    // Busca o usuário atual no banco de dados
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    // Verifica se o email já está em uso por outro usuário
    if (email !== currentUser.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(400).json({ error: 'Este email já está em uso' });
      }
    }

    // Atualiza apenas nome e email do usuário logado
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { nome, email },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        mustChangePassword: true
      }
    });

    // Atualiza a sessão com os novos dados
    createSession(res, {
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      nome: updatedUser.nome
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

// Verificar sessão atual
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        mustChangePassword: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      destroySession(res);
      return res.status(401).json({ error: 'Sessão inválida' });
    }

    res.json(user);
  } catch (error) {
    console.error('Erro ao verificar sessão:', error);
    res.status(500).json({ error: 'Erro ao verificar sessão' });
  }
});

// Health check para evitar cold start
app.get('/api/health', async (req, res) => {
  try {
    // Verifica conexão com o banco de dados
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Health check falhou:', error);
    res.status(503).json({ status: 'error', message: 'Banco de dados indisponível' });
  }
});

// Buscar últimas atividades
app.get('/api/activities/recent', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 9;
    const activities = await prisma.activityLog.findMany({
      take: limit,
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.json(activities);
  } catch (error) {
    console.error('Erro ao buscar atividades:', error);
    res.status(500).json({ error: 'Erro ao buscar atividades' });
  }
});

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
app.post('/api/clients', requireAuth, async (req, res) => {
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
      data: {
        ...req.body,
        ultimoUsuarioAlteracao: req.user.nome // Salva o nome do usuário que criou
      },
    });
    
    // Registra a atividade
    await prisma.activityLog.create({
      data: {
        clientId: newClient.id,
        clientNome: newClient.nome || 'Cliente sem nome',
        action: 'created',
        statusDepois: newClient.status,
        userName: req.user.nome
      }
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
app.put('/api/clients/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    // Busca o cliente antes da atualização para comparar o status
    const clienteAntes = await prisma.client.findUnique({
      where: { id: parseInt(id) }
    });
    
    const updatedClient = await prisma.client.update({
      where: { id: parseInt(id) },
      data: {
        ...req.body,
        ultimoUsuarioAlteracao: req.user.nome // Salva o nome do usuário logado
      },
    });
    
    // Registra a atividade
    const statusMudou = clienteAntes.status !== updatedClient.status;
    await prisma.activityLog.create({
      data: {
        clientId: updatedClient.id,
        clientNome: updatedClient.nome || 'Cliente sem nome',
        action: statusMudou ? 'status_changed' : 'updated',
        statusAntes: clienteAntes.status,
        statusDepois: updatedClient.status,
        userName: req.user.nome
      }
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
app.get('/api/reports/weekly/run', requireAuth, async (req, res) => {
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

// ========== ROTAS DE GERENCIAMENTO DE USUÁRIOS (Apenas ADM) ==========

// [READ] Listar todos os usuários
app.get('/api/users', requireRole('ADM'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        mustChangePassword: true
      }
    });
    res.json(users);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Não foi possível buscar os usuários' });
  }
});

// [READ] Buscar usuário por ID
app.get('/api/users/:id', requireRole('ADM'), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        mustChangePassword: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Não foi possível buscar o usuário' });
  }
});

// [CREATE] Criar um novo usuário
app.post('/api/users', requireRole('ADM'), async (req, res) => {
  try {
    const { nome, email, password, role = 'CORRETOR', isActive = true } = req.body;
    
    console.log('Criando usuário:', { nome, email, role, hasPassword: !!password });
    
    if (!nome || !email || !password) {
      return res.status(400).json({ 
        error: 'Nome, email e senha são obrigatórios' 
      });
    }

    // Verifica se o email já existe
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Este email já está em uso' });
    }

    // Hash da senha
    console.log('Gerando hash para senha:', password);
    const passwordHash = await bcrypt.hash(password, 10);
    console.log('Hash gerado com sucesso');

    const newUser = await prisma.user.create({
      data: {
        nome,
        email,
        passwordHash,
        role,
        isActive,
        mustChangePassword: true // Força troca de senha no primeiro login
      },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    res.status(201).json(newUser);
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ 
      error: 'Não foi possível criar o usuário',
      details: error.message 
    });
  }
});

// [UPDATE] Atualizar um usuário por ID
app.put('/api/users/:id', requireRole('ADM'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email, password, role, isActive, mustChangePassword } = req.body;

    const updateData = {};
    if (nome !== undefined) updateData.nome = nome;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (mustChangePassword !== undefined) updateData.mustChangePassword = mustChangePassword;
    
    // Se uma nova senha foi fornecida, faz o hash
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData,
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Não foi possível atualizar o usuário' });
  }
});

// [DELETE] Deletar um usuário por ID
app.delete('/api/users/:id', requireRole('ADM'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    // Impede que o usuário delete a si mesmo
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Você não pode deletar sua própria conta' });
    }

    await prisma.user.delete({
      where: { id: userId }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    res.status(500).json({ error: 'Não foi possível deletar o usuário' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Exporta o app para a Vercel
export default app;

// Inicia o servidor para desenvolvimento local e produção (Render/Railway)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log('🔄 Cron de relatório mensal ativo (primeiro dia do mês às 09:00).');
  console.log('🔄 Cron de relatório semanal ativo (toda segunda às 09:05).');
});
