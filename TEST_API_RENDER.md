# Script de Teste Rápido - API Render.com

## Teste no Navegador (Console)

Abra o DevTools (F12) no navegador e execute:

```javascript
// 1. Teste básico de health
fetch('https://sistema-motive-api.onrender.com/api/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);

// 2. Teste de diagnóstico completo
fetch('https://sistema-motive-api.onrender.com/api/debug/status')
  .then(r => r.json())
  .then(data => {
    console.log('=== DIAGNÓSTICO ===');
    console.log('Database:', data.database);
    console.log('CORS:', data.cors);
    console.log('Cookies recebidos:', data.cookies.received);
  })
  .catch(console.error);

// 3. Teste de login (SUBSTITUA email e senha)
fetch('https://sistema-motive-api.onrender.com/api/auth/login', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@motive.com',
    password: 'sua-senha-aqui'
  })
})
  .then(r => r.json())
  .then(data => {
    console.log('Login:', data);
    if (data.ok) {
      console.log('✅ Login OK! Testando /api/users...');
      
      // 4. Teste /api/users COM cookie de sessão
      return fetch('https://sistema-motive-api.onrender.com/api/users', {
        credentials: 'include'
      });
    }
  })
  .then(r => r?.json())
  .then(users => {
    if (users) {
      console.log('✅ Usuários:', users);
    }
  })
  .catch(err => console.error('❌ Erro:', err));
```

## Teste via PowerShell (Windows)

```powershell
# 1. Health Check
Invoke-RestMethod -Uri "https://sistema-motive-api.onrender.com/api/health"

# 2. Diagnóstico
$debug = Invoke-RestMethod -Uri "https://sistema-motive-api.onrender.com/api/debug/status"
Write-Host "Database Status:" $debug.database.status
Write-Host "User Count:" $debug.database.userCount
Write-Host "DB URL Configured:" $debug.database.url_configured

# 3. Login e teste /api/users
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

$loginBody = @{
  email = "admin@motive.com"
  password = "sua-senha"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod `
  -Uri "https://sistema-motive-api.onrender.com/api/auth/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body $loginBody `
  -WebSession $session

Write-Host "Login OK:" $loginResponse.ok

# Agora testa /api/users com o cookie
$users = Invoke-RestMethod `
  -Uri "https://sistema-motive-api.onrender.com/api/users" `
  -WebSession $session

Write-Host "Usuários encontrados:" $users.Count
$users | Format-Table id, nome, email, role
```

## Teste via cURL (Linux/Mac/Git Bash)

```bash
#!/bin/bash

API_URL="https://sistema-motive-api.onrender.com"
COOKIES_FILE="cookies.txt"

echo "=== 1. Health Check ==="
curl -s "$API_URL/api/health" | jq .

echo -e "\n=== 2. Diagnóstico ==="
curl -s "$API_URL/api/debug/status" | jq .

echo -e "\n=== 3. Login ==="
curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@motive.com","password":"sua-senha"}' \
  -c "$COOKIES_FILE" | jq .

echo -e "\n=== 4. Listar Usuários (com cookie) ==="
curl -s "$API_URL/api/users" \
  -b "$COOKIES_FILE" | jq .

# Limpa
rm -f "$COOKIES_FILE"
```

## Interpretando os Resultados

### ✅ Sucesso
```json
{
  "database": {
    "status": "connected",
    "userCount": 5
  }
}
```
→ **Banco OK!**

### ❌ Problema no Banco
```json
{
  "database": {
    "status": "disconnected",
    "error": "getaddrinfo ENOTFOUND...",
    "url_configured": false
  }
}
```
→ **DATABASE_URL não configurada ou inválida**

### ❌ Problema de Autenticação
```json
{
  "error": "Não autenticado"
}
```
→ **Cookie não está sendo enviado/recebido**

### ❌ Problema de Permissão
```json
{
  "error": "Acesso negado"
}
```
→ **Usuário logado não é ADM**

## Checklist de Variáveis no Render

No dashboard do Render, vá em **Environment** e verifique:

```
DATABASE_URL = postgresql://user:pass@host.neon.tech/db?sslmode=require
CORS_ORIGIN = https://seu-frontend.vercel.app
NODE_ENV = production
```

⚠️ **Importante:** Após adicionar/mudar variáveis, o Render faz redeploy automático (aguarde ~2 min).

## Próximos Passos

1. Execute o teste de diagnóstico
2. Copie o resultado
3. Verifique qual seção do troubleshooting se aplica
4. Siga as soluções específicas

**Se tudo falhar:** Compartilhe o output do `/api/debug/status` para análise detalhada.
