import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { formatClientCommission, getClientCommissionBreakdown, isVaniaBroker, summarizeClientCommissions } from '../src/utils/clientCommission.js';

assert.equal(formatClientCommission(null), 'A informar');
assert.equal(formatClientCommission(undefined), 'A informar');
assert.match(formatClientCommission('0.00'), /0,00/);
assert.match(formatClientCommission('1234.50'), /1\.234,50/);
assert.match(formatClientCommission('-1.00'), /1,00/);
assert.ok(/[-−]/.test(formatClientCommission('-1.00')), 'Prévia identifica valores negativos');
for (const name of ['Vânia', 'Vania', ' VÂNIA ', 'vAnIa']) assert.equal(isVaniaBroker(name), true);
for (const name of ['Vânia Silva', 'Silvania', 'Outro corretor', '', null]) assert.equal(isVaniaBroker(name), false);
const discountedClient = {
  venda: true, comissaoEstimada: '8500.00', corretor: ' VÂNIA ', visitaDiego: true,
  descontosComissao: [{ descricao: 'Ajuste comercial', valor: '250.00' }],
};
const originalClient = structuredClone(discountedClient);
const breakdown = getClientCommissionBreakdown(discountedClient);
assert.equal(breakdown.gross, '8500.00');
assert.equal(breakdown.discountTotal, '1750.00');
assert.equal(breakdown.net, '6750.00');
assert.equal(breakdown.requiresReview, false);
assert.equal(breakdown.discounts.length, 3);
assert.deepEqual(getClientCommissionBreakdown(discountedClient), breakdown, 'Recalcular não aplica os descontos duas vezes');
assert.deepEqual(discountedClient, originalClient, 'Cálculo preserva a comissão bruta e os descontos cadastrados');
assert.equal(getClientCommissionBreakdown({ ...discountedClient, descontosComissao: [] }).net, '7000.00');
assert.equal(getClientCommissionBreakdown({ ...discountedClient, corretor: 'Outro corretor', descontosComissao: [] }).net, '7500.00');
assert.equal(getClientCommissionBreakdown({ ...discountedClient, visitaDiego: false, descontosComissao: [] }).net, '8000.00');
const reservedBreakdown = getClientCommissionBreakdown({ ...discountedClient, reservaAnuncios: true });
assert.equal(reservedBreakdown.discountTotal, '2250.00');
assert.equal(reservedBreakdown.net, '6250.00');
assert.ok(reservedBreakdown.discounts.some(discount => discount.descricao === 'Reserva Anúncios' && discount.valor === '500.00'));
assert.equal(getClientCommissionBreakdown({ ...discountedClient, reservaAnuncios: false }).net, '6750.00');
const excessiveDiscounts = getClientCommissionBreakdown({ ...discountedClient, comissaoEstimada: '1500.00' });
assert.equal(excessiveDiscounts.net, '-250.00');
assert.equal(excessiveDiscounts.excess, '250.00');
assert.equal(excessiveDiscounts.requiresReview, true);
assert.deepEqual(summarizeClientCommissions([
  { venda: true, comissaoEstimada: '0.10' }, { venda: true, comissaoEstimada: '0.20' },
  { venda: true, comissaoEstimada: null }, { venda: true, comissaoEstimada: '0.00' },
  { venda: false, comissaoEstimada: '9999.00' },
]), { total: '0.30', count: 4, missingCount: 1, reviewCount: 0 });
assert.deepEqual(summarizeClientCommissions([
  discountedClient,
  { ...discountedClient, comissaoEstimada: '1500.00' },
  { venda: true, comissaoEstimada: null },
]), { total: '6750.00', count: 3, missingCount: 1, reviewCount: 1 }, 'Resumo soma os líquidos válidos e identifica revisões');
const large = summarizeClientCommissions(Array.from({ length: 5000 }, () => ({ venda: true, comissaoEstimada: '9999999999999.99' })));
assert.equal(large.total, '49999999999999950.00', 'Soma preserva centavos além da precisão de Number');
assert.match(formatClientCommission(large.total), /49\.999\.999\.999\.999\.950,00/);

const dom = new JSDOM('<!doctype html><html><body><button id="previous-focus">Relatório de comissões</button><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/clients', pretendToBeVisual: true,
});
const savedGlobals = new Map();
const scenario = { user: { id: 1, role: 'ADM' } };
const requests = [];
let respond;
const copiedTexts = [];
let clipboardFails = false;
Object.defineProperty(dom.window.navigator, 'clipboard', { configurable: true, value: {
  writeText: async text => {
    if (clipboardFails) throw new Error('Permissão negada.');
    copiedTexts.push(text);
  },
} });
for (const [name, value] of Object.entries({
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true,
  __commissionScenario: scenario,
  __commissionRequest: async (ids, scope, signal) => {
    const request = { ids, scope, signal };
    requests.push(request);
    return respond(request);
  },
  fetch: () => { throw new Error('Chamada externa inesperada no teste de comissões.'); },
})) {
  savedGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}

