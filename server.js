// =================================================================================
// SERVIDOR BACKEND SIMPLES COM NODE.JS E EXPRESS
// =================================================================================

// 1. IMPORTAR DEPENDÊNCIAS
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { PrismaClient } = require('@prisma/client');

// 2. INICIALIZAR O APLICATIVO EXPRESS
const app = express();
const prisma = new PrismaClient();

// 3. CONFIGURAR MIDDLEWARES
// O 'cors' permite que nosso frontend (rodando em outra porta/origem) acesse esta API.
app.use(cors());
// O 'bodyParser.json()' permite que o servidor entenda requisições com corpo em formato JSON.
app.use(bodyParser.json());


// 5. DEFINIR AS ROTAS DA API (ENDPOINTS)

// Rota para BUSCAR TODOS os clientes (GET /api/clients)
app.get('/api/clients', async (req, res, next) => {
    try {
        const clients = await prisma.client.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(clients);
    } catch (error) {
        next(error);
    }
});

// Rota para BUSCAR UM cliente pelo ID (GET /api/clients/:id)
app.get('/api/clients/:id', async (req, res, next) => {
    const { id } = req.params;
    try {
        console.log(`GET /api/clients/${id} - Buscando cliente`);
        const client = await prisma.client.findUnique({
            where: { id: parseInt(id) },
        });
        if (client) {
            res.json(client);
        } else {
            res.status(404).json({ message: 'Cliente não encontrado' });
        }
    } catch (error) {
        next(error);
    }
});

// Rota para CRIAR um novo cliente (POST /api/clients)
app.post('/api/clients', async (req, res, next) => {    
    try {
        const newClient = await prisma.client.create({
            data: req.body,
        });
        res.status(201).json(newClient);
    } catch (error) {
        next(error);
    }
});

// Rota para ATUALIZAR um cliente existente (PUT /api/clients/:id)
app.put('/api/clients/:id', async (req, res, next) => {
    const { id } = req.params;
    if (Object.keys(req.body).length === 0) {
        return res.status(400).json({ message: 'Nenhum campo para atualizar' });
    }
    
    try {
        console.log(`PUT /api/clients/${id} - Atualizando cliente`);
        const updatedClient = await prisma.client.update({
            where: { id: parseInt(id) },
            data: req.body,
        });
        res.json(updatedClient);
    } catch (error) {
        next(error); // Passa o erro para o middleware de erro
    }
});

// Rota para DELETAR um cliente (DELETE /api/clients/:id)
app.delete('/api/clients/:id', async (req, res, next) => {
    const { id } = req.params;
    try {
        console.log(`DELETE /api/clients/${id} - Deletando cliente`);
        await prisma.client.delete({
            where: { id: parseInt(id) },
        });
        res.status(204).send(); // 204 No Content (sucesso, sem corpo de resposta)
    } catch (error) {
        next(error);
    }
});

// =================================================================================
// ROTAS DA API PARA USUÁRIOS
// =================================================================================

// Rota para BUSCAR TODOS os usuários
app.get('/api/users', async (req, res, next) => {
    try {
        const users = await prisma.user.findMany({ orderBy: { nome: 'asc' } });
        res.json(users);
    } catch (error) {
        next(error);
    }
});

// Rota para CRIAR um novo usuário
app.post('/api/users', async (req, res, next) => {
    try {
        const { nome, email, role } = req.body;
        const newUser = await prisma.user.create({
            data: { nome, email, role },
        });
        res.status(201).json(newUser);
    } catch (error) {
        next(error);
    }
});

// Rota para ATUALIZAR um usuário
app.put('/api/users/:id', async (req, res, next) => {
    const { id } = req.params;
    try {
        const { nome, email, role } = req.body;
        const updatedUser = await prisma.user.update({
            where: { id: parseInt(id) },
            data: { nome, email, role },
        });
        res.json(updatedUser);
    } catch (error) {
        next(error);
    }
});

// Rota para DELETAR um usuário
app.delete('/api/users/:id', async (req, res, next) => {
    const { id } = req.params;
    try {
        await prisma.user.delete({
            where: { id: parseInt(id) },
        });
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// =================================================================================
// ROTAS DA API PARA IMÓVEIS (PROPERTIES)
// =================================================================================

// Rota para BUSCAR TODOS os imóveis
app.get('/api/properties', async (req, res, next) => {
    try {
        const properties = await prisma.property.findMany();
        res.json(properties);
    } catch (error) {
        next(error);
    }
});

// Rota para CRIAR um novo imóvel
app.post('/api/properties', async (req, res, next) => {
    try {
        const newProperty = await prisma.property.create({ data: req.body });
        res.status(201).json(newProperty);
    } catch (error) {
        next(error);
    }
});

// Rota para ATUALIZAR um imóvel
app.put('/api/properties/:id', async (req, res, next) => {
    const { id } = req.params;
    try {
        const updatedProperty = await prisma.property.update({
            where: { id: parseInt(id) }, data: req.body,
        });
        res.json(updatedProperty);
    } catch (error) {
        next(error);
    }
});

// Rota para DELETAR um imóvel
app.delete('/api/properties/:id', async (req, res, next) => {
    const { id } = req.params;
    try {
        await prisma.property.delete({ where: { id: parseInt(id) } });
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});


// 6. INICIAR O SERVIDOR

// Middleware de tratamento de erros. Deve ser o último `app.use()`.
app.use((err, req, res, next) => {
    console.error('❌ Erro capturado pelo middleware:', err.stack);

    // Trata erros específicos do Prisma (ex: registro não encontrado)
    if (err.code === 'P2025') {
        return res.status(404).json({ message: 'O registro solicitado não foi encontrado.' });
    }

    // Outros erros do Prisma podem ser tratados aqui...

    // Resposta para erros genéricos
    res.status(500).json({ message: 'Ocorreu um erro inesperado no servidor.' });
});

// Exporta o app para ser usado pela Vercel como uma Serverless Function
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    });
}

module.exports = app; 