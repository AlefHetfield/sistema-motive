import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkClients() {
  try {
    const count = await prisma.client.count();
    console.log('📊 Total de clientes no banco:', count);
    
    if (count > 0) {
      const clients = await prisma.client.findMany({ take: 5 });
      console.log('\n📋 Primeiros clientes:');
      clients.forEach(c => {
        console.log(`  - ID: ${c.id}, Nome: ${c.nome}, Status: ${c.status}`);
      });
    } else {
      console.log('\n⚠️  O banco está vazio! Você pode:');
      console.log('   1. Criar clientes pelo sistema');
      console.log('   2. Usar o seed: node seed-clients.js');
    }
  } catch (error) {
    console.error('❌ Erro ao verificar clientes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkClients();
