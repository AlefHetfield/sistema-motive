# Troubleshooting - Erro 500 no Render.com

## Problema Atual
❌ `GET /api/users` retornando status 500 no Render.com

## Diagnóstico Rápido

### 1. Teste a rota de diagnóstico (adicionada agora)
Acesse no navegador ou Postman:
```
https://sistema-motive-api.onrender.com/api/debug/status
```

Isso vai mostrar:
- ✅ Status da conexão com banco de dados
- ✅ Quantidade de usuários no banco
- ✅ Variáveis de ambiente configuradas
- ✅ Configurações de CORS e cookies

### 2. Verifique os logs no Render Dashboard

1. Acesse: https://dashboard.render.com
2. Clique no serviço `sistema-motive-api`
3. Vá em **Logs** (aba lateral)
4. Procure por mensagens de erro:
   - `[USERS] Erro ao listar usuários:`
   - `[AUTH] Sessão não encontrada`
   - `DATABASE_URL configurada? false`
   - Mensagens do Prisma sobre conexão

### 3. Possíveis Causas e Soluções

#### A) Banco de Dados Não Conectado
**Sintomas:**
```json
{
  "database": {
    "status": "disconnected",
    "error": "Can't reach database server...",
    "url_configured": false
  }
}
```

**Soluções:**
1. Verifique se `DATABASE_URL` está configurada no Render:
   - Dashboard → serviço → Environment
   - Adicione: `DATABASE_URL=postgresql://user:pass@host/db?sslmode=require`

2. Se estiver usando Neon (recomendado):
   - Copie a connection string do painel Neon
   - Use a versão **pooled** (não a unpooled)
   - Formato: `postgresql://usuario:senha@ep-xxx.region.aws.neon.tech/database?sslmode=require`

3. Teste manualmente a conexão:
   ```bash
   psql "postgresql://user:pass@host/db?sslmode=require"
   ```

#### B) Prisma Client Não Gerado
**Sintomas:**
```
Error: Cannot find module '@prisma/client'
```

**Soluções:**
1. Verifique o `buildCommand` no `render.yaml`:
   ```yaml
   buildCommand: npm install && npx prisma generate && npx prisma migrate deploy
   ```

2. Force um redeploy:
   - Dashboard → Manual Deploy → Deploy latest commit

3. Se o problema persistir, adicione ao `package.json`:
   ```json
   {
     "scripts": {
       "build": "npx prisma generate",
       "postinstall": "npx prisma generate"
     }
   }
   ```

#### C) Cookie de Sessão Não Chegando
**Sintomas:**
```json
{
  "cookies": {
    "received": []
  }
}
```

**Logs mostram:**
```
[AUTH] Sessão não encontrada - cookies recebidos: []
```

**Soluções:**
1. Verifique se `CORS_ORIGIN` está correto no Render:
   ```
   CORS_ORIGIN=https://seu-frontend.vercel.app
   ```
   ⚠️ **Importante:** Sem barra `/` no final!

2. No frontend, verifique se todas as requisições usam `credentials: 'include'`:
   ```javascript
   // frontend/src/services/api.js
   const response = await fetch(`${API_BASE_URL}/api/users`, {
     credentials: 'include',  // OBRIGATÓRIO
     headers: {
       'Content-Type': 'application/json'
     }
   });
   ```

3. Se estiver testando com Postman/Insomnia:
   - **Primeiro** faça login em `/api/auth/login`
   - **Depois** use a mesma sessão/cookies para `/api/users`

#### D) Variáveis de Ambiente Faltando
**Checklist:**
```bash
✅ DATABASE_URL         # postgresql://...
✅ CORS_ORIGIN          # https://frontend.vercel.app
✅ NODE_ENV             # production
⚠️ SESSION_SECRET       # Opcional mas recomendado
⚠️ SMTP_* (4 variáveis) # Só se usar relatórios por email
```

