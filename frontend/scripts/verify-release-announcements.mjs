import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { MemoryRouter } from 'react-router-dom';

const dom = new JSDOM('<!doctype html><html><body><button id="previous-focus">Voltar à tarefa</button><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/tasks', pretendToBeVisual: true,
});
const descriptors = new Map();
const requests = [];
const scenario = { userId: 1, hook: null };
const taskNotification = { id: 1, kind: 'ASSIGNED', readAt: null, actorName: 'Equipe', taskId: 7, task: { title: 'Solicitar engenharia', dueDate: null } };
let taskItems = [taskNotification];
const taskToasts = [];
let respond = async () => { throw new Error('Resposta de teste não configurada.'); };
for (const [name, value] of Object.entries({
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement, CustomEvent: dom.window.CustomEvent,
  localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true,
  sessionStorage: dom.window.sessionStorage,
  __releaseScenario: scenario,
  __releaseRequest: async (path, options = {}) => {
    const request = { path, method: options.method || 'GET', ...options };
    requests.push(request);
    return respond(request);
  },
  __releaseTaskRequest: async () => ({
    items: taskItems,
    unreadAssignedCount: taskItems.length, unreadCount: taskItems.length, nextCursor: null,
  }),
  __releaseTaskToast: (message, options) => { taskToasts.push({ message, options }); return taskToasts.length; },
  fetch: () => { throw new Error('Requisição externa inesperada no teste de novidades.'); },
})) {
  descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}

const firstRelease = {
  id: 'imoveis-engenharias', title: 'Atualização de novembro',
  publishedAt: '2026-11-09T03:00:00.000Z',
  highlights: ['Acesse Mapa e Engenharias pela área Imóveis.', 'Consulte a entrada e o vencimento pela ficha.', 'Cadastre com o vínculo preenchido.'],
  acknowledgedAt: null,
};
const secondRelease = {
  id: 'tarefas-atualizadas', title: 'Mais agilidade nas tarefas',
  publishedAt: '2026-11-08T03:00:00.000Z', highlights: ['Conclua subtarefas pelo cartão.'],
  acknowledgedAt: null,
};
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((success, failure) => { resolve = success; reject = failure; });
  return { promise, resolve, reject };
};
const frontend = fileURLToPath(new URL('../', import.meta.url));
const bundlePath = fileURLToPath(new URL(`../.verify-release-announcements-${randomUUID()}.mjs`, import.meta.url));
let root;

try {
  const output = await build({
    absWorkingDir: frontend, bundle: true, write: false, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic',
    stdin: { resolveDir: frontend, loader: 'jsx', contents: `
      import useReleaseAnnouncements from './src/hooks/useReleaseAnnouncements.js';
      export { default as ReleaseAnnouncementModal } from './src/components/releases/ReleaseAnnouncementModal.jsx';
      export { default as TaskNotifications } from './src/components/TaskNotifications.jsx';
      export function HookHarness({ userId, enabled }) {
        globalThis.__releaseScenario.hook = useReleaseAnnouncements(userId, enabled);
        return null;
      }`,
    },
    plugins: [{ name: 'release-fixtures', setup(builder) {
      builder.onResolve({ filter: /^react(?:\/.*)?$/ }, args => ({ path: args.path, external: true }));
      builder.onResolve({ filter: /^sonner$/ }, () => ({ path: 'sonner', namespace: 'fixture' }));
      builder.onResolve({ filter: /\/(releaseApi|AuthContext|api)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
        contents: path === 'sonner'
          ? 'export const toast = { info: (...args) => globalThis.__releaseTaskToast(...args), error: () => {}, dismiss: () => {} };'
          : path.endsWith('/releaseApi')
          ? 'export const releaseApi = (...args) => globalThis.__releaseRequest(...args);'
          : path.endsWith('/api') ? 'export const taskApi = (...args) => globalThis.__releaseTaskRequest(...args);'
            : 'export const useAuth = () => ({ user: { id: globalThis.__releaseScenario.userId } });',
      }));
    } }],
  });
  await writeFile(bundlePath, output.outputFiles[0].text);
  const { HookHarness, ReleaseAnnouncementModal, TaskNotifications } = await import(pathToFileURL(bundlePath).href);
  const { createRoot } = await import('react-dom/client');
  const mount = async element => {
    if (root) await act(async () => root.unmount());
    root = createRoot(document.getElementById('root'));
    await act(async () => root.render(element));
  };
  const renderHook = async (userId, enabled = true) => {
    scenario.userId = userId;
    await act(async () => root.render(React.createElement(HookHarness, { userId, enabled })));
  };
  const mountHook = async (userId = 1, enabled = true) => {
    requests.length = 0;
    scenario.userId = userId;
    await mount(React.createElement(HookHarness, { userId, enabled }));
  };
  const button = label => [...document.querySelectorAll('button')].find(node => node.textContent.trim() === label);
  const click = async node => { assert.ok(node, 'Controle esperado está disponível'); await act(async () => node.click()); };

  respond = async () => ({ items: [firstRelease, secondRelease], total: 2 });
  await mountHook(1, false);
  assert.equal(requests.length, 0, 'Troca obrigatória de senha pode adiar a consulta de novidades');
  assert.deepEqual(scenario.hook.items, []);
  assert.equal(scenario.hook.checking, false);
  await renderHook(1);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, '/pending');
  assert.deepEqual(scenario.hook.items.map(item => item.id), [firstRelease.id, secondRelease.id]);
  assert.equal(scenario.hook.checking, false);
  await act(async () => {
    window.dispatchEvent(new dom.window.Event('focus'));
    document.dispatchEvent(new dom.window.Event('visibilitychange'));
  });
  assert.equal(requests.length, 1, 'Retomar a aba não interrompe o usuário com uma nova consulta');

  const confirmation = deferred();
  respond = request => {
    assert.equal(request.path, '/acknowledge');
    return confirmation.promise;
  };
  let firstAcknowledgement;
  let secondAcknowledgement;
  const acknowledgements = [];
  const rememberAcknowledgement = event => acknowledgements.push(event.detail);
  window.addEventListener('motive:releases-acknowledged', rememberAcknowledgement);
  await act(async () => {
    firstAcknowledgement = scenario.hook.acknowledge();
    secondAcknowledgement = scenario.hook.acknowledge();
  });
  assert.equal(requests.filter(request => request.method === 'POST').length, 1, 'Dois cliques simultâneos geram uma confirmação');
  assert.deepEqual(requests.at(-1).body, { ids: [firstRelease.id, secondRelease.id] }, 'Confirma apenas as novidades incluídas no aviso');
  assert.equal(scenario.hook.busy, true);
  await act(async () => {
    confirmation.resolve({ acknowledgedIds: [firstRelease.id, secondRelease.id] });
    assert.equal(await firstAcknowledgement, true);
    assert.equal(await secondAcknowledgement, true);
  });
  assert.equal(scenario.hook.busy, false);
  assert.deepEqual(scenario.hook.items, []);
  assert.ok(acknowledgements.some(event => event.userId === 1 && event.ids.includes(firstRelease.id)), 'Confirmação avisa outros componentes do usuário');
  window.removeEventListener('motive:releases-acknowledged', rememberAcknowledgement);

  respond = async () => ({ items: [firstRelease], total: 1 });
  await mountHook();
  respond = async () => { throw new Error('Falha ao confirmar o aviso.'); };
  await act(async () => { assert.equal(await scenario.hook.acknowledge(), false); });
  assert.equal(scenario.hook.items.length, 1, 'Falha preserva a novidade pendente para tentar novamente');
  assert.ok(scenario.hook.error);
  assert.equal(scenario.hook.busy, false);
  respond = async () => ({ acknowledgedIds: [firstRelease.id] });
  await act(async () => { assert.equal(await scenario.hook.acknowledge(), true); });
  assert.deepEqual(scenario.hook.items, []);
  assert.equal(scenario.hook.error, '');

  respond = async () => ({ items: [firstRelease], total: 1 });
  await mountHook();
  respond = async () => { throw new Error('Confirmação temporariamente indisponível.'); };
  await act(async () => { assert.equal(await scenario.hook.acknowledge(), false); });
  const requestsBeforeDeferral = requests.length;
  await act(async () => scenario.hook.dismiss());
  assert.deepEqual(scenario.hook.items, [], 'Dispensa temporária libera o sistema após falhar a confirmação');
  assert.equal(requests.length, requestsBeforeDeferral, 'Dispensa temporária não grava recibo de leitura');
  respond = async () => ({ items: [firstRelease], total: 1 });
  await mountHook();
  assert.equal(scenario.hook.items.length, 1, 'Próximo acesso reapresenta a novidade que continua pendente');

  respond = async () => { throw new Error('Falha de conexão.'); };
  await mountHook();
  assert.equal(scenario.hook.checking, false, 'Indisponibilidade da consulta libera o uso do sistema');
  assert.deepEqual(scenario.hook.items, []);

  const previousUser = deferred();
  const nextUser = deferred();
  let userRequest = 0;
  respond = () => (++userRequest === 1 ? previousUser.promise : nextUser.promise);
  await mountHook(1);
  const obsoleteSignal = requests[0].signal;
  await renderHook(2);
  assert.equal(obsoleteSignal.aborted, true, 'Trocar de usuário cancela a busca anterior');
  assert.deepEqual(scenario.hook.items, [], 'Dados da conta anterior desaparecem imediatamente');
  await act(async () => previousUser.resolve({ items: [firstRelease], total: 1 }));
  assert.deepEqual(scenario.hook.items, [], 'Resposta atrasada não entra na sessão seguinte');
  await act(async () => nextUser.resolve({ items: [secondRelease], total: 1 }));
  assert.deepEqual(scenario.hook.items.map(item => item.id), [secondRelease.id]);

  const obsoleteAcknowledgement = deferred();
  respond = async request => request.method === 'POST' ? obsoleteAcknowledgement.promise : { items: [firstRelease], total: 1 };
  await mountHook(1);
  let obsoleteAcknowledgementResult;
  await act(async () => { obsoleteAcknowledgementResult = scenario.hook.acknowledge(); });
  const obsoleteAcknowledgementSignal = requests.at(-1).signal;
  respond = async () => ({ items: [secondRelease], total: 1 });
  await renderHook(2);
  assert.equal(obsoleteAcknowledgementSignal.aborted, true, 'Trocar de usuário cancela também a confirmação anterior');
  await act(async () => {
    obsoleteAcknowledgement.resolve({ acknowledgedIds: [firstRelease.id] });
    assert.equal(await obsoleteAcknowledgementResult, false);
  });
  assert.deepEqual(scenario.hook.items.map(item => item.id), [secondRelease.id]);
  assert.equal(scenario.hook.error, '', 'Confirmação antiga não contamina a mensagem da conta seguinte');

  const pendingBeforeRemoteAcknowledgement = deferred();
  respond = () => pendingBeforeRemoteAcknowledgement.promise;
  await mountHook(1);
  await act(async () => window.dispatchEvent(new dom.window.CustomEvent('motive:releases-acknowledged', { detail: { userId: 1, ids: [firstRelease.id] } })));
  await act(async () => pendingBeforeRemoteAcknowledgement.resolve({ items: [firstRelease, secondRelease], total: 2 }));
  assert.deepEqual(scenario.hook.items.map(item => item.id), [secondRelease.id], 'Uma resposta em andamento respeita a confirmação recebida de outra aba');

  respond = async () => ({ items: [firstRelease, secondRelease], total: 2 });
  await mountHook(1);
  await act(async () => window.dispatchEvent(new dom.window.CustomEvent('motive:releases-acknowledged', { detail: { userId: 2, ids: [firstRelease.id] } })));
  assert.equal(scenario.hook.items.length, 2, 'Evento de outra conta não encerra o aviso');
  await act(async () => window.dispatchEvent(new dom.window.CustomEvent('motive:releases-acknowledged', { detail: { userId: 1, ids: [firstRelease.id] } })));
  assert.deepEqual(scenario.hook.items.map(item => item.id), [secondRelease.id], 'Evento confirma somente os IDs recebidos');
  await act(async () => window.dispatchEvent(new dom.window.StorageEvent('storage', {
    key: 'motive:release-acknowledged', newValue: JSON.stringify({ userId: 1, ids: [secondRelease.id] }),
  })));
  assert.deepEqual(scenario.hook.items, [], 'Confirmação em outra aba sincroniza o aviso');

  const whileEditing = deferred();
  respond = () => whileEditing.promise;
  await mountHook();
  const editingInput = document.createElement('input');
  document.body.append(editingInput);
  editingInput.focus();
  await act(async () => whileEditing.resolve({ items: [firstRelease], total: 1 }));
  assert.deepEqual(scenario.hook.items, [], 'Resposta lenta adia o aviso quando o usuário já está preenchendo um formulário');
  assert.equal(scenario.hook.checking, false);
  assert.ok(requests.every(request => request.method === 'GET'), 'Adiar a apresentação não confirma a leitura');
  editingInput.remove();

  let closed = 0;
  let confirmed = 0;
  let deferredByUser = 0;
  const modalProps = {
    items: [firstRelease], onClose: () => { closed++; }, onConfirm: () => { confirmed++; },
    onDefer: () => { deferredByUser++; }, busy: false, error: '',
  };
  document.getElementById('previous-focus').focus();
  await mount(React.createElement(ReleaseAnnouncementModal, modalProps));
  const dialog = document.querySelector('[role="dialog"]');
  assert.ok(dialog);
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  assert.equal(document.getElementById(dialog.getAttribute('aria-labelledby'))?.textContent, 'O sistema foi atualizado!');
  assert.ok(dialog.contains(document.activeElement), 'Foco entra na janela');
  assert.equal(document.body.style.overflow, 'hidden');
  assert.equal(dialog.querySelectorAll('li').length, 3);
  assert.equal(dialog.querySelectorAll('button').length, 2, 'Popup apresenta apenas fechar e Entendi');
  assert.ok(button('Entendi').classList.contains('ui-button--primary'), 'Entendi é a ação principal');
  await click(button('Entendi'));
  assert.equal(confirmed, 1);
  await act(async () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  assert.equal(closed, 1, 'Escape usa o mesmo fluxo de confirmação do fechamento');
  const controls = [...dialog.querySelectorAll('button:not([disabled]), a[href]')];
  await act(async () => {
    controls.at(-1).focus();
    document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  });
  assert.equal(document.activeElement, controls[0], 'Tab mantém o foco dentro da janela');
  await act(async () => {
    controls[0].focus();
    document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
  });
  assert.equal(document.activeElement, controls.at(-1));
  await act(async () => root.render(React.createElement(ReleaseAnnouncementModal, { ...modalProps, error: 'Falha ao confirmar.' })));
  await click(button('Continuar por agora'));
  assert.equal(deferredByUser, 1, 'Falha oferece saída temporária para continuar usando o sistema');
  await act(async () => root.render(React.createElement(ReleaseAnnouncementModal, { ...modalProps, busy: true })));
  assert.ok([...dialog.querySelectorAll('button')].every(node => node.disabled), 'Controles aguardam a confirmação em andamento');
  await act(async () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  assert.equal(closed, 1, 'Confirmação em andamento evita um segundo fechamento');

  await mount(null);
  assert.equal(document.body.style.overflow, '', 'Fechar a janela restaura a rolagem');
  assert.equal(document.activeElement.id, 'previous-focus', 'Fechar a janela devolve o foco ao ponto de origem');

  sessionStorage.setItem('motive_just_logged_in', '1');
  await mount(React.createElement(MemoryRouter, null, React.createElement(TaskNotifications, { userId: 1, suppressPrompts: true })));
  assert.equal(document.querySelector('[aria-label="Novas tarefas recebidas"]'), null, 'Aviso de tarefas aguarda a apresentação das novidades');
  assert.ok(document.querySelector('button[aria-controls="task-notifications"]').disabled);
  await act(async () => root.render(React.createElement(MemoryRouter, null, React.createElement(TaskNotifications, { userId: 1, suppressPrompts: false }))));
  assert.ok(document.querySelector('[aria-label="Novas tarefas recebidas"]')?.textContent.includes('Solicitar engenharia'), 'Aviso pendente de tarefas aparece após as novidades');
  assert.equal(document.querySelector('button[aria-controls="task-notifications"]').disabled, false);

  taskToasts.length = 0;
  await mount(React.createElement(MemoryRouter, null, React.createElement(TaskNotifications, { userId: 1, suppressPrompts: false })));
  assert.equal(taskToasts.length, 0, 'Carga inicial estabelece a referência das notificações');
  taskItems = [{ ...taskNotification, id: 2, task: { ...taskNotification.task, title: 'Nova engenharia recebida' } }, taskNotification];
  await act(async () => root.render(React.createElement(MemoryRouter, null, React.createElement(TaskNotifications, { userId: 1, suppressPrompts: true }))));
  assert.equal(taskToasts.length, 0, 'Notificação recebida durante o popup aguarda o fechamento');
  await act(async () => root.render(React.createElement(MemoryRouter, null, React.createElement(TaskNotifications, { userId: 1, suppressPrompts: false }))));
  assert.equal(taskToasts.length, 1, 'Liberar o popup apresenta a notificação que chegou durante a supressão');
  assert.ok(taskToasts[0].options.description.includes('Nova engenharia recebida'));

  console.log('Novidades validadas: popup genérico, confirmação por usuário, falhas e retry, concorrência de cliques, troca de sessão, sincronização de IDs, acessibilidade e prioridade sobre os avisos de tarefas.');
} finally {
  if (root) await act(async () => root.unmount());
  await unlink(bundlePath).catch(() => {});
  dom.window.close();
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}
