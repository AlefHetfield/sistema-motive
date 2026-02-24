# Script de Teste Rápido da API Render
# Uso: .\test-render-api.ps1

param(
    [string]$ApiUrl = "https://sistema-motive-api.onrender.com",
    [string]$Email = "admin@motive.com",
    [string]$Password = ""
)

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Teste da API - Sistema Motive" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# 1. Health Check
Write-Host "[1/4] Testando Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$ApiUrl/api/health" -ErrorAction Stop
    Write-Host "  ✅ Status: $($health.status)" -ForegroundColor Green
    Write-Host "  ⏰ Timestamp: $($health.timestamp)" -ForegroundColor Gray
} catch {
    Write-Host "  ❌ Falhou: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 2. Diagnóstico Completo
Write-Host "[2/4] Executando Diagnóstico Completo..." -ForegroundColor Yellow
try {
    $debug = Invoke-RestMethod -Uri "$ApiUrl/api/debug/status" -ErrorAction Stop
    
    Write-Host "  📊 Ambiente: $($debug.environment)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  🗄️  Banco de Dados:" -ForegroundColor White
    
    if ($debug.database.status -eq "connected") {
        Write-Host "    ✅ Status: CONECTADO" -ForegroundColor Green
        Write-Host "    👥 Usuários no banco: $($debug.database.userCount)" -ForegroundColor Green
    } else {
        Write-Host "    ❌ Status: DESCONECTADO" -ForegroundColor Red
        Write-Host "    ⚠️  Erro: $($debug.database.error)" -ForegroundColor Red
    }
    
    Write-Host "    🔑 DATABASE_URL configurada: $($debug.database.url_configured)" -ForegroundColor Gray
    Write-Host "    🔗 Preview: $($debug.database.url_preview)" -ForegroundColor Gray
    
    Write-Host ""
    Write-Host "  🌐 CORS:" -ForegroundColor White
    Write-Host "    Origin permitida: $($debug.cors.origin)" -ForegroundColor Gray
    
    Write-Host ""
    Write-Host "  🍪 Cookies:" -ForegroundColor White
    Write-Host "    Parser ativo: $($debug.cookies.parser_active)" -ForegroundColor Gray
    Write-Host "    Cookies recebidos: $($debug.cookies.received.Count)" -ForegroundColor Gray
    
    # Se banco não conectou, para aqui
    if ($debug.database.status -ne "connected") {
        Write-Host ""
        Write-Host "⚠️  PROBLEMA: Banco de dados não está conectado!" -ForegroundColor Red
        Write-Host "   Verifique a variável DATABASE_URL no Render Dashboard" -ForegroundColor Yellow
        Write-Host "   Veja: TROUBLESHOOT_RENDER.md seção 'A) Banco de Dados Não Conectado'" -ForegroundColor Yellow
        exit 1
    }
    
} catch {
    Write-Host "  ❌ Falhou: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 3. Teste de Login (se senha fornecida)
if ([string]::IsNullOrEmpty($Password)) {
    Write-Host "[3/4] ⏭️  Pulando teste de login (senha não fornecida)" -ForegroundColor Yellow
    Write-Host "      Uso: .\test-render-api.ps1 -Email 'seu@email.com' -Password 'sua-senha'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "✅ DIAGNÓSTICO CONCLUÍDO" -ForegroundColor Green
    exit 0
}

Write-Host "[3/4] Testando Login..." -ForegroundColor Yellow

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

$loginBody = @{
    email = $Email
    password = $Password
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod `
        -Uri "$ApiUrl/api/auth/login" `
        -Method Post `
        -ContentType "application/json" `
        -Body $loginBody `
        -WebSession $session `
        -ErrorAction Stop
    
    if ($loginResponse.ok) {
        Write-Host "  ✅ Login bem-sucedido!" -ForegroundColor Green
        Write-Host "    👤 Usuário: $($loginResponse.user.nome)" -ForegroundColor Gray
        Write-Host "    📧 Email: $($loginResponse.user.email)" -ForegroundColor Gray
        Write-Host "    🔐 Role: $($loginResponse.user.role)" -ForegroundColor Gray
        
        # Verifica se tem cookies
        if ($session.Cookies.Count -gt 0) {
            Write-Host "    🍪 Cookie de sessão recebido!" -ForegroundColor Green
        } else {
            Write-Host "    ⚠️  Nenhum cookie recebido!" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ❌ Login falhou: $($loginResponse.error)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ❌ Erro no login: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "    Resposta: $responseBody" -ForegroundColor Gray
    }
    exit 1
}

Write-Host ""

# 4. Teste /api/users (requer login ADM)
Write-Host "[4/4] Testando acesso a /api/users..." -ForegroundColor Yellow

try {
    $users = Invoke-RestMethod `
        -Uri "$ApiUrl/api/users" `
        -WebSession $session `
        -ErrorAction Stop
    
    Write-Host "  ✅ Sucesso! Usuários encontrados: $($users.Count)" -ForegroundColor Green
    Write-Host ""
    Write-Host "  📋 Lista de Usuários:" -ForegroundColor White
    
    $users | ForEach-Object {
        $statusIcon = if ($_.isActive) { "✅" } else { "❌" }
        Write-Host "    $statusIcon [$($_.role)] $($_.nome) ($($_.email))" -ForegroundColor Gray
    }
    
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "  ❌ Erro ${statusCode}: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($statusCode -eq 401) {
        Write-Host "    Causa: Não autenticado (cookie não enviado?)" -ForegroundColor Yellow
    } elseif ($statusCode -eq 403) {
        Write-Host "    Causa: Acesso negado (usuário não é ADM)" -ForegroundColor Yellow
    } elseif ($statusCode -eq 500) {
        Write-Host "    Causa: Erro interno do servidor" -ForegroundColor Yellow
        Write-Host "    Veja os logs no Render Dashboard!" -ForegroundColor Yellow
    }
    
    exit 1
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  ✅ TODOS OS TESTES PASSARAM!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
