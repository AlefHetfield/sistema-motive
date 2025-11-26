import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    // Cria um usuário de teste com senha provisória
    const email = 'maria@motive.com';
    const password = 'senha123'; // Senha provisória
    const passwordHash = await bcrypt.hash(password, 10);

    // Verifica se já existe
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      // Atualiza para forçar troca de senha
      await prisma.user.update({
        where: { id: existing.id },
        data: { mustChangePassword: true }
      });
      console.log('✅ Usuário existente atualizado para forçar troca de senha');
    } else {
      // Cria novo
      await prisma.user.create({
        data: {
          nome: 'Maria Silva',
          email,
          passwordHash,
          role: 'CORRETOR',
          isActive: true,
          mustChangePassword: true, // Forçar troca no primeiro login
        }
      });
      console.log('✅ Usuário de teste criado com sucesso!');
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:    ', email);
    console.log('🔑 Senha:    ', password, '(provisória)');
    console.log('⚠️  IMPORTANTE: Sistema vai forçar troca de senha no login!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
