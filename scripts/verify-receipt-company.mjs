import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lookupReceiptCompany } from '../api/receiptCompany.js';

const cnpj = '12ABC345000195';
const cnpjFormatted = '12.abc.345/0001-95';
const company = { nome: 'Empresa Exemplo', endereco: 'Rua da Sé, 17 - Centro', cidade: 'São Paulo / SP', cep: '01001-001' };

test('consulta aceita CNPJ formatado com letras e devolve apenas os dados do emissor', async () => {
  const received = await lookupReceiptCompany(cnpjFormatted, async url => {
    assert.equal(url, `https://minhareceita.org/${cnpj}`);
    return Response.json({
      cnpj, razao_social: 'Empresa Exemplo', logradouro: 'Rua da Sé', numero: 17,
      bairro: 'Centro', municipio: 'São Paulo', uf: 'SP', cep: 1001001, qsa: [{ nome: 'Não vai para o recibo' }],
    });
  });
  assert.deepEqual(received, company);
});

test('usa a segunda base em caso de erro ou de resposta sobre outro CNPJ', async () => {
  for (const primary of [new Response(null, { status: 429 }), Response.json({ cnpj: '00000000000191', razao_social: 'Outro cadastro' })]) {
    const requests = [];
    const received = await lookupReceiptCompany(cnpj, async url => {
      requests.push(url);
      if (requests.length === 1) return primary;
      return Response.json({
        razao_social: 'Empresa Exemplo',
        estabelecimento: {
          cnpj, logradouro: 'Rua da Sé', numero: '17', bairro: 'Centro', cep: '01001001',
          cidade: { nome: 'São Paulo' }, estado: { sigla: 'SP' },
        },
      });
    });
    assert.equal(requests[1], `https://publica.cnpj.ws/cnpj/${cnpj}`);
    assert.deepEqual(received, company);
  }
});

test('distingue formato inválido, ausência nas duas bases e indisponibilidade', async () => {
  let requested = false;
  await assert.rejects(lookupReceiptCompany('12/3?x', async () => { requested = true; }), { status: 400 });
  assert.equal(requested, false);
  await assert.rejects(lookupReceiptCompany(cnpj, async () => new Response(null, { status: 404 })), { status: 404 });
  await assert.rejects(lookupReceiptCompany(cnpj, async () => { throw new Error('timeout'); }), { status: 503 });
});
