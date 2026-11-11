import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<div id="root"></div>', {
  url: 'http://localhost:5173/clients', pretendToBeVisual: true,
});
const descriptors = new Map();
const scenario = { role: 'ADM' };
for (const [name, value] of Object.entries({
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  Element: dom.window.Element, HTMLElement: dom.window.HTMLElement,
  HTMLInputElement: dom.window.HTMLInputElement, SVGElement: dom.window.SVGElement,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  Event: dom.window.Event, MouseEvent: dom.window.MouseEvent,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  IS_REACT_ACT_ENVIRONMENT: true, __commissionFormScenario: scenario,
})) {
  descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}

const React = await import('react');
const { act } = React;
const { createRoot } = await import('react-dom/client');
const frontend = fileURLToPath(new URL('../', import.meta.url));
const bundlePath = fileURLToPath(new URL(`../.verify-commission-form-${randomUUID()}.mjs`, import.meta.url));
let root;

try {
  const output = await build({
    absWorkingDir: frontend, bundle: true, write: false, format: 'esm',
    platform: 'node', packages: 'external', jsx: 'automatic',
    stdin: {
      contents: "export { default as ClientModal } from './src/components/ClientModal.jsx'; export { default as KanbanCard } from './src/components/KanbanCard.jsx';",
      resolveDir: frontend, loader: 'jsx',
    },
    plugins: [{ name: 'commission-form-fixtures', setup(builder) {
      builder.onResolve({ filter: /\/(AuthContext|api|useToast|FancySelect)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
        contents: path.endsWith('/AuthContext')
          ? 'export const useAuth = () => ({ user: { role: globalThis.__commissionFormScenario.role } });'
          : path.endsWith('/api') ? 'export const fetchProperties = async () => [];'
            : path.endsWith('/useToast') ? 'export const useToast = () => ({ error: message => { throw new Error(message); } });'
              : 'export default function FancySelect() { return null; }',
      }));
    } }],
  });
  await writeFile(bundlePath, output.outputFiles[0].text);
  const { ClientModal, KanbanCard } = await import(pathToFileURL(bundlePath).href);
  root = createRoot(document.getElementById('root'));
  const saved = [];
  const base = {
    isOpen: true, onClose: () => {}, onSave: async payload => saved.push(payload),
    clientToEdit: { id: 42, nome: 'Teste', corretor: 'Equipe', venda: true, comissaoEstimada: 0, status: 'Aprovado' },
  };
  const nextFrame = async () => act(async () => new Promise(resolve => requestAnimationFrame(resolve)));
  const render = async props => {
    await act(async () => root.render(React.createElement(ClientModal, props)));
    await nextFrame();
  };
  const submit = async () => {
    await act(async () => document.getElementById('client-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    await nextFrame();
  };
  const setInput = async (input, value) => act(async () => {
    assert.ok(input, 'O campo a preencher está disponível');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const setCommission = value => setInput(document.getElementById('comissaoEstimada'), value);
  const toggleSale = async () => act(async () => document.getElementById('venda').click());
  const click = async button => {
    assert.ok(button, 'O controle a acionar está disponível');
    await act(async () => button.click());
    await nextFrame();
  };
  const findButton = label => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === label);
  const discountRows = () => [...document.querySelectorAll('[data-discount-row]')];
  const addDiscount = () => click(findButton('+ Adicionar desconto'));
  const setDiscount = async (index, description, value) => {
    const [descriptionInput, valueInput] = discountRows()[index].querySelectorAll('input');
    await setInput(descriptionInput, description);
    await setInput(valueInput, value);
  };
  const netAmount = () => [...document.querySelector('[aria-label="Cálculo da comissão"]').querySelectorAll('p')].at(-1).textContent;
  const assertSaveBlocked = async message => {
    const count = saved.length;
    await submit();
    assert.equal(saved.length, count, message);
  };

  await render(base);
  assert.equal(document.getElementById('comissaoEstimada').value, '0,00', 'Comissão zero é um valor preenchido');
  assert.equal(document.getElementById('reservaAnuncios').checked, false, 'Cadastros anteriores começam sem a reserva de anúncios');
  await submit();
  assert.equal(saved.at(-1).comissaoEstimada, '0.00');

  await setCommission('123456');
  assert.equal(document.getElementById('comissaoEstimada').value, '1.234,56', 'A moeda acompanha a digitação');
  await toggleSale();
  assert.equal(Boolean(document.getElementById('comissaoEstimada')), false, 'Campo aparece somente em vendas');
  await toggleSale();
  assert.equal(document.getElementById('comissaoEstimada').value, '1.234,56', 'Alternar Venda conserva o preenchimento');
  await submit();
  assert.equal(saved.at(-1).comissaoEstimada, '1234.56', 'Payload usa decimal com centavos exatos');

  await setCommission('');
  await submit();
  assert.equal(saved.at(-1).comissaoEstimada, null, 'Ausência de valor permanece distinta de zero');

  await setCommission('999999999999999');
  assert.equal(document.getElementById('comissaoEstimada').value, '9.999.999.999.999,99');
  await setCommission('9999999999999999');
  assert.equal(document.getElementById('comissaoEstimada').value, '9.999.999.999.999,99', 'Entrada respeita decimal 15,2');
  await submit();
  assert.equal(saved.at(-1).comissaoEstimada, '9999999999999.99');

  await render({ ...base, clientToEdit: { ...base.clientToEdit, comissaoEstimada: null } });
  assert.equal(document.getElementById('comissaoEstimada').value, '', 'Cadastros antigos podem aguardar preenchimento');
  await render({ ...base, clientToEdit: null });
  assert.equal(Boolean(document.getElementById('comissaoEstimada')), false);
  await toggleSale();
  assert.equal(document.getElementById('comissaoEstimada').value, '');

  await render({
    ...base,
    brokerSuggestions: ['Vania', ' VÂNIA ', 'Equipe', 'Equipe'],
    clientToEdit: { ...base.clientToEdit, corretor: ' VÂNIA ', comissaoEstimada: '8500.00', visitaDiego: true, descontosComissao: [{ descricao: 'Ajuste comercial', valor: '250.00' }] },
  });
  assert.match(netAmount(), /6\.750,00/, 'Diego, Vânia e desconto adicional são acumulados');
  assert.ok(document.body.textContent.includes('Corretora Vânia'));
  assert.ok(!document.body.textContent.includes('automático'), 'A dedução da corretora usa o rótulo simples');
  assert.deepEqual([...document.querySelectorAll('datalist option')].map(option => option.value), ['Vânia', 'Equipe'], 'Sugestões padronizam acentos e espaços sem duplicar nomes');
  await submit();
  assert.equal(saved.at(-1).comissaoEstimada, '8500.00', 'A comissão bruta é preservada ao salvar o líquido calculado');
  assert.equal(saved.at(-1).visitaDiego, true);
  assert.deepEqual(saved.at(-1).descontosComissao, [{ descricao: 'Ajuste comercial', valor: '250.00' }]);
  await render({ ...base, clientToEdit: saved.at(-1) });
  assert.equal(document.getElementById('comissaoEstimada').value, '8.500,00');
  assert.match(netAmount(), /6\.750,00/, 'Reabrir o cadastro não aplica os descontos duas vezes');
  await click(document.getElementById('visitaDiego'));
  assert.match(netAmount(), /7\.750,00/, 'Desmarcar Diego remove somente a dedução da visita');
  await setInput(document.getElementById('corretor'), 'Outra corretora');
  assert.match(netAmount(), /8\.250,00/, 'Alterar a corretora recalcula a dedução de Vânia');
  await setInput(document.getElementById('corretor'), 'Vaniana');
  assert.match(netAmount(), /8\.250,00/, 'Um trecho do nome não aciona a dedução de Vânia');

  await render({ ...base, clientToEdit: { ...base.clientToEdit, corretor: 'Vânia', comissaoEstimada: '8500.00', visitaDiego: true, descontosComissao: [{ descricao: 'Ajuste comercial', valor: '250.00' }] } });
  await click(document.getElementById('reservaAnuncios'));
  assert.match(netAmount(), /6\.250,00/, 'Reserva Anúncios soma R$ 500 aos descontos da visita, da corretora e dos adicionais');
  assert.ok(document.querySelector('[aria-label="Cálculo da comissão"]').textContent.includes('Reserva Anúncios'));
  await submit();
  assert.equal(saved.at(-1).reservaAnuncios, true);
  assert.equal(saved.at(-1).comissaoEstimada, '8500.00', 'A reserva de anúncios preserva a comissão bruta');
  await render({ ...base, clientToEdit: saved.at(-1) });
  assert.equal(document.getElementById('reservaAnuncios').checked, true, 'A reserva permanece selecionada ao reabrir');
  assert.match(netAmount(), /6\.250,00/, 'Reabrir não reaplica a reserva de anúncios');
  await toggleSale();
  await submit();
  assert.equal(saved.at(-1).venda, false);
  assert.equal(saved.at(-1).reservaAnuncios, true, 'Desmarcar Venda conserva a reserva para uma edição posterior');
  await toggleSale();
  assert.equal(document.getElementById('reservaAnuncios').checked, true);
  await click(document.getElementById('reservaAnuncios'));
  assert.match(netAmount(), /6\.750,00/, 'Desmarcar a reserva remove somente seus R$ 500');
  await submit();
  assert.equal(saved.at(-1).reservaAnuncios, false);

  await render({ ...base, clientToEdit: { ...base.clientToEdit, comissaoEstimada: '499.99', reservaAnuncios: true } });
  assert.ok(findButton('Salvar Cliente').disabled, 'Reserva acima da comissão bloqueia o salvamento');
  assert.ok(document.getElementById('commission-review-error')?.textContent.includes('0,01'));
  await assertSaveBlocked('O envio também impede líquido negativo causado pela reserva');
  await setCommission('50000');
  assert.equal(findButton('Salvar Cliente').disabled, false, 'Reserva igual à comissão permite líquido zero');
  await submit();
  assert.equal(saved.at(-1).comissaoEstimada, '500.00');
  assert.equal(saved.at(-1).reservaAnuncios, true);

  await render({ ...base, clientToEdit: { ...base.clientToEdit, corretor: 'Vânia', comissaoEstimada: '8500.00', visitaDiego: true, descontosComissao: [] } });
  await addDiscount();
  assert.equal(discountRows().length, 1);
  await assertSaveBlocked('Uma linha adicionada exige descrição e valor antes de salvar');
  assert.ok(document.body.textContent.includes('Informe a descrição do desconto.'));
  assert.ok(document.body.textContent.includes('Informe um valor maior que zero.'));
  assert.equal(document.activeElement.id, discountRows()[0].querySelector('input').id, 'O foco identifica o primeiro campo incompleto');
  await setDiscount(0, '  Ajuste comercial  ', '25000');
  assert.equal(discountRows()[0].querySelectorAll('input')[1].value, '250,00');
  assert.match(netAmount(), /6\.750,00/);
  await addDiscount();
  await setDiscount(1, 'Despesa acordada', '50000');
  assert.match(netAmount(), /6\.250,00/, 'Várias linhas participam da soma em centavos');
  await submit();
  assert.deepEqual(saved.at(-1).descontosComissao, [
    { descricao: 'Ajuste comercial', valor: '250.00' },
    { descricao: 'Despesa acordada', valor: '500.00' },
  ], 'O payload remove espaços extras e mantém descrições e valores individuais');
  assert.ok(saved.at(-1).descontosComissao.every(discount => !Object.hasOwn(discount, 'key')), 'Chaves de interface não entram nos dados persistidos');
  await click(discountRows()[0].querySelector('button'));
  assert.equal(discountRows().length, 1);
  assert.equal(discountRows()[0].querySelector('input').value, 'Despesa acordada', 'Remover uma linha mantém a identidade das demais');
  assert.match(netAmount(), /6\.500,00/);
  await click(discountRows()[0].querySelector('button'));
  assert.match(netAmount(), /7\.000,00/);
  await addDiscount();
  await setDiscount(0, 'Ajuste', '0');
  await assertSaveBlocked('Um desconto adicional de zero exige revisão');
  assert.ok(document.body.textContent.includes('Informe um valor maior que zero.'));

  await render({ ...base, clientToEdit: { ...base.clientToEdit, corretor: 'Vânia', comissaoEstimada: '8500.00', visitaDiego: true, descontosComissao: [] } });
  await addDiscount();
  await setInput(discountRows()[0].querySelector('input'), 'Ajuste pendente');
  await toggleSale();
  assert.equal(Boolean(document.querySelector('[aria-label="Comissão administrativa"]')), false, 'Desmarcar Venda recolhe o bloco antes da validação');
  await assertSaveBlocked('Um desconto incompleto preservado ao desmarcar Venda requer revisão');
  const revealedDiscount = discountRows()[0];
  assert.ok(document.querySelector('[aria-label="Comissão administrativa"]'), 'A validação revela os campos que precisam de correção');
  assert.ok(document.body.textContent.includes('Há descontos incompletos.'));
  assert.ok(document.body.textContent.includes('Informe um valor maior que zero.'));
  assert.equal(document.activeElement.id, revealedDiscount.querySelectorAll('input')[1].id, 'O foco alcança o valor incompleto após revelar a seção');
  await click(revealedDiscount.querySelector('button'));
  await submit();
  assert.equal(saved.at(-1).venda, false);
  assert.equal(saved.at(-1).comissaoEstimada, '8500.00', 'Retirar a marcação de venda conserva o valor bruto');
  assert.equal(saved.at(-1).visitaDiego, true, 'Retirar a marcação de venda conserva a opção de visita');
  assert.deepEqual(saved.at(-1).descontosComissao, []);

  await render({ ...base, clientToEdit: { ...base.clientToEdit, corretor: 'Vânia', comissaoEstimada: '1000.00', visitaDiego: true, descontosComissao: [] } });
  assert.match(netAmount(), /500,00/);
  assert.ok(findButton('Salvar Cliente').disabled, 'Líquido negativo bloqueia a ação de salvar');
  assert.ok(document.getElementById('commission-review-error')?.textContent.includes('500,00'));
  await assertSaveBlocked('O submit também protege contra saldo negativo');
  await setCommission('150000');
  assert.match(netAmount(), /0,00/);
  assert.equal(findButton('Salvar Cliente').disabled, false, 'Líquido igual a zero é válido');
  await submit();
  assert.equal(saved.at(-1).comissaoEstimada, '1500.00');
  await setCommission('');
  assert.equal(netAmount(), 'A informar');
  await submit();
  assert.equal(saved.at(-1).comissaoEstimada, null, 'Comissão bruta ausente continua pendente mesmo com deduções selecionadas');

  for (const role of ['ASSISTENTE', 'CORRETOR']) {
    scenario.role = role;
    await render({ ...base, clientToEdit: { ...base.clientToEdit, comissaoEstimada: '9000.00', visitaDiego: true, reservaAnuncios: true, descontosComissao: [{ descricao: 'Privado', valor: '250.00' }] } });
    assert.equal(Boolean(document.getElementById('comissaoEstimada')), false, `${role} não visualiza o campo`);
    assert.equal(Boolean(document.getElementById('visitaDiego')), false, `${role} não visualiza a opção de visita`);
    assert.equal(Boolean(document.getElementById('reservaAnuncios')), false, `${role} não visualiza a reserva de anúncios`);
    assert.equal(Boolean(document.querySelector('[data-discount-row]')), false, `${role} não visualiza descontos privados`);
    await submit();
    for (const field of ['comissaoEstimada', 'visitaDiego', 'reservaAnuncios', 'descontosComissao']) {
      assert.equal(Object.hasOwn(saved.at(-1), field), false, `${role} não envia ${field} no payload`);
    }
  }

  const renderCard = async (role, client) => {
    scenario.role = role;
    await act(async () => root.render(React.createElement(KanbanCard, { client, status: client.status })));
  };
  await renderCard('ADM', { ...base.clientToEdit, comissaoEstimada: '8500.25' });
  assert.ok(document.body.textContent.includes('Comissão líquida estimada'));
  assert.match(document.body.textContent, /8\.500,25/);
  await renderCard('ADM', { ...base.clientToEdit, corretor: 'Vânia', comissaoEstimada: '8500.25', visitaDiego: true, descontosComissao: [{ descricao: 'Ajuste', valor: '250.00' }] });
  assert.match(document.body.textContent, /6\.750,25/, 'Kanban destaca o líquido após todas as deduções');
  await renderCard('ADM', { ...base.clientToEdit, corretor: 'Vânia', comissaoEstimada: '8500.25', visitaDiego: true, reservaAnuncios: true, descontosComissao: [{ descricao: 'Ajuste', valor: '250.00' }] });
  assert.match(document.body.textContent, /6\.250,25/, 'Kanban inclui a reserva de anúncios no líquido');
  await renderCard('ADM', { ...base.clientToEdit, corretor: 'Vânia', comissaoEstimada: '100.00' });
  assert.ok(document.body.textContent.includes('Revisar valores'), 'Cadastros antigos com líquido inválido ficam sinalizados');
  await renderCard('ADM', { ...base.clientToEdit, comissaoEstimada: null });
  assert.ok(document.body.textContent.includes('A informar'));
  await renderCard('ADM', { ...base.clientToEdit, venda: false });
  assert.ok(!document.body.textContent.includes('Comissão líquida estimada'));
  for (const role of ['ASSISTENTE', 'CORRETOR']) {
    await renderCard(role, { ...base.clientToEdit, comissaoEstimada: '8500.25' });
    assert.ok(!document.body.textContent.includes('Comissão líquida estimada'));
  }

  console.log('Comissão validada no cadastro e Kanban. Descontos cumulativos e adicionais, líquido, revisão obrigatória, alternância de Venda, perfis, centavos e payload preservados.');
} finally {
  if (root) await act(async () => root.unmount());
  await unlink(bundlePath).catch(() => {});
  dom.window.close();
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}
