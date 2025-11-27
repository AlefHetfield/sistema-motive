import bcrypt from 'bcryptjs';

const testPassword = '123456';
console.log('Senha de teste:', testPassword);

// Gera hash
const hash = await bcrypt.hash(testPassword, 10);
console.log('Hash gerado:', hash);

// Testa comparação
const match = await bcrypt.compare(testPassword, hash);
console.log('Comparação:', match);

// Testa com senha errada
const wrongMatch = await bcrypt.compare('senha_errada', hash);
console.log('Senha errada:', wrongMatch);
