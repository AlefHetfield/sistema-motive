import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const users = await prisma.user.findMany({
  select: {
    id: true,
    nome: true,
    email: true,
    passwordHash: true,
    role: true
  }
});

console.log('Usuários no banco:');
users.forEach(user => {
  console.log('\n---');
  console.log('Email:', user.email);
  console.log('Nome:', user.nome);
  console.log('Hash:', user.passwordHash);
  console.log('Hash length:', user.passwordHash.length);
  console.log('Hash starts with:', user.passwordHash.substring(0, 10));
});

await prisma.$disconnect();
