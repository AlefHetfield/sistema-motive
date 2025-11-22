// seed-clients.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const nomes = ["Carlos", "Ana", "Marcos", "Fernanda", "João", "Beatriz", "Rafael", "Juliana", "Pedro", "Larissa"];
const sobrenomes = ["Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Almeida", "Pereira", "Lima", "Gomes"];
const imoveis = ["Apartamento Centro", "Casa Condomínio", "Terreno Jd. Ipê", "Cobertura", "Studio"];
const corretores = ["Corretor A", "Corretor B", "Corretor C"];
const statusList = ["Aprovado", "Engenharia", "Finalização", "Conformidade", "Assinado"];

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function gerarCPF() {
    // Gera um CPF aleatório simples (não validável, apenas para visualização)
    return Math.floor(Math.random() * 10000000000).toString().padStart(11, '0');
}

async function main() {
    console.log("🌱 Conectando ao banco e gerando dados...");
    
    const clients = [];
    for (let i = 0; i < 30; i++) {
        const nomeCompleto = `${getRandom(nomes)} ${getRandom(sobrenomes)}`;
        clients.push({
            nome: nomeCompleto,
            cpf: gerarCPF(),
            imovel: getRandom(imoveis),
            corretor: getRandom(corretores),
            status: getRandom(statusList),
            responsavel: "Sistema Mock",
            modalidade: "Financiamento",
            agencia: "1234",
            observacoes: "Cliente gerado automaticamente para testes.",
        });
    }

    await prisma.client.createMany({ data: clients });
    console.log("✅ 30 clientes inseridos com sucesso!");
}

main()
  .catch((e) => {
      console.error("❌ Erro ao rodar seed:", e);
      process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());