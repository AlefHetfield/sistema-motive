# Deploy do Backend - Sistema Motive

## 🚀 Deploy no Render (Recomendado - Gratuito)

### Passo 1: Criar conta no Render
1. Acesse: https://render.com/
2. Faça login com sua conta GitHub

### Passo 2: Criar novo Web Service
1. No dashboard, clique em **"New +"** → **"Web Service"**
2. Conecte seu repositório: `AlefHetfield/sistema-motive`
3. Configure:
   - **Name:** `sistema-motive-api`
   - **Region:** São Paulo (ou mais próxima)
   - **Branch:** `migracao-react`
   - **Root Directory:** (deixe vazio)
   - **Runtime:** `Node`
   - **Build Command:** `npm run build:api`
   - **Start Command:** `npm start`
   - **Instance Type:** Free

### Passo 3: Adicionar variáveis de ambiente
No Render, vá em **Environment** e adicione:

```
NODE_ENV=production
PORT=3000
DATABASE_URL=sua_url_do_neon_aqui
CORS_ORIGIN=https://sistema-motive.vercel.app
SESSION_SECRET=gere_com_openssl_rand_hex_32

# Timezone para os crons (mensal/semanais)
TZ=America/Sao_Paulo

# === ENVIO DE E-MAIL (escolha uma das opções) ===

# OPÇÃO 1: Resend (RECOMENDADO para Render - portas SMTP bloqueadas no Free tier)
# Crie conta grátis em https://resend.com (3000 emails/mês)
# Adicione e verifique seu domínio ou use onboarding@resend.dev para testes
RESEND_API_KEY=re_sua_chave_aqui
REPORT_TO=destinatario@exemplo.com
REPORT_FROM=onboarding@resend.dev

# OPÇÃO 2: SMTP direto (pode não funcionar no Render Free - portas bloqueadas)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=seu_email@gmail.com
# SMTP_PASS=sua_senha_de_app
# REPORT_TO=destinatario@exemplo.com
# REPORT_FROM=seu_email@gmail.com
```

### Migrações e bloqueios do banco

O Prisma CLI carrega `prisma.config.ts` e usa `DIRECT_URL`, depois `DATABASE_URL_UNPOOLED`, quando configuradas. Sem essas variáveis, o host direto é derivado apenas para URLs Neon (`-pooler` é removido do nome do endpoint). A API continua usando a `DATABASE_URL` original, com pool. Credenciais, banco e SSL são preservados.

O build executa até quatro tentativas quando o Prisma retorna especificamente `P1002` ao adquirir o advisory lock. Outros erros continuam interrompendo o deploy. O bloqueio permanece habilitado. Se outro deploy estiver migrando, aguarde sua conclusão. Se o erro persistir, inspecione as sessões e os bloqueios no Neon antes de qualquer intervenção.

**Serviços Render já criados manualmente:** confira em Settings → Build & Deploy se o Build Command é `npm run build:api`. Alterar `render.yaml` no Git não garante a atualização de um serviço não gerenciado por Blueprint. O comando antigo também carrega a conexão direta via `prisma.config.ts`, mas não inclui as novas tentativas automáticas.

**⚠️ Importante:** O Render bloqueia portas SMTP (587, 465, 25) no plano Free. Use **Resend** (opção 1) para garantir o envio de relatórios.

### Passo 4: Deploy
1. Clique em **"Create Web Service"**
2. Aguarde o deploy (3-5 minutos)
3. Copie a URL gerada (ex: `https://sistema-motive-api.onrender.com`)

### Passo 5: Configurar Frontend
1. Vá no Vercel: https://vercel.com/alefhetfield/sistema-motive/settings/environment-variables
2. Adicione a variável:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://sistema-motive-api.onrender.com` (URL do Render)
   - **Environment:** Production, Preview, Development
3. Faça um redeploy do frontend

---

## 🎯 Alternativas

### Railway
- Mais rápido para configurar
- Free tier: 500 horas/mês
- URL: https://railway.app/

### Fly.io
- Bom desempenho global
- Free tier: 3 shared-cpu VMs
- URL: https://fly.io/

---

## ✅ Verificação

Após o deploy, teste a API:
```bash
curl https://sua-url-api.onrender.com/api/health
```

Se retornar status 200, está funcionando! ✨
