import bcrypt from 'bcryptjs';

const testeHash = '$2b$10$4btcFnXFDga1mCYnmXljHeawNclwmUjp5VtmtZFaqMSAR7H0kd5Uu';

console.log('Testando diferentes senhas para teste@motive.com:');

const senhas = ['123456', 'teste123', 'senha123', 'teste', '123', 'Teste123'];

for (const senha of senhas) {
  const match = await bcrypt.compare(senha, testeHash);
  console.log(`Senha "${senha}":`, match ? '✓ CORRETA' : '✗ incorreta');
}
