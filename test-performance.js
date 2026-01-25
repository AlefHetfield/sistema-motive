#!/usr/bin/env node

/**
 * Script de validação de performance
 * Execute: node test-performance.js
 */

import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function testHealth() {
  console.log('🧪 Testando Health Check...');
  const start = Date.now();
  
  try {
    const response = await fetch(`${API_URL}/api/health`);
    const duration = Date.now() - start;
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Health Check: ${duration}ms`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Timestamp: ${data.timestamp}`);
      return true;
    } else {
      console.log(`❌ Health Check falhou: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Erro ao testar health: ${error.message}`);
    return false;
  }
}

async function testLogin(email, password) {
  console.log(`\n🔐 Testando Login (${email})...`);
  const start = Date.now();
  
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    const duration = Date.now() - start;
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Login bem-sucedido: ${duration}ms`);
      console.log(`   Usuário: ${data.nome}`);
      console.log(`   Role: ${data.role}`);
      return true;
    } else {
      const error = await response.json();
      console.log(`⚠️ Login falhou (${duration}ms): ${error.error}`);
      return false;
    }
  } catch (error) {
    const duration = Date.now() - start;
    console.log(`❌ Erro no login (${duration}ms): ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║ TESTE DE PERFORMANCE - SISTEMA MOTIVE ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log(`\n📍 API URL: ${API_URL}\n`);
  
  const healthOk = await testHealth();
  
  if (!healthOk) {
    console.log('\n⚠️ API não está respondendo. Certifique-se de que está rodando.');
    console.log('   Execute: npm run dev');
    process.exit(1);
  }
  
  // Testa com credenciais padrão (ajuste conforme seu banco)
  console.log('\n📋 Dica: Certifique-se de ter um usuário de teste no banco.');
  console.log('   Use credenciais válidas para teste de login.\n');
  
  console.log('╔═══════════════════════════════════════╗');
  console.log('║          TESTES CONCLUÍDOS             ║');
  console.log('╚═══════════════════════════════════════╝');
}

runTests().catch(console.error);
