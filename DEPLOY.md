# 🚀 Guia de Deploy - Sistema Motive

## 📋 Pré-requisitos

1. Conta na [Vercel](https://vercel.com)
2. Conta no [Neon](https://neon.tech) (PostgreSQL)
3. Git instalado
4. Node.js 18+ instalado

---

## 🔧 Configuração Local

### 1. Instalar Dependências

```bash
# Raiz do projeto
npm install

# Frontend
cd frontend
npm install
cd ..
```

### 2. Configurar Variáveis de Ambiente

Crie o arquivo `.env` na raiz com base no `.env.example`:

```env
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://user:pass@host/db?sslmode=require"
JWT_SECRET="sua-chave-secreta-aqui"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="seu-email@gmail.com"
SMTP_PASS="senha-de-app"
REPORT_RECIPIENTS="email1@example.com,email2@example.com"
CORS_ORIGIN="http://localhost:5173"
```

### 3. Rodar Migrações

```bash
npx prisma migrate deploy
npx prisma generate
```

### 4. Criar Usuário Administrador

```bash
node api/server.js
# Ou use um script de seed se tiver
```

---

## 🌐 Deploy na Vercel

### Passo 1: Preparar o Repositório

```bash
# Commit todas as alterações
git add .
git commit -m "Preparar para deploy"
git push origin main
```

### Passo 2: Importar Projeto na Vercel

1. Acesse [vercel.com](https://vercel.com)
2. Clique em **"Add New Project"**
3. Importe o repositório `sistema-motive`
4. Mantenha as configurações padrão (Vercel detecta automaticamente)

### Passo 3: Configurar Variáveis de Ambiente na Vercel

No painel da Vercel, vá em **Settings > Environment Variables** e adicione:

```
DATABASE_URL=sua-url-do-neon
DATABASE_URL_UNPOOLED=sua-url-do-neon-unpooled
JWT_SECRET=sua-chave-secreta-segura
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=motiveimoveis@gmail.com
SMTP_PASS=sua-senha-de-app
REPORT_RECIPIENTS=email1@example.com,email2@example.com
NODE_ENV=production
```

**⚠️ IMPORTANTE:** 
- Não copie as variáveis do `.env` local - use as credenciais de produção
- Gere um novo `JWT_SECRET` seguro para produção
- Configure `CORS_ORIGIN` com a URL da Vercel

### Passo 4: Deploy

1. Clique em **"Deploy"**
2. Aguarde o build completar (pode levar alguns minutos)
3. Vercel vai gerar uma URL: `https://seu-projeto.vercel.app`

### Passo 5: Configurar CORS

Após o primeiro deploy, atualize a variável de ambiente:

```
CORS_ORIGIN=https://seu-projeto.vercel.app
```

E faça um **Redeploy** para aplicar.

---

## 🔐 Segurança Pós-Deploy

### 1. Trocar Senha do Administrador

Faça login com o usuário admin padrão e **imediatamente troque a senha** em Configurações.

### 2. Verificar Variáveis de Ambiente

Certifique-se de que:
- `JWT_SECRET` é diferente do desenvolvimento
- Credenciais SMTP estão corretas
- `NODE_ENV=production`

### 3. Testar Funcionalidades

- ✅ Login/Logout
- ✅ Criação de clientes
- ✅ Mudança de status
- ✅ Relatórios automáticos
- ✅ Gestão de usuários

---

## 🔄 Atualizações Futuras

Para atualizar o sistema em produção:

```bash
# Fazer alterações localmente
git add .
git commit -m "Descrição das mudanças"
git push origin main

# Vercel faz deploy automático!
```

---

## 🐛 Troubleshooting

### Erro: "Cannot find module @prisma/client"

```bash
npx prisma generate
```

### Erro de CORS

Verifique se `CORS_ORIGIN` está configurado corretamente na Vercel.

### Banco de dados não conecta

- Verifique as credenciais do Neon
- Confirme que `?sslmode=require` está na URL
- Use `DATABASE_URL_UNPOOLED` para queries longas

### Build falha na Vercel

- Verifique os logs de build na Vercel
- Certifique-se de que todas as dependências estão no `package.json`
- Rode `npm run build` localmente para testar

---

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs da Vercel: **Deployments > [seu deploy] > Building**
2. Verifique os logs do runtime: **Deployments > [seu deploy] > Functions**
3. Teste localmente primeiro: `npm run build`

---

## 🎉 Sistema Pronto!

Seu sistema está no ar em: `https://seu-projeto.vercel.app`

**Credenciais padrão (TROQUE IMEDIATAMENTE):**
- Email: admin@motive.com
- Senha: admin123
