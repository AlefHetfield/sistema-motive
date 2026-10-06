import test from 'node:test';
import assert from 'node:assert/strict';
import { contractPropertyLabel, validCpf, validateContractStep, previewSectionPatterns, normalizePdfText, isContractDraft } from '../frontend/src/utils/contractForm.js';
import { generateContractPreviewPdf } from '../api/contractPreview.js';
import { normalizeAndValidateContractData } from '../api/contractGenerator.js';

const fixture = () => ({
  vendedores: [{ nome: 'Vendedor de teste', cpf: '52998224725', rg: '123', orgaoEmissor: 'SSP', ufRg: 'SP', genero: 'M', estadoCivil: 'Solteiro', endereco: 'Rua de teste, 100' }],
  compradores: [{ nome: 'Comprador de teste', cpf: '52998224725', rg: '456', orgaoEmissor: 'SSP', ufRg: 'SP', genero: 'M', estadoCivil: 'Solteiro', endereco: 'Rua de teste, 200' }],
  imovel: { categoria: 'apartamento', matricula: '12345', cartorio: 'Cartório de teste', endereco: 'Rua de teste, 300', descricao: '' },
  valores: { valorImovel: 380000, sinal: 10000, fgts: 10000, recursosProprios: 60000, financiamento: 300000, reservaDocumentacao: 5000, banco: 'Banco de teste', prazoDias: 120 },
  contrato: { cidade: 'Sumaré', data: '2026-10-06' },
});
test('valid contract passes every step and server validation', () => {
  const data = fixture();
  for (let step = 0; step <= 5; step++) assert.deepEqual(validateContractStep(data, step, 'client', 1), {});
  assert.doesNotThrow(() => normalizeAndValidateContractData(data));
});
test('client origin required only in client mode', () => {
  assert.ok(validateContractStep(fixture(), 0, 'client', null).client);
  assert.deepEqual(validateContractStep(fixture(), 0, 'standalone', null), {});
});
test('party validation identifies exact field and second person', () => {
  const data = fixture();
  data.vendedores.push({ ...data.vendedores[0], nome: '', cpf: '111.111.111-11' });
  const errors = validateContractStep(data, 1);
  assert.ok(errors['vendedores.1.nome']);
  assert.ok(errors['vendedores.1.cpf']);
  assert.ok(validCpf('529.982.247-25'));
  assert.equal(validCpf('123'), false);
});
test('legal description replaces structured fields, not payment validation', () => {
  const data = fixture();
  data.imovel = { descricao: 'Descrição jurídica de teste' };
  assert.deepEqual(validateContractStep(data, 3), {});
  data.imovel.descricao = '';
  assert.equal(Object.keys(validateContractStep(data, 3)).length, 4);
});
test('payment composition excludes documentation reserve and catches mismatch', () => {
  const data = fixture();
  assert.deepEqual(validateContractStep(data, 4), {});
  data.valores.sinal += 100;
  assert.ok(validateContractStep(data, 4).composition);
  data.valores.prazoDias = 0;
  assert.ok(validateContractStep(data, 4)['valores.prazoDias']);
  data.valores.fgts = -1;
  assert.ok(validateContractStep(data, 4)['valores.fgts']);
});
test('invalid calendar dates are rejected', () => {
  const data = fixture();
  data.contrato.data = '2026-02-30';
  assert.ok(validateContractStep(data, 5)['contrato.data']);
});
test('property label uses condominium for apartments and omits missing owners', () => {
  const apartment = { code: 'AP123', propertyType: 'Apartamento', title: '249 - PORTO BELO - 2 DORM', neighborhood: 'Matão', ownerName: 'Pessoa de teste', price: 380000 };
  assert.match(contractPropertyLabel(apartment), /^AP123 - PORTO BELO - Pessoa de teste - R\$/);
  assert.match(contractPropertyLabel({ ...apartment, propertyType: 'Casa', ownerName: '' }), /^AP123 - Matão - R\$/);
  assert.doesNotMatch(contractPropertyLabel({ ...apartment, ownerName: '' }), /não informado/);
});
test('map selection metadata survives contract normalization', () => {
  const data = fixture();
  data.imovel.propertyId = 123;
  assert.equal(normalizeAndValidateContractData(data).imovel.propertyId, 123);
});
test('draft round trip preserves fields and rejects incompatible or damaged storage', () => {
  const draft = { version: 1, data: fixture(), currentStep: 4, furthestStep: 5, clientId: 123, propertyId: '456' };
  assert.ok(isContractDraft(JSON.parse(JSON.stringify(draft))));
  assert.equal(isContractDraft({ ...draft, version: 2 }), false);
  assert.equal(isContractDraft({ ...draft, data: { ...draft.data, vendedores: [] } }), false);
  assert.equal(isContractDraft({ ...draft, data: { ...draft.data, imovel: {} } }), false);
  assert.equal(isContractDraft(null), false);
});
test('actual PDF headings support automatic section navigation', { skip: process.env.CONTRACT_PDF_TEST !== '1' }, async () => {
  const bytes = await generateContractPreviewPdf(fixture());
  const { getDocument } = await import('../frontend/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) pages.push(normalizePdfText((await (await pdf.getPage(n)).getTextContent()).items));
  for (const [step, pattern] of Object.entries(previewSectionPatterns)) {
    const page = pages.findIndex(text => pattern.test(text));
    assert.ok(page >= 0, `Missing heading for step ${step}`);
    console.log(`Step ${step}: page ${page + 1}`);
  }
  await pdf.destroy();
});
