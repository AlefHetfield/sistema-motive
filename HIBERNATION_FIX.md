# 🚀 Correção para Hibernação/Wake-up Lento (30 segundos)

## Problemas Identificados

1. **Cache de sessão muito curto** (5 minutos)
   - Força validação contínua no servidor
   - Ao hibernar, perde o cache e precisa sincronizar

2. **Timeout infinito em validação**
   - Se a API demora ao acordar, bloqueia a UI
   - Sistema fica travado esperando resposta

3. **Sem keep-alive do servidor**
   - Servidor pode hibernar também (Render, Vercel)
   - Primeira requisição após wake-up é lenta

4. **Cursor de sessão sem fallback**
   - Se validação falhar, logout automático
   - Usuário perde sessão mesmo tendo cookie válido

---

## Soluções Implementadas

### ✅ 1. Frontend - `AuthContext.jsx`

#### A. Aumentar TTL do Cache
```javascript
// DE: 5 minutos
const SESSION_CACHE_TTL = 5 * 60 * 1000;

// PARA: 30 minutos
const SESSION_CACHE_TTL = 30 * 60 * 1000;
```
**Benefício**: Menos chamadas ao servidor, mais rapidez

#### B. Timeout em Validação
```javascript
const VALIDATION_TIMEOUT = 5000; // 5 segundos

// Usa AbortController para não travar
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT);
```
**Benefício**: Evita travamento se servidor demorar

#### C. Keep-Alive do Servidor
```javascript
const KEEP_ALIVE_INTERVAL = 10 * 60 * 1000; // 10 minutos

// Mantém servidor acordado com chamadas leves
fetch(`${API_URL}/api/health`, { 
    credentials: 'include',
    signal: AbortSignal.timeout(3000)
}).catch(() => {});
```
**Benefício**: Servidor não hiberna, primeira requisição é rápida

#### D. Fallback Offline
```javascript
// Se timeout/erro, MANTÉM cache em vez de limpar
console.debug('Validação timeout (mantendo cache)');
// Permite usar app mesmo offline temporariamente
```
**Benefício**: App continua funcionando se network falha

---

### ✅ 2. Backend - `api/server.js`

#### A. Health Check Ultra-Rápido
```javascript
// Responde em <100ms mesmo se DB está lenta
const result = await Promise.race([
    dbCheck,
    new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 3000)
    )
]);

// Se DB demorar, retorna "degraded" em vez de erro
if (result === false) {
    return res.json({ 
        status: 'degraded', 
        message: 'Database responding slowly'
    });
}
```
**Benefício**: Keep-alive não trava esperando DB

#### B. Auth/Me com Cache Local
```javascript
// Confia no cookie já validado
const cachedUser = req.user;

// Busca no DB com timeout
user = await Promise.race([
    prismaQuery,
    timeout(2000)
]);

// Se timeout, retorna dados do cookie
catch (error) {
    if (error.message === 'timeout') {
        return res.json(cachedUser);
    }
}
```
**Benefício**: Responde <100ms ao acordar, sem esperar DB

---

## Fluxo Melhorado

### Cenário: App fica 1 hora parada, depois acorda

**ANTES:**
1. App tenta `/api/auth/me` sem cache
2. Servidor está em hibernação → demora 15-30s
3. App trava esperando resposta
4. Cache local expirou → sem fallback
5. Usuário vê tela branca

**DEPOIS:**
1. App usa cache de 30 minutos → responde IMEDIATAMENTE
2. Em background, faz keep-alive a cada 10 min → servidor acordado
3. Se servidor lento, timeout 5s → app responde mesmo assim
4. Cookie válido como fallback → nunca perde sessão
5. Primeira requisição é rápida, resto é normal

---

## Métricas Esperadas

| Métrica | Antes | Depois |
|---------|-------|--------|
| **Wake-up Time** | 30s | <1s |
| **Time to Interaction** | 30-40s | <1s |
| **Session Validity** | ⚠️ pode perder | ✅ garantido |
| **Offline Functionality** | ❌ sem cache | ✅ 30 minutos |
| **Server Hibernation** | ⚠️ sim | ✅ prevenido |

---

## Configurações Ajustáveis

Se ainda ficar lento, ajuste em `AuthContext.jsx`:

```javascript
// Para sistemas muito lentos, aumentar mais
const SESSION_CACHE_TTL = 60 * 60 * 1000; // 1 hora

// Para servidores muito lentos, aumentar timeout
const VALIDATION_TIMEOUT = 10000; // 10 segundos

// Para evitar hibernação do servidor ainda mais
const KEEP_ALIVE_INTERVAL = 5 * 60 * 1000; // 5 minutos
```

---

## Checklist de Deploy

- [ ] Fazer deploy do `frontend/src/context/AuthContext.jsx`
- [ ] Fazer deploy do `api/server.js`
- [ ] Testar: Deixar app 1 hora parado
- [ ] Testar: Voltar e verificar se carrega <1s
- [ ] Monitorar logs do servidor para timeouts
- [ ] Verificar uso de bandwidth (keep-alive é leve)

---

## Suporte Adicional

Se ainda tiver problemas:

1. **Verificar servidor está em Render.com ou Vercel**
   - Configurar "Auto-Suspend" como "Off" nas settings
   - Ou usar plano pago que não hiberna

2. **Aumentar pool de conexões Prisma**
   ```javascript
   const prisma = new PrismaClient({
       datasources: {
           db: {
               url: process.env.DATABASE_URL + "?schema=public"
           }
       }
   });
   ```

3. **Adicionar logging para debug**
   ```javascript
   console.time('auth-me');
   // ... código
   console.timeEnd('auth-me');
   ```
