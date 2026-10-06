import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';
import PizZip from 'pizzip';
import { emphasizeContractXml } from '../api/contractEmphasis.js';
import { generateContractDocx, generateContractPreview } from '../api/contractGenerator.js';

const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const parse = xml => new DOMParser().parseFromString(xml, 'application/xml');
const text = xml => [...parse(xml).getElementsByTagNameNS(ns, 't')].map(node => node.textContent).join('');
const boldText = xml => [...parse(xml).getElementsByTagNameNS(ns, 'r')].filter(run => {
  const b = [...run.getElementsByTagNameNS(ns, 'b')][0];
  return b && !['0', 'false', 'off'].includes(b.getAttributeNS(ns, 'val'));
}).map(run => [...run.getElementsByTagNameNS(ns, 't')].map(node => node.textContent).join('')).join('');
const xml = content => `<w:document xmlns:w="${ns}"><w:body><w:p>${content}</w:p></w:body></w:document>`;
const run = value => `<w:r><w:rPr><w:color w:val="000000"/><w:b w:val="0"/></w:rPr><w:t>${value}</w:t></w:r>`;

test('only matching fragments become bold, including names and money split across runs', () => {
  const original = xml(run('JOÃO ') + run('SILVA, inscrito no CPF. Valor R$ 380.') + run('000,00. Prazo 120 dias.'));
  const result = emphasizeContractXml(original, ['JOÃO SILVA', 'R$ 380.000,00']);
  assert.equal(text(result), text(original));
  assert.equal(boldText(result), 'JOÃO SILVAR$ 380.000,00');
  assert.match(result, /w:color w:val="000000"/);
});
test('registry number in legal description is highlighted without bolding surrounding prose', () => {
  const original = xml(run('Apartamento, matrícula nº 12.345, situado na Rua de teste.'));
  const result = emphasizeContractXml(original, []);
  assert.equal(boldText(result), '12.345');
  assert.equal(text(result), text(original));
});
test('escaped text, repeated tokens and existing document decoration survive', () => {
  const original = xml(run('ANA &amp; JOÃO, comprador. ANA &amp; JOÃO assina.'));
  const result = emphasizeContractXml(original, ['ANA & JOÃO']);
  assert.equal(text(result), text(original));
  assert.equal(boldText(result), 'ANA & JOÃOANA & JOÃO');
  assert.equal(emphasizeContractXml(result, ['ANA & JOÃO']), result);
});
test('partial words do not receive unwanted emphasis', () => {
  const original = xml(run('MARIANA, prazo de cento e vinte dias.'));
  assert.equal(emphasizeContractXml(original, ['ANA']), original);
});
test('actual contract highlights participants, registry and monetary amounts, but not deadlines or CPF', () => {
  const person = { nome: 'Pessoa de teste', cpf: '52998224725', rg: '123', estadoCivil: 'solteiro', endereco: 'Rua de teste, 100' };
  const data = {
    vendedores: [person, { ...person, nome: 'Segundo vendedor' }],
    compradores: [{ ...person, nome: 'Primeiro comprador' }, { ...person, nome: 'Segunda compradora', genero: 'F' }],
    imovel: { categoria: 'apartamento', matricula: '12345', cartorio: 'Cartório de teste', endereco: 'Rua de teste' },
    valores: { valorImovel: 380000, sinal: 10000, fgts: 10000, recursosProprios: 60000, financiamento: 300000, reservaDocumentacao: 5000, banco: 'Banco de teste', prazoDias: 120 },
    contrato: { cidade: 'Sumaré', data: '2026-10-06' },
  };
  const documentXml = buffer => new PizZip(buffer).file('word/document.xml').asText();
  const result = documentXml(generateContractDocx(data));
  const bold = boldText(result);
  for (const name of ['PESSOA DE TESTE', 'SEGUNDO VENDEDOR', 'PRIMEIRO COMPRADOR', 'SEGUNDA COMPRADORA']) assert.ok(bold.includes(name), name);
  for (const amount of ['R$ 380.000,00', 'trezentos e oitenta mil reais', 'R$ 300.000,00', '12345']) assert.ok(bold.includes(amount), amount);
  assert.equal(bold.includes(person.cpf), false);
  assert.equal(bold.includes('120'), false);
  assert.equal(bold.includes('cento e vinte'), false);
  assert.equal(result, documentXml(generateContractPreview(data)));
});
