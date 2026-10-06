import test from 'node:test';
import assert from 'node:assert/strict';
import PizZip from 'pizzip';
import { generateContractDocx, generateContractPreview } from '../api/contractGenerator.js';
import { generateContractPreviewPdf } from '../api/contractPreview.js';

const xml = buffer => new PizZip(buffer).file('word/document.xml').asText();
const person = { nome: 'Pessoa de teste', cpf: '52998224725', rg: '123', estadoCivil: 'Solteiro', endereco: 'Endereço de teste' };
const complete = {
  vendedores: [person], compradores: [person],
  imovel: { descricao: 'Imóvel de teste' },
  valores: { valorImovel: 380000, sinal: 0, fgts: 0, recursosProprios: 80000, financiamento: 300000, reservaDocumentacao: 0, banco: 'Banco de teste', prazoDias: 120 },
  contrato: { cidade: 'Sumaré', data: '2026-10-01' },
};

test('empty draft renders placeholders without changing the payload', () => {
  const input = {};
  const result = xml(generateContractPreview(input));
  assert.match(result, /\[nome\]/i);
  assert.match(result, /\[data do contrato\]/);
  assert.doesNotMatch(result, /\{[A-Z0-9_]+\}/);
  assert.deepEqual(input, {});
});

test('complete preview uses identical document contents to final generation', () => {
  assert.equal(xml(generateContractPreview(complete)), xml(generateContractDocx(complete)));
});

test('final generation still rejects incomplete and invalid drafts', () => {
  assert.throws(() => generateContractDocx({}));
  const invalid = { ...complete, compradores: [{ ...person, cpf: '123' }] };
  assert.doesNotThrow(() => generateContractPreview(invalid));
  assert.throws(() => generateContractDocx(invalid), /CPF inválido/);
});

test('edited text is escaped by the Word renderer', () => {
  const result = xml(generateContractPreview({ ...complete, imovel: { descricao: '<script>teste</script> & texto' } }));
  assert.match(result, /&lt;script&gt;/);
  assert.doesNotMatch(result, /<script>/);
});

test('missing converter returns a safe, actionable error', async () => {
  const previous = process.env.LIBREOFFICE_PATH;
  process.env.LIBREOFFICE_PATH = '/nonexistent-motive-converter';
  try {
    await assert.rejects(generateContractPreviewPdf({}), error => error.status === 503 && /conversor PDF/.test(error.message));
  } finally {
    if (previous === undefined) delete process.env.LIBREOFFICE_PATH;
    else process.env.LIBREOFFICE_PATH = previous;
  }
});

test('real PDF conversion and concurrent request limit', { skip: process.env.CONTRACT_PDF_TEST !== '1' }, async () => {
  const conversion = generateContractPreviewPdf(complete);
  await assert.rejects(generateContractPreviewPdf({}), error => error.status === 429);
  const pdf = await conversion;
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length > 10000);
});