Para adicionar no Render:
1. Dashboard → serviço → Environment
2. Clique em **Add Environment Variable**
3. Adicione cada uma e clique **Save Changes**
4. Render fará redeploy automático

#### E) Migração do Banco Não Executada
**Sintomas:**
```
Error: relation "users" does not exist
Invalid `prisma.user.findMany()` invocation
```

**Soluções:**
1. Execute as migrações manualmente:
   ```bash
   # No seu terminal local, conectado ao banco do Render
   DATABASE_URL="postgresql://..." npx prisma migrate deploy
   ```

2. Ou force redeploy no Render (vai executar via buildCommand)

3. Verifique se as tabelas existem:
   ```bash
   DATABASE_URL="postgresql://..." npx prisma studio
   ```

### 4. Teste Completo Passo-a-Passo

```bash
# 1. Teste o health check básico
curl https://sistema-motive-api.onrender.com/api/health

# Esperado: {"status":"ok","timestamp":"..."}

# 2. Teste o diagnóstico completo
curl https://sistema-motive-api.onrender.com/api/debug/status

# Esperado: JSON com database.status = "connected"

# 3. Faça login (obtenha cookie de sessão)
curl -X POST https://sistema-motive-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@motive.com","password":"sua-senha"}' \
  -c cookies.txt

# Esperado: {"ok":true,"user":{...},"autoLogin":false}

# 4. Teste /api/users com o cookie
curl https://sistema-motive-api.onrender.com/api/users \
  -b cookies.txt

# Esperado: [{"id":1,"nome":"Admin",...}]
```

### 5. Comandos Úteis para Debug

**Ver logs em tempo real (Render Dashboard):**
```
Dashboard → Logs → [filtro: All Logs]
```

**Testar conexão do banco localmente:**
```bash
# Substitua pela DATABASE_URL do Render
psql "postgresql://user:pass@host/db?sslmode=require"

# Dentro do psql:
\dt             # Lista tabelas
SELECT * FROM users;  # Lista usuários
```

**Forçar rebuild completo:**
```bash
Dashboard → Manual Deploy → Clear build cache & deploy
```

### 6. Checklist Final

Antes de testar novamente, confirme:
- [ ] `DATABASE_URL` configurada e válida
- [ ] Banco de dados acessível (não bloqueado por firewall)
- [ ] Prisma Client gerado no build
- [ ] Migrações executadas (`npx prisma migrate deploy`)
- [ ] `CORS_ORIGIN` aponta para o frontend correto
- [ ] Ao menos 1 usuário ADM existe no banco
- [ ] Logs do Render não mostram erros de build

### 7. Se Nada Funcionar

1. **Verifique se o serviço está ativo:**
   - Dashboard → Overview → Status deve estar "Live" (verde)

2. **Tente criar um usuário ADM manualmente:**
   ```bash
   # Via Prisma Studio ou SQL direto
   INSERT INTO users (nome, email, "passwordHash", role, "isActive")
   VALUES ('Admin', 'admin@test.com', '$2a$10$...', 'ADM', true);
   ```

3. **Teste localmente primeiro:**
   ```bash
   # Clone as variáveis do Render
   export DATABASE_URL="postgresql://..."
   export CORS_ORIGIN="http://localhost:5173"
   
   npm install
   npx prisma generate
   npm start
   
   # Teste: http://localhost:3000/api/debug/status
   ```

4. **Compartilhe os logs:**
   - Copie os logs do Render (últimas 50 linhas)
   - Resultado do `/api/debug/status`
   - Abra uma issue com esses dados

## Atualizações Implementadas

✅ Logs detalhados em todos os endpoints de autenticação  
✅ Rota `/api/debug/status` para diagnóstico  
✅ Tratamento de erro aprimorado em `/api/users`  
✅ Validação de variáveis de ambiente

**Teste estas rotas primeiro e compartilhe os resultados!**
