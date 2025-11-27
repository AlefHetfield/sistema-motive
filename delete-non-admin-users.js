import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteNonAdminUsers() {
  try {
    // Deleta todos os usuários exceto admin@motive.com
    const result = await prisma.user.deleteMany({
      where: {
        email: {
          not: 'admin@motive.com'
        }
      }
    });

    console.log(`✓ ${result.count} usuário(s) deletado(s)`);

    // Lista os usuários restantes
    const remainingUsers = await prisma.user.findMany({
      select: {
        id: true,
        nome: true,
        email: true,
        role: true
      }
    });

    console.log('\nUsuários restantes:');
    remainingUsers.forEach(user => {
      console.log(`- ${user.nome} (${user.email}) - ${user.role}`);
    });

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteNonAdminUsers();
