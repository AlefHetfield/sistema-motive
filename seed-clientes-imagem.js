import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const clientsData = [
  {
    nome: 'Thais',
    cpf: '419.290.728-30',
    imovel: 'Casa Estancia',
    corretor: 'Marcela',
    responsavel: 'Alef',
    agencia: '4088',
    modalidade: 'SBPE',
    status: 'Arquivado',
    dataAssinaturaContrato: new Date('2019-03-19'),
    observacoes: '',
  },
  {
    nome: 'Felipe Fernandes',
    cpf: '488.508.558-69',
    imovel: 'Apê Porto Belo',
    corretor: 'Alef',
    responsavel: '',
    agencia: '4088',
    modalidade: 'FAIXA 2',
    status: 'Assinado-Movido',
    dataAssinaturaContrato: new Date('2025-10-28'),
    observacoes: '',
  },
  {
    nome: 'Joao',
    cpf: '00000000000',
    imovel: 'casa',
    corretor: 'Joao',
    responsavel: 'Joao',
    agencia: '4088',
    modalidade: 'FGTS',
    status: 'Arquivado',
    dataAssinaturaContrato: new Date('2025-11-23'),
    observacoes: '',
  },
  {
    nome: 'Alef',
    cpf: '00000000000',
    imovel: 'Casa',
    corretor: 'Alef',
    responsavel: 'Alef',
    agencia: '4088',
    modalidade: 'FGTS',
    status: 'Arquivado',
    dataAssinaturaContrato: new Date('2025-11-23'),
    observacoes: '',
  },
  {
    nome: 'Pabllo e Giovanna',
    cpf: '350.398.828-30',
    imovel: 'Casa Danilo Bella',
    corretor: 'Andreia',
    responsavel: 'Adriano',
    agencia: '4088',
    modalidade: 'MCMV 4',
    status: 'Aprovado',
    dataAssinaturaContrato: null,
    observacoes: '',
  },
  {
    nome: 'Bianca e Thiago',
    cpf: '554.299.708-24',
    imovel: 'Casa Marcos Ipês',
    corretor: 'Adriano',
    responsavel: '',
    agencia: '4088',
    modalidade: 'MCMV 4',
    status: 'Engenharia',
    dataAssinaturaContrato: null,
    observacoes: 'Ag. Habite-se',
  },
  {
    nome: 'Maria',
    cpf: '',
    imovel: 'Apê Hortolandia',
    corretor: 'Zé Mario',
    responsavel: 'Alef',
    agencia: '4088',
    modalidade: 'FAIXA 2',
    status: 'Finalização',
    dataAssinaturaContrato: null,
    observacoes: '',
  },
];

async function seedClients() {
  try {
    console.log('🌱 Iniciando seed de clientes...\n');

    // Limpa clientes existentes
    await prisma.client.deleteMany();
    console.log('✅ Clientes antigos removidos\n');

    // Cria os novos clientes
    let count = 0;
    for (const clientData of clientsData) {
      const client = await prisma.client.create({
        data: clientData,
      });
      count++;
      console.log(`✅ Cliente criado: ${client.nome} (ID: ${client.id})`);
    }

    console.log(`\n🎉 Seed concluído! ${count} clientes criados com sucesso.\n`);
  } catch (error) {
    console.error('❌ Erro ao criar clientes:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedClients();