const clients = [
  { id: 10, ...discountedClient },
  { id: 11, venda: true, comissaoEstimada: null },
  { id: 12, venda: false, comissaoEstimada: '9999.00' },
];
const response = {
  items: [
    { id: 10, nome: 'Marina Alves', imovel: 'CA0123 · Jardim Bela Vista', status: 'Aprovado', observacoes: 'Aguardar documentos do vendedor.', ...discountedClient },
    { id: 11, nome: 'Rafael Costa', imovel: 'AP0048 · Condomínio Ipês', status: 'Solicitando Engenharia', observacoes: '', comissaoEstimada: null },
  ],
  total: '6750.00', count: 2, missingCount: 1, reviewCount: 0, generatedAt: '2026-11-10T15:00:00.000Z', scope: 'Ativos · Todas as cidades',
  text: 'COMISSÕES ESTIMADAS\nAtivos · Todas as cidades\n\nMarina Alves\nCA0123 · Jardim Bela Vista\nStatus — Aprovado\nObservações — Aguardar documentos do vendedor.\nComissão bruta — R$ 8.500,00\nVisita Diego — R$ 1.000,00\nCorretora Vânia — R$ 500,00\nAjuste comercial — R$ 250,00\nComissão líquida estimada — R$ 6.750,00\n\nRafael Costa\nAP0048 · Condomínio Ipês\nStatus — Solicitando Engenharia\nComissão líquida estimada — A informar\n\nTOTAL LÍQUIDO ESTIMADO — R$ 6.750,00',
};
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((success, failure) => { resolve = success; reject = failure; });
  return { promise, resolve, reject };
};
const frontend = fileURLToPath(new URL('../', import.meta.url));
const bundlePath = fileURLToPath(new URL(`../.verify-client-commissions-${randomUUID()}.mjs`, import.meta.url));
let root;

