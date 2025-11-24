// clear-mock-data.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("🗑️  Limpando dados mockados do banco...");
    
    // Remove todos os clientes com responsavel = "Sistema Mock"
    const result = await prisma.client.deleteMany({
        where: {
            responsavel: "Sistema Mock"
        }
    });

    console.log(`✅ ${result.count} clientes mockados foram removidos!`);
    console.log("📊 Banco de dados restaurado para o estado original.");
}

main()
  .catch((e) => {
      console.error("❌ Erro ao limpar dados:", e);
      process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
