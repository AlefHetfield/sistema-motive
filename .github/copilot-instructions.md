# Sistema Motive - Instruções para Agentes AI

## Visão Geral da Arquitetura

Este é um CRM imobiliário full-stack com:
- **Frontend**: React 19 + Vite + TailwindCSS + HeroUI (porta 5173)
- **Backend**: Express.js serverless na Vercel (porta 3000)
- **Banco**: PostgreSQL via Prisma ORM
- **Deploy**: Frontend e API na Vercel

### Principais Modelos de Dados
- `Client`: Clientes com corretor, responsável, status, processo/venda/remuneração flags
- `User`: Sistema de autenticação com roles `ADM` e `CORRETOR`
- `ActivityLog`: Histórico de alterações em clientes

## Autenticação (Cookie-Based)

**Sistema de sessão sem JWT:**
- Login em `/api/auth/login` retorna cookie `motive_session` (base64 payload)
- Middleware `requireAuth` e `requireRole(...roles)` validam rotas protegidas
- Frontend usa `AuthContext` com cache localStorage (30 min TTL) para evitar cold starts
- Keep-alive a cada 10 min mantém o backend acordado (Vercel serverless)

**Convenção**: Sempre use `credentials: 'include'` em `fetch()` no frontend.

**Validação de sessão:**
```javascript
// Backend: api/server.js
function readSession(req) {
  const raw = req.cookies?.[SESSION_COOKIE];
  if (!raw) return null;
  return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
}
```

## Fluxo de Dados Cliente

**Criar/Editar Cliente:**
1. Formulário em [ClientsList.jsx](frontend/src/pages/ClientsList.jsx) usa `ClientModal.jsx`
2. POST/PUT em `/api/clients` ou `/api/clients/:id` (veja [api/server.js](api/server.js))
3. Grava `ultimoUsuarioAlteracao` do user logado
4. Cria `ActivityLog` automático (action: `created`/`updated`/`status_changed`)
5. Frontend recarrega lista com `fetchClients()` de [api.js](frontend/src/services/api.js)

**Convenção de Status:** `Em Análise`, `Aprovado`, `Assinado-Movido`, `Arquivado` (estados finais).

## Relatórios Automáticos (Cron Jobs)

**Mensal** (dia 1 às 09:00):
- Endpoint: `GET /api/reports/monthly/run?month=11&year=2025`
- Gera Excel com métricas (novos, assinados, taxa conversão, média dias até assinatura)
- Envia via SMTP (nodemailer) ou salva local em `./reports/`

**Semanal** (segunda-feira 09:05):
- Endpoint: `GET /api/reports/weekly/run?start=2025-11-17&end=2025-11-24`
- E-mail com resumo + anexo Excel (3 sheets: todos, resumo, novos da semana)

**Variáveis obrigatórias**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `REPORT_TO`.

Implementação em [reportGenerator.js](api/reportGenerator.js) e [emailSender.js](api/emailSender.js).

## Notificações Toast (Sonner)

Use o hook `useToast()` (nunca importe `toast` diretamente de `sonner`):
```javascript
const notify = useToast();
notify.success('Cliente salvo!');
notify.error('Falha ao excluir');
notify.promise(promise, { loading: 'Salvando...', success: 'Pronto!', error: 'Erro' });
```

Configuração global em [App.jsx](frontend/src/App.jsx):
```jsx
<Toaster position="top-right" theme="light" richColors duration={3000} />
```

## Otimizações de Performance

### Cache de Sessão (Frontend)
- `SESSION_CACHE_KEY` em localStorage com TTL de 30 min
- Evita cold start de 20s do Vercel em cada validação
- Implementado em [AuthContext.jsx](frontend/src/context/AuthContext.jsx)

### Compressão (Backend)
- Middleware `compression` ativo (nível 6, threshold 1KB)
- Reduz payloads JSON em até 70%

### Prisma Connection Pooling
- `PrismaClient` configurado para pool de conexões serverless
- Log de queries em desenvolvimento, apenas errors em produção

## Comandos de Desenvolvimento

```powershell
# Instalar dependências
npm install
cd frontend && npm install

# Desenvolvimento local
npm run dev           # Backend na porta 3000
npm run dev:frontend  # Frontend na porta 5173
npm run dev:all       # Ambos com concurrently

# Build e deploy
npm run build         # Build frontend
npm run vercel-build  # Prisma migrate + generate + build (CI/CD)

# Database
npx prisma migrate dev    # Cria nova migração
npx prisma studio         # Interface gráfica DB
npx prisma generate       # Regenera Prisma Client
```

## Convenções de Código

### API Responses
**Sucesso**: `{ ok: true, data: {...} }` ou array direto  
**Erro**: `{ error: 'Mensagem' }` com status HTTP apropriado

### Rotas Protegidas (Frontend)
```jsx
<Route path="dashboard" element={
  <PrivateRoute requiredRole="ADM">
    <Dashboard />
  </PrivateRoute>
} />
```

### Activity Logs
Sempre registrar alterações em clientes via:
```javascript
await prisma.activityLog.create({
  data: {
    clientId, clientNome, action: 'updated',
    statusAntes: 'Em Análise', statusDepois: 'Aprovado',
    userName: req.user.nome
  }
});
```

## Estrutura de Páginas

- **PDF Editor** (`/pdf-editor`): Rota inicial padrão após login
- **Dashboard** (`/dashboard`): Métricas, gráficos (apenas ADM)
- **Clientes** (`/clientes`): Lista CRUD com filtros por status, responsável, flags
- **Usuários** (`/usuarios`): Gerenciamento ADM/CORRETOR (apenas ADM)
- **Configurações** (`/configuracoes`): Troca senha, preferências

## Problemas Conhecidos

1. **Vercel Cold Start**: Primeira requisição leva 15-20s. Mitigado com:
   - Cache localStorage no frontend
   - Keep-alive a cada 10 min
   - Validação em background sem bloquear UI

2. **Hibernação Render.com**: Se usar Render no backend, adicionar pings HTTP externos.

## Referências Rápidas

- [Schema Prisma](prisma/schema.prisma): Modelos completos
- [API Routes](api/server.js): Todos os endpoints REST
- [Auth Flow](frontend/src/context/AuthContext.jsx): Lógica de sessão e cache
- [Toast System](frontend/src/hooks/useToast.js): Exemplos de uso
- [Architecture Diagram](ARCHITECTURE_DIAGRAM.md): Fluxo de otimizações