try {
  const output = await build({
    absWorkingDir: frontend, bundle: true, write: false, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic',
    stdin: { resolveDir: frontend, loader: 'jsx', contents: "export { default as ClientCommissionReport } from './src/components/ClientCommissionReport.jsx';" },
    plugins: [{ name: 'commission-fixtures', setup(builder) {
      builder.onResolve({ filter: /^react(?:\/.*)?$/ }, args => ({ path: args.path, external: true }));
      builder.onResolve({ filter: /\/(AuthContext|api)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
        contents: path.endsWith('/api')
          ? 'export const fetchClientCommissionReport = (...args) => globalThis.__commissionRequest(...args);'
          : 'export const useAuth = () => ({ user: globalThis.__commissionScenario.user });',
      }));
    } }],
  });
  await writeFile(bundlePath, output.outputFiles[0].text);
  const { ClientCommissionReport } = await import(pathToFileURL(bundlePath).href);
  const { createRoot } = await import('react-dom/client');
  let closed = 0;
  const props = { clients, scope: response.scope, onClose: () => { closed++; } };
  const element = extra => React.createElement(ClientCommissionReport, { ...props, ...extra });
  const mount = async extra => {
    if (root) await act(async () => root.unmount());
    root = createRoot(document.getElementById('root'));
    await act(async () => root.render(element(extra)));
  };
  const button = text => [...document.querySelectorAll('button')].find(node => node.textContent.trim() === text);
  const click = async node => { assert.ok(node, 'Controle esperado está presente'); await act(async () => node.click()); };

  respond = async () => response;
  scenario.user = { id: 2, role: 'ASSISTENTE' };
  await mount();
  assert.equal(requests.length, 0);
  assert.equal(document.querySelector('[role="dialog"]'), null, 'Assistente não abre o relatório');
  scenario.user = { id: 3, role: 'CORRETOR' };
  await act(async () => root.render(element()));
  assert.equal(requests.length, 0);
  assert.equal(document.querySelector('[role="dialog"]'), null, 'Corretor não abre o relatório');

  scenario.user = { id: 1, role: 'ADM' };
  const pending = deferred();
  respond = () => pending.promise;
  document.getElementById('previous-focus').focus();
  await mount();
  assert.deepEqual(requests.at(-1).ids, [10, 11], 'Seleção contém apenas as vendas');
  assert.equal(requests.at(-1).scope, response.scope);
  assert.equal(document.querySelector('[role="dialog"]').getAttribute('aria-busy'), 'true');
  assert.ok(button('Copiar relatório').disabled);
  assert.equal(document.body.style.overflow, 'hidden');
  assert.ok(document.querySelector('[role="dialog"]').contains(document.activeElement));
  await act(async () => pending.resolve(response));
  assert.equal(document.querySelector('[role="dialog"]').getAttribute('aria-busy'), 'false');
  assert.ok(!button('Copiar relatório').disabled);
  assert.match(document.body.textContent, /Total líquido estimado/);
  assert.match(document.body.textContent, /6\.750,00/);
  assert.match(document.body.textContent, /1 comissão a informar/);
  assert.match(document.querySelector('pre').textContent, /Status — Aprovado/);
  assert.match(document.querySelector('pre').textContent, /Observações — Aguardar documentos do vendedor/);
  assert.match(document.querySelector('pre').textContent, /Visita Diego — R\$ 1\.000,00/);
  assert.match(document.querySelector('pre').textContent, /Corretora Vânia — R\$ 500,00/);
  assert.match(document.querySelector('pre').textContent, /Ajuste comercial — R\$ 250,00/);
  await click(button('Copiar relatório'));
  assert.deepEqual(copiedTexts, [response.text], 'Texto completo inclui status e observações da API');
  assert.ok(button('Copiado'));

  const dialog = document.querySelector('[role="dialog"]');
  const controls = [...dialog.querySelectorAll('button:not([disabled])')];
  await act(async () => {
    controls.at(-1).focus();
    document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  });
  assert.equal(document.activeElement, controls[0]);
  await act(async () => {
    controls[0].focus();
    document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
  });
  assert.equal(document.activeElement, controls.at(-1));
  await act(async () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  assert.equal(closed, 1);

  clipboardFails = true;
  await click(button('Copiado'));
  const textarea = document.querySelector('textarea');
  assert.ok(textarea, 'Falha na área de transferência disponibiliza cópia manual');
  assert.equal(textarea.value, response.text);
  assert.equal(document.activeElement, textarea);
  assert.equal(textarea.selectionStart, 0);
  assert.equal(textarea.selectionEnd, response.text.length);
  assert.match(document.querySelector('[role="alert"]').textContent, /copiar manualmente/);

  clipboardFails = false;
  const reservationResponse = {
    ...response,
    items: [{ ...response.items[0], reservaAnuncios: true }, response.items[1]],
    total: '6250.00',
    text: response.text.replaceAll('6.750,00', '6.250,00').replace('Ajuste comercial —', 'Reserva Anúncios — R$ 500,00\nAjuste comercial —'),
  };
  respond = async () => reservationResponse;
  await mount();
  assert.match(document.querySelector('pre').textContent, /Reserva Anúncios — R\$ 500,00/);
  assert.match(document.body.textContent, /6\.250,00/);
  await click(button('Copiar relatório'));
  assert.equal(copiedTexts.at(-1), reservationResponse.text, 'A cópia inclui a reserva de anúncios e o total líquido atualizado');

  const reviewResponse = { ...response, count: 3, reviewCount: 1, text: response.text + '\nComissão pendente de revisão.' };
  respond = async () => reviewResponse;
  await mount();
  assert.match(document.querySelector('[role="alert"]').textContent, /Total parcial/);
  assert.match(document.body.textContent, /1 comissão para revisar/);
  assert.match(document.querySelector('pre').textContent, /Comissão pendente de revisão/);
  await click(button('Copiar relatório'));
  assert.equal(copiedTexts.at(-1), reviewResponse.text, 'Cópia preserva a indicação de total parcial enviada pelo servidor');

  clipboardFails = false;
  respond = async () => { throw new Error('API indisponível.'); };
  await mount();
  assert.match(document.querySelector('[role="alert"]').textContent, /Não foi possível gerar o relatório/);
  assert.ok(button('Copiar relatório').disabled);
  respond = async () => response;
  await click(button('Tentar novamente'));
  assert.ok(document.querySelector('pre')?.textContent.includes('Marina Alves'));

  const oldSession = deferred();
  respond = () => oldSession.promise;
  await mount();
  const oldSignal = requests.at(-1).signal;
  scenario.user = { id: 2, role: 'ASSISTENTE' };
  await act(async () => root.render(element()));
  assert.equal(oldSignal.aborted, true, 'Trocar o perfil cancela a consulta');
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.equal(document.body.style.overflow, '', 'Troca de perfil libera a rolagem');
  await act(async () => oldSession.resolve(response));
  assert.ok(!document.body.textContent.includes('Marina Alves'), 'Resposta antiga não fica visível para outro perfil');

  scenario.user = { id: 1, role: 'ADM' };
  const beforeEmpty = requests.length;
  await mount({ clients: [] });
  assert.equal(requests.length, beforeEmpty, 'Seleção vazia evita requisição inválida');
  assert.match(document.body.textContent, /Nenhuma venda encontrada/);
  assert.ok(button('Copiar relatório').disabled);
  await act(async () => root.unmount());
  root = null;
  assert.equal(document.body.style.overflow, '');

  console.log('Comissões validadas: descontos cumulativos, valores líquidos exatos, normalização da corretora, revisões, acesso ADM, seleção de vendas, status/observações, cópia e fallback manual, retry, troca de perfil e acessibilidade.');
} finally {
  if (root) await act(async () => root.unmount());
  await unlink(bundlePath).catch(() => {});
  dom.window.close();
  for (const [name, descriptor] of savedGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}
