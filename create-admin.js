import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    // Email e senha do admin inicial
    const adminEmail = 'admin@motive.com';
    const adminPassword = 'admin123'; // MUDAR na primeira vez!
    const adminName = 'Administrador';

    // Verifica se já existe
    const existing = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (existing) {
      console.log('✅ Usuário administrador já existe:', adminEmail);
      return;
    }

    // Cria hash da senha
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    // Cria o usuário
    const admin = await prisma.user.create({
      data: {
        nome: adminName,
        email: adminEmail,
        passwordHash,
        role: 'ADM',
        isActive: true,
        mustChangePassword: true, // Força troca na primeira vez
      }
    });

    console.log('✅ Usuário administrador criado com sucesso!');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:    ', adminEmail);
    console.log('🔑 Senha:    ', adminPassword);
    console.log('⚠️  IMPORTANTE: Troque a senha após o primeiro login!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

  } catch (error) {
    console.error('❌ Erro ao criar usuário administrador:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();
