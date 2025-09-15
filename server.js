// =================================================================================
// SERVIDOR BACKEND SIMPLES COM NODE.JS E EXPRESS
// =================================================================================

// 1. IMPORTAR DEPENDÊNCIAS
const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Carrega as variáveis do arquivo .env
const { Pool } = require('pg');

// 2. INICIALIZAR O APLICATIVO EXPRESS
const app = express();
const port = 3000; // A porta em que nosso servidor vai rodar

// 3. CONFIGURAR MIDDLEWARES
// O 'cors' permite que nosso frontend (rodando em outra porta/origem) acesse esta API.
app.use(cors());
// O 'express.json()' permite que o servidor entenda requisições com corpo em formato JSON.
app.use(express.json());

// 4. CONFIGURAÇÃO DO BANCO DE DADOS POSTGRESQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        // Necessário para conexões com bancos de dados em nuvem como Supabase, Heroku, etc.
        rejectUnauthorized: false
    }
});

// Adiciona um teste de conexão para fornecer um feedback claro no console.
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Erro ao conectar com o banco de dados:', err.stack);
        console.error('   Verifique se o serviço do PostgreSQL está rodando e se as credenciais no arquivo .env estão corretas.');
        return;
    }
    console.log('✅ Conexão com o banco de dados PostgreSQL estabelecida com sucesso!');
    client.release();
});


// 5. DEFINIR AS ROTAS DA API (ENDPOINTS)

// Rota para BUSCAR TODOS os clientes (GET /api/clients)
app.get('/api/clients', async (req, res) => {
    try {
        console.log('GET /api/clients - Buscando todos os clientes do banco de dados');
        const { rows } = await pool.query('SELECT * FROM clients ORDER BY "createdAt" DESC');
        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar clientes:', err.stack);
        res.status(500).json({ message: 'Erro no servidor ao buscar clientes' });
    }
});

// Rota para BUSCAR UM cliente pelo ID (GET /api/clients/:id)
app.get('/api/clients/:id', async (req, res) => {
    const { id } = req.params;
    try {
        console.log(`GET /api/clients/${id} - Buscando cliente`);
        const { rows } = await pool.query('SELECT * FROM clients WHERE id = $1', [id]);
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ message: 'Cliente não encontrado' });
        }
    } catch (err) {
        console.error(`Erro ao buscar cliente ${id}:`, err.stack);
        res.status(500).json({ message: 'Erro no servidor ao buscar cliente' });
    }
});

// Rota para CRIAR um novo cliente (POST /api/clients)
app.post('/api/clients', async (req, res) => {
    const { nome, cpf, areaInteresse, corretor, responsavel, observacoes, agencia, modalidade } = req.body;
    const status = 'Aprovado'; // Status padrão para novos clientes
    
    try {
        console.log(`POST /api/clients - Criando novo cliente: ${nome}`);
        const query = `
            INSERT INTO clients(nome, cpf, "areaInteresse", corretor, responsavel, observacoes, agencia, modalidade, status)
            VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *;
        `;
        const values = [nome, cpf, areaInteresse, corretor, responsavel, observacoes, agencia, modalidade, status];
        const { rows } = await pool.query(query, values);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Erro ao criar cliente:', err.stack);
        res.status(500).json({ message: 'Erro no servidor ao criar cliente' });
    }
});

// Rota para ATUALIZAR um cliente existente (PUT /api/clients/:id)
app.put('/api/clients/:id', async (req, res) => {
    const { id } = req.params;
    const fields = Object.keys(req.body);
    const values = Object.values(req.body);
    
    // Constrói a cláusula SET dinamicamente para atualizar apenas os campos enviados
    const setClause = fields.map((field, index) => `"${field}" = $${index + 1}`).join(', ');
    
    if (fields.length === 0) {
        return res.status(400).json({ message: 'Nenhum campo para atualizar' });
    }
    
    try {
        console.log(`PUT /api/clients/${id} - Atualizando cliente`);
        const query = `
            UPDATE clients
            SET ${setClause}, "ultimaAtualizacao" = NOW()
            WHERE id = $${fields.length + 1}
            RETURNING *;
        `;
        const { rows } = await pool.query(query, [...values, id]);
        
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ message: 'Cliente não encontrado' });
        }
    } catch (err) {
        console.error(`Erro ao atualizar cliente ${id}:`, err.stack);
        res.status(500).json({ message: 'Erro no servidor ao atualizar cliente' });
    }
});

// Rota para DELETAR um cliente (DELETE /api/clients/:id)
app.delete('/api/clients/:id', async (req, res) => {
    const { id } = req.params;
    try {
        console.log(`DELETE /api/clients/${id} - Deletando cliente`);
        const result = await pool.query('DELETE FROM clients WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }
        res.status(204).send(); // 204 No Content (sucesso, sem corpo de resposta)
    } catch (err) {
        console.error(`Erro ao deletar cliente ${id}:`, err.stack);
        res.status(500).json({ message: 'Erro no servidor ao deletar cliente' });
    }
});

// =================================================================================
// ROTAS DA API PARA USUÁRIOS
// =================================================================================

// Rota para BUSCAR TODOS os usuários
app.get('/api/users', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM users ORDER BY nome ASC');
        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar usuários:', err.stack);
        res.status(500).json({ message: 'Erro no servidor ao buscar usuários' });
    }
});

// Rota para CRIAR um novo usuário
app.post('/api/users', async (req, res) => {
    const { nome, email, role } = req.body;
    try {
        const query = 'INSERT INTO users(nome, email, role) VALUES($1, $2, $3) RETURNING *;';
        const { rows } = await pool.query(query, [nome, email, role]);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Erro ao criar usuário:', err.stack);
        res.status(500).json({ message: 'Erro no servidor ao criar usuário' });
    }
});

// Rota para ATUALIZAR um usuário
app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, email, role } = req.body;
    try {
        const query = 'UPDATE users SET nome = $1, email = $2, role = $3 WHERE id = $4 RETURNING *;';
        const { rows } = await pool.query(query, [nome, email, role, id]);
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ message: 'Usuário não encontrado' });
    } catch (err) {
        console.error(`Erro ao atualizar usuário ${id}:`, err.stack);
        res.status(500).json({ message: 'Erro no servidor ao atualizar usuário' });
    }
});

// Rota para DELETAR um usuário
app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        console.error(`Erro ao deletar usuário ${id}:`, err.stack);
        res.status(500).json({ message: 'Erro no servidor ao deletar usuário' });
    }
});

// 6. INICIAR O SERVIDOR

// Exporta o app para ser usado pela Vercel como uma Serverless Function
module.exports = app;