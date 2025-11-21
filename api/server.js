import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

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
  });
}
