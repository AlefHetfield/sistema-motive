# 🚀 Deploy na Vercel - Sistema Motive

## 📋 Pré-requisitos
- Conta na [Vercel](https://vercel.com)
- Conta no [Neon](https://neon.tech) ou outro provedor PostgreSQL
- Repositório no GitHub (já configurado ✅)

## 🔧 Passo 1: Configurar Banco de Dados

### Opção A: Neon Database (Recomendado - Grátis)
1. Acesse [neon.tech](https://neon.tech) e crie uma conta
2. Crie um novo projeto
3. Copie a **Connection String** (formato: `postgresql://user:password@host/database`)

### Opção B: Outro provedor PostgreSQL
- Use qualquer provedor que ofereça PostgreSQL (Supabase, Railway, etc.)
- Copie a connection string

## 🌐 Passo 2: Deploy na Vercel

### Via Dashboard Web:
1. Acesse [vercel.com/new](https://vercel.com/new)
2. Importe seu repositório: `AlefHetfield/sistema-motive`
3. Configure as variáveis de ambiente (próximo passo)
4. Clique em **Deploy**

### Via CLI (Alternativa):
```bash
npm i -g vercel
vercel login
vercel
```

## 🔐 Passo 3: Configurar Variáveis de Ambiente

Na Vercel, vá em **Settings → Environment Variables** e adicione:

### Obrigatórias:
```env
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
NODE_ENV=production
SESSION_SECRET=sua-chave-secreta-aqui-minimo-32-caracteres
CORS_ORIGIN=https://seu-dominio.vercel.app
```

### Opcionais (Para relatórios por email):
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-app
REPORT_TO=destinatario@email.com
REPORT_FROM=seu-email@gmail.com
TZ=America/Sao_Paulo
```

## 📝 Como gerar SESSION_SECRET
Execute no terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🔄 Passo 4: Rodar Migrações do Prisma

Após o primeiro deploy, você precisa rodar as migrações. Há duas opções:

### Opção A: Automático (já configurado no vercel-build)
As migrações rodam automaticamente durante o build via `npm run db:migrate:deploy`, com novas tentativas limitadas apenas para timeout do advisory lock. O Prisma CLI usa a conexão direta configurada em `DIRECT_URL` ou `DATABASE_URL_UNPOOLED`; no Neon, deriva o endpoint direto da `DATABASE_URL` quando ambas estão ausentes. A conexão da API permanece inalterada.

### Opção B: Manual (se necessário)
```bash
# Localmente, com DATABASE_URL configurado
npx prisma migrate deploy
npx prisma generate
```

## 👤 Passo 5: Criar Usuário Admin

Após o deploy, você precisa criar um usuário admin no banco:

### Opção A: Via Prisma Studio (Localmente)
```bash
# Configure DATABASE_URL no .env local com a URL de produção
npx prisma studio
```

### Opção B: Via SQL direto no Neon Dashboard
```sql
INSERT INTO "User" (email, "passwordHash", name, role, "isActive", "createdAt", "updatedAt")
VALUES (
  'admin@motive.com',
  '$2a$10$YourHashedPasswordHere',
  'Administrador',
  'ADMIN',
  true,
  NOW(),
  NOW()
);
```

### Opção C: Script Node.js (Recomendado)
Crie um arquivo temporário `create-admin-prod.js`:
```javascript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('sua-senha-aqui', 10);
  
  const admin = await prisma.user.create({
    data: {
      email: 'admin@motive.com',
      passwordHash,
      name: 'Administrador',
      role: 'ADMIN',
      isActive: true,
    }
  });
  
  console.log('Admin criado:', admin.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Execute:
```bash
# Configure DATABASE_URL no .env com a URL de produção
node create-admin-prod.js
```

## ✅ Verificação

1. Acesse `https://seu-dominio.vercel.app`
2. Teste o login com o usuário admin criado
3. Verifique se consegue:
   - Ver o dashboard
   - Criar/editar clientes
   - Gerenciar usuários (se admin)

## 🔧 Troubleshooting

### Build falha:
- Verifique se `DATABASE_URL` está configurado
- Veja os logs no Vercel Dashboard

### API não responde:
- Confirme que `CORS_ORIGIN` está correto
- Verifique os logs da função serverless

### Erro de autenticação:
- Confirme que `SESSION_SECRET` está configurado
- Verifique se o cookie está sendo enviado

### Prisma Client Error:
```bash
# Regenere o Prisma Client localmente e faça commit
npx prisma generate
git add -A
git commit -m "Update Prisma Client"
git push
```

## 🔄 Redeploys Futuros

Sempre que você fizer push para `main`, a Vercel fará o deploy automaticamente!

```bash
git add .
git commit -m "Sua mensagem"
git push origin main
```

## 📚 Links Úteis

- [Vercel Dashboard](https://vercel.com/dashboard)
- [Vercel Docs](https://vercel.com/docs)
- [Neon Dashboard](https://console.neon.tech)
- [Prisma Docs](https://www.prisma.io/docs)
