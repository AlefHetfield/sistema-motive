import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost:5173/engineerings', pretendToBeVisual: true });
dom.window.confirm = () => true;
const descriptors = new Map();
const requests = [];
let respond = async () => { throw Error('Falha de rede de teste'); };
const property = { id: 43, code: 'AP0196', title: 'Jardim Recanto dos Sonhos', city: 'Sumaré', price: 222000.90, ownerName: 'Maria de Teste', photoUrl: 'https://example.test/foto-imovel.jpg' };
const globals = {
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true, __engineeringProperty: property,
  fetch: () => { throw Error('Nenhuma requisição externa é permitida neste teste'); },
  __engineeringRequest: async (path, options) => { requests.push({ path, ...options }); return respond(path, options); },
};
for (const [name, value] of Object.entries(globals)) {
  descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}
const frontend = fileURLToPath(new URL('../', import.meta.url));
const bundlePath = fileURLToPath(new URL(`../.verify-engineerings-ui-${randomUUID()}.mjs`, import.meta.url));
let root;
try {
  const output = await build({
    absWorkingDir: frontend, stdin: { contents: 'export { default as EngineeringModal } from "./src/components/engineering/EngineeringModal.jsx"; export { default as EngineeringValidity } from "./src/components/engineering/EngineeringValidity.jsx"; export * from "./src/components/engineering/engineeringForm.js"; export * from "./src/utils/engineeringEntry.js";', resolveDir: frontend },
    bundle: true, write: false, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic',
    plugins: [{ name: 'engineering-fixtures', setup(builder) {
      builder.onResolve({ filter: /^react(?:\/.*)?$/ }, args => ({ path: args.path, external: true }));
      builder.onResolve({ filter: /\/(?:engineeringApi|api|TaskPropertyPicker)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: path.endsWith('/engineeringApi')
        ? 'export const engineeringApi=(...args)=>globalThis.__engineeringRequest(...args);'
        : path.endsWith('/api') ? 'export const propertyDriveImageUrl=id=>`http://localhost:3000/api/properties/drive-image/${id}`;'
          : 'import React from "react";export default function Picker({onSelect}){return React.createElement("button",{type:"button",onClick:()=>onSelect(globalThis.__engineeringProperty)},"Escolher imóvel de teste");}' }));
    } }],
  });
  await writeFile(bundlePath, output.outputFiles[0].text);
  const { EngineeringModal, EngineeringValidity, parseEngineeringMoney, moneyInput, maskEngineeringMoney, engineeringDate, emptyEngineeringForm, calculateEngineeringFinancing, calculateEngineeringEntry, getEngineeringEntry } = await import(pathToFileURL(bundlePath).href);
  for (const [appraisedValue, financed] of [
    ['300000.00', '240000.00'], ['370000.00', '296000.00'], ['100.01', '80.01'],
    ['0.00', '0.00'], ['9999999999999.99', '7999999999999.99'], [null, null], ['', null],
  ]) assert.equal(calculateEngineeringFinancing(appraisedValue), financed, 'Financiamento corresponde a 80% da avaliação, com centavos exatos');
  for (const [propertyValue, appraisedValue, expected] of [
    ['326000.00', '370000.00', '30000.00'],
    ['280000.00', '300000.00', '40000.00'],
    ['222000.90', '260000.95', '14000.14'],
    ['0.01', '0.02', '0.00'],
    ['0.00', '0.00', '0.00'],
    ['100000.00', '200000.00', '0.00'],
    ['338000.00', '550000.00', '0.00'],
    ['9999999999999.99', '9999999999999.99', '2000000000000.00'],
    [null, '370000.00', null], ['326000.00', null, null], ['', '370000.00', null],
  ]) assert.equal(calculateEngineeringEntry(propertyValue, appraisedValue), expected, 'Entrada respeita a fórmula e preserva centavos sem arredondamento binário');
  assert.equal(getEngineeringEntry({ valorImovel: '326000.00', valorAvaliado: '370000.00', valorEntradaManual: null }), '30000.00');
  assert.equal(getEngineeringEntry({ valorImovel: '326000.00', valorAvaliado: '370000.00', valorEntradaManual: '25000.90' }), '25000.90');
  assert.equal(getEngineeringEntry({ valorImovel: '326000.00', valorAvaliado: '370000.00', valorEntradaManual: '0.00' }), '0.00', 'Entrada manual zero não volta ao cálculo automático');
  for (const [today, label, tone] of [
    ['2026-05-30', 'Faltam 31 dias', 'emerald'],
    ['2026-05-31', 'Faltam 30 dias', 'amber'],
    ['2026-06-30', 'Vence hoje', 'amber'],
    ['2026-07-01', 'Vencida há 1 dia', 'red'],
  ]) {
    const markup = renderToStaticMarkup(React.createElement(EngineeringValidity, { date: '2026-01-01', today }));
    assert.ok(markup.includes(label), `Aviso apresenta o prazo em dias: ${label}`);
    assert.ok(markup.includes(`bg-${tone}-50`), 'Cor do aviso acompanha o prazo');
    assert.ok(markup.includes('30/06/2026'), 'Listagem mostra a data de vencimento');
  }
  const missingExpiry = renderToStaticMarkup(React.createElement(EngineeringValidity, { date: null, today: '2026-06-30' }));
  assert.ok(missingExpiry.includes('Vencimento não definido'));
  assert.ok(!missingExpiry.includes('<time'), 'Sem pedido não inventa uma data de vencimento');
  for (const [input, expected] of [['250.000,90', '250000.90'], ['250000,9', '250000.90'], ['R$ 250.000,90', '250000.90'], ['0', '0.00'], ['0,00', '0.00'], ['', null], ['  ', null], ['9.999.999.999.999,99', '9999999999999.99']]) assert.equal(parseEngineeringMoney(input), expected);
  for (const input of ['-1', '250000.90', '1,234', '1.00,00', 'abc', 'Infinity', '1e3', '10.000.000.000.000,00']) assert.throws(() => parseEngineeringMoney(input), undefined, `Valor inválido: ${input}`);
  assert.equal(moneyInput('222000.90'), '222.000,90');
  assert.equal(moneyInput(0), '0,00');
  assert.equal(engineeringDate('2026-10-28T00:00:00.000Z'), '28/10/2026');
  assert.equal(emptyEngineeringForm({ dataPedido: '2026-10-28T00:00:00.000Z', valorAvaliado: '0.00' }).dataPedido, '2026-10-28');
  for (const [value, expected] of [['', ''], ['1', '0,01'], ['12', '0,12'], ['123456', '1.234,56'], ['22200000', '222.000,00'], ['R$ 250.000,90', '250.000,90'], ['0', '0,00'], ['999999999999999', '9.999.999.999.999,99']]) {
    assert.equal(maskEngineeringMoney(value), expected, `Máscara de moeda: ${value}`);
  }
  assert.equal(maskEngineeringMoney('1000000000000000'), null, 'Exceder o limite não trunca o valor silenciosamente');
  assert.equal(maskEngineeringMoney('000000000000000123456'), '1.234,56', 'Zeros iniciais não consomem o limite de dígitos significativos');

  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root'));
  let sequence = 0, closes = 0, saved = null;
  const mount = async item => act(async () => root.render(React.createElement(EngineeringModal, { key: ++sequence, item, onClose: () => { closes++; }, onSaved: value => { saved = value; } })));
  const input = name => document.querySelector(`[id$="-${name}"]`);
  const button = text => [...document.querySelectorAll('button')].find(element => element.textContent.trim() === text);
  const fill = async (name, value, cursor) => {
    const element = input(name);
    assert.ok(element, `Campo ${name} presente`);
    await act(async () => {
      const prototype = element.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
      if (cursor !== undefined) element.setSelectionRange(cursor, cursor);
      element.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      element.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
  };
  const click = async element => { assert.ok(element); await act(async () => element.click()); };
  const submit = async () => act(async () => document.querySelector('form').requestSubmit());
  await mount();
  assert.equal(input('valorEntrada').readOnly, true, 'Entrada começa no cálculo automático');
  assert.equal(input('valorEntrada').value, '', 'Sem valores não inventa entrada');
  assert.equal(input('valorFinanciado').readOnly, true, 'Financiamento calculado não pode ser editado manualmente');
  assert.equal(input('valorFinanciado').value, '', 'Sem avaliação não inventa financiamento');
  await fill('valorAvaliado', '30000000');
  assert.equal(input('valorFinanciado').value, '240.000,00', 'Avaliação basta para mostrar os 80% financiados');
  assert.equal(input('valorEntrada').value, '', 'Sem o valor final do imóvel ainda não calcula a entrada');
  await fill('valorImovel', '28000000');
  assert.equal(input('valorEntrada').value, '40.000,00', 'Entrada completa a diferença entre valor final e financiamento');
  await fill('valorImovel', '29000000');
  assert.equal(input('valorFinanciado').value, '240.000,00', 'Alterar o valor final não muda o financiamento da avaliação');
  assert.equal(input('valorEntrada').value, '50.000,00');
  await fill('valorAvaliado', '37000000');
  assert.equal(input('valorFinanciado').value, '296.000,00', 'Alterar a avaliação recalcula o financiamento');
  assert.equal(input('valorEntrada').value, '0,00', 'Entrada nunca é negativa');
  await fill('valorImovel', '32600000');
  assert.equal(input('valorEntrada').value, '30.000,00');
  await fill('valorImovel', '');
  assert.equal(input('valorFinanciado').value, '296.000,00');
  assert.equal(input('valorEntrada').value, '');
  await fill('valorAvaliado', '');
  assert.equal(input('valorFinanciado').value, '', 'Limpar a avaliação remove o financiamento calculado');
  assert.equal(input('vencimento').readOnly, true, 'Vencimento é calculado, sem edição manual');
  assert.equal(input('vencimento').value, '');
  assert.equal(input('vencimento').placeholder, 'Vencimento não definido');
  for (const [requested, expires] of [
    ['2026-10-28', '26/04/2027'],
    ['2023-09-02', '29/02/2024'],
    ['2024-09-02', '01/03/2025'],
    ['2024-02-29', '27/08/2024'],
  ]) {
    await fill('dataPedido', requested);
    assert.equal(input('vencimento').value, expires, 'Alterar o pedido recalcula 180 dias corridos, incluindo virada de ano e ano bissexto');
  }
  await fill('dataPedido', '');
  assert.equal(input('vencimento').value, '', 'Limpar o pedido remove o vencimento calculado');
  assert.equal(input('vencimento').placeholder, 'Vencimento não definido');
  assert.equal(requests.length, 0, 'Calcular o vencimento não grava dados');
  await click(button('Escolher imóvel de teste'));
  assert.equal(input('imovel').value, '', 'Vincular imóvel não preenche o nome de um cadastro novo');
  assert.equal(input('imovel').validity.valueMissing, true, 'Nome manual continua obrigatório mesmo com imóvel vinculado');
  await submit();
  assert.equal(requests.length, 0, 'Vínculo não substitui a exigência de informar o nome manualmente');
  await click(button('Remover vínculo'));
  assert.equal(input('imovel').value, '', 'Remover vínculo também mantém o nome vazio');
  await fill('valorImovel', '');
  for (const name of ['valorImovel', 'valorAvaliado']) {
    const expected = ['0,01', '0,12', '1,23', '12,34', '123,45', '1.234,56'];
    for (const [index, digit] of [...'123456'].entries()) {
      await fill(name, input(name).value + digit);
      assert.equal(input(name).value, expected[index], `${name} formata durante a digitação`);
    }
    await fill(name, input(name).value.slice(0, -1));
    assert.equal(input(name).value, '123,45', `${name} recalcula centavos após Backspace`);
    await fill(name, '123456');
    input(name).setSelectionRange(2, 2);
    await act(async () => input(name).dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true })));
    assert.equal(input(name).value, '234,56', `${name} permite apagar junto ao separador de milhar`);
    await fill(name, '123456');
    input(name).setSelectionRange(1, 1);
    await act(async () => input(name).dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true })));
    assert.equal(input(name).value, '134,56', `${name} permite Delete junto ao separador de milhar`);
    await fill(name, '1.9234,56', 3);
    assert.equal(input(name).value, '19.234,56', `${name} aceita inserir dígito no meio do valor`);
    assert.equal(input(name).value.slice(input(name).selectionStart).replace(/\D/g, ''), '23456', `${name} mantém o cursor na posição lógica de edição`);
    await fill(name, '999999999999999');
    await fill(name, input(name).value + '9');
    assert.equal(input(name).value, '9.999.999.999.999,99', `${name} rejeita excesso de dígitos mantendo o valor anterior`);
    await fill(name, '');
    assert.equal(input(name).value, '', `${name} pode ficar vazio após apagar tudo`);
    await fill(name, 'R$ 250.000,90');
    assert.equal(input(name).value, '250.000,90', `${name} aceita colar valor em reais`);
    await fill(name, '0');
    assert.equal(input(name).value, '0,00', `${name} preserva zero explícito`);
    await fill(name, '');
  }
  await fill('imovel', 'Imóvel exclusivo manual');
  await fill('matricula', '123.456');
  await fill('cidade', 'Hortolândia');
  await fill('dataPedido', '2026-10-28');
  assert.equal(input('vencimento').value, '26/04/2027');
  await fill('valorImovel', '25000010');
  await fill('valorAvaliado', '26000095');
  assert.equal(input('valorEntrada').value, '41.999,34', 'Entrada acompanha os valores informados em tempo real');
  await fill('descricao', 'Documentação conferida');
  await click(button('Escolher imóvel de teste'));
  assert.equal(input('imovel').value, 'Imóvel exclusivo manual', 'Vincular preserva o nome preenchido manualmente');
  assert.equal(input('cidade').value, property.city);
  assert.equal(input('valorImovel').value, '222.000,90');
  assert.equal(input('valorEntrada').value, '14.000,14', 'Vincular imóvel recalcula a entrada automática');
  assert.equal(input('valorFinanciado').value, '208.000,76', 'Vincular altera o preço, mas financiamento continua baseado na avaliação');
  assert.match(document.body.textContent, /Proprietário: Maria de Teste/, 'Resumo vinculado identifica o proprietário');
  const cover = document.querySelector('img[alt="Foto do imóvel AP0196"]');
  assert.ok(cover, 'Imóvel vinculado apresenta miniatura com descrição acessível');
  assert.equal(cover.getAttribute('src'), property.photoUrl);
  await act(async () => cover.dispatchEvent(new dom.window.Event('error')));
  assert.ok(document.querySelector('[aria-label="Imóvel sem foto"]'), 'Foto indisponível recebe apresentação alternativa');
  globalThis.__engineeringProperty = { ...property, photoUrl: null, driveCoverFileId: 'drive-test-cover' };
  await click(button('Escolher imóvel de teste'));
  assert.equal(input('imovel').value, 'Imóvel exclusivo manual', 'Trocar o imóvel vinculado preserva o nome manual');
  assert.match(document.querySelector('img[alt="Foto do imóvel AP0196"]').getAttribute('src'), /\/api\/properties\/drive-image\/drive-test-cover$/, 'Miniatura do Drive usa a rota autenticada de imagens');
  globalThis.__engineeringProperty = property;
  for (const [name, value] of [['matricula', '123.456'], ['dataPedido', '2026-10-28'], ['valorAvaliado', '260.000,95'], ['descricao', 'Documentação conferida']]) assert.equal(input(name).value, value, `Vincular preserva ${name}`);
  await click(button('Remover vínculo'));
  assert.equal(input('imovel').value, 'Imóvel exclusivo manual', 'Remover vínculo preserva o texto cadastrado');
  await submit();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'POST');
  assert.deepEqual(requests[0].body, { imovel: 'Imóvel exclusivo manual', matricula: '123.456', cidade: property.city, dataPedido: '2026-10-28', valorImovel: '222000.90', valorAvaliado: '260000.95', valorEntradaManual: null, descricao: 'Documentação conferida', propertyId: null });
  assert.equal('valorEntrada' in requests[0].body, false, 'Cálculo automático não vira uma segunda fonte de verdade persistida');
  assert.equal('valorFinanciado' in requests[0].body, false, 'Financiamento é derivado da avaliação, sem duplicação no payload');
  assert.equal('vencimento' in requests[0].body, false, 'O vencimento derivado não é gravado como segunda fonte de data');
  assert.match(document.querySelector('[role="alert"]').textContent, /Falha de rede/);
  assert.equal(input('descricao').value, 'Documentação conferida', 'Falha de save mantém o rascunho');
  assert.equal(input('valorAvaliado').value, '260.000,95');
  assert.equal(saved, null);

  let resolveSave;
  respond = () => new Promise(resolve => { resolveSave = resolve; });
  await act(async () => {
    const form = document.querySelector('form');
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  });
  assert.equal(requests.length, 2, 'Cliques repetidos não duplicam o cadastro durante o envio');
  assert.equal(document.querySelector('fieldset').disabled, true);
  await act(async () => resolveSave({ id: 7, ...requests[1].body }));
  assert.equal(saved.id, 7);

  await mount({ id: 8, imovel: 'Exclusivo avaliado', valorAvaliado: '0.00', dataPedido: '2026-10-28T00:00:00.000Z' });
  assert.equal(input('valorAvaliado').value, '0,00');
  assert.equal(input('vencimento').value, '26/04/2027', 'Editar um cadastro calcula vencimento a partir da data já salva');
  respond = async (_path, options) => ({ id: 8, ...options.body });
  await submit();
  assert.equal(requests.at(-1).path, '/8');
  assert.equal(requests.at(-1).method, 'PATCH');
  assert.equal(requests.at(-1).body.valorAvaliado, '0.00');
  assert.equal(requests.at(-1).body.valorImovel, null);
  assert.equal(requests.at(-1).body.valorEntradaManual, null);

  await mount({ id: 9, imovel: 'Entrada automática', valorImovel: '326000.00', valorAvaliado: '370000.00', valorEntradaManual: null });
  assert.equal(input('valorEntrada').value, '30.000,00');
  assert.equal(input('valorFinanciado').value, '296.000,00');
  await click(button('Preencher manualmente'));
  assert.equal(input('valorEntrada').readOnly, false);
  await fill('valorEntrada', '2500090');
  assert.equal(input('valorEntrada').value, '25.000,90', 'Entrada manual usa a mesma máscara de reais');
  await fill('valorImovel', '33000000');
  await fill('valorAvaliado', '38000000');
  assert.equal(input('valorFinanciado').value, '304.000,00', 'Financiamento continua automático quando entrada é manual');
  assert.equal(input('valorEntrada').value, '25.000,90', 'Alterar valores do imóvel não sobrescreve a entrada manual');
  await click(button('Escolher imóvel de teste'));
  assert.equal(input('valorEntrada').value, '25.000,90', 'Trocar o vínculo preserva a entrada manual');
  assert.equal(input('imovel').value, 'Entrada automática', 'Vincular durante edição mantém o nome já cadastrado');
  await submit();
  assert.equal(requests.at(-1).method, 'PATCH');
  assert.equal(requests.at(-1).body.valorEntradaManual, '25000.90');
  await fill('valorEntrada', '');
  const beforeBlankManual = requests.length;
  await submit();
  assert.equal(requests.length, beforeBlankManual, 'Entrada manual vazia exige valor ou retorno ao automático');
  assert.ok(document.querySelector('[role="alert"]'), 'Erro de entrada manual fica visível');
  await fill('valorEntrada', '0');
  await submit();
  assert.equal(requests.at(-1).body.valorEntradaManual, '0.00', 'Zero manual é preservado no payload');
  await click(button('Usar cálculo automático'));
  assert.equal(input('valorEntrada').readOnly, true);
  assert.equal(input('valorEntrada').value, '0,00', 'Retornar ao automático limita a entrada a zero quando a avaliação cobre o valor do imóvel');
  await submit();
  assert.equal(requests.at(-1).body.valorEntradaManual, null, 'Voltar ao automático remove a sobreposição manual');
  await fill('valorAvaliado', '');
  assert.equal(input('valorEntrada').value, '', 'Remover um valor-base remove a entrada automática');

  await mount({ id: 10, imovel: 'Entrada manual existente', valorImovel: '326000.00', valorAvaliado: '370000.00', valorEntradaManual: '12345.67' });
  assert.equal(input('valorEntrada').readOnly, false);
  assert.equal(input('valorEntrada').value, '12.345,67');
  await fill('valorAvaliado', '39000000');
  await submit();
  assert.equal(requests.at(-1).path, '/10');
  assert.equal(requests.at(-1).body.valorEntradaManual, '12345.67', 'Editar cadastro mantém sobreposição manual existente');

  await mount();
  await fill('imovel', 'Nova entrada manual');
  await click(button('Preencher manualmente'));
  await fill('valorEntrada', '1250000');
  await submit();
  assert.equal(requests.at(-1).method, 'POST');
  assert.equal(requests.at(-1).body.valorEntradaManual, '12500.00', 'Cadastro novo aceita entrada manual independente de avaliação');

  await mount();
  await fill('imovel', 'Rascunho para cancelar');
  const beforeCancel = requests.length;
  await click(button('Cancelar'));
  assert.equal(closes, 1);
  assert.equal(requests.length, beforeCancel, 'Cancelar não grava dados');
  console.log('Engenharias UI validada: entrada automática não negativa com centavos exatos e opção manual; nome preenchido somente manualmente e preservado ao vincular/trocar/remover imóvel; payloads, vencimento, máscara e submissão única.');
} finally {
  if (root) await act(async () => root.unmount());
  await unlink(bundlePath).catch(() => {});
  dom.window.close();
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}
