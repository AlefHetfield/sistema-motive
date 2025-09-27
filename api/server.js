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
  try {
    const newClient = await prisma.client.create({
      data: req.body,
    });
    res.status(201).json(newClient);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Não foi possível criar o cliente.' });
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


// Exporta o app para a Vercel
export default app;

