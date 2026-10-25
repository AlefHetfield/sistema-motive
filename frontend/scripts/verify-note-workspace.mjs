import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:5173/notes', pretendToBeVisual: true });
const descriptors = new Map();
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement, Event: dom.window.Event, CustomEvent: dom.window.CustomEvent,
  localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage,
  requestAnimationFrame: callback => setTimeout(callback, 0), cancelAnimationFrame: clearTimeout, IS_REACT_ACT_ENVIRONMENT: true })) {
  descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
const originalFetch = globalThis.fetch;
const bundlePath = fileURLToPath(new URL(`.verify-workspace-${randomUUID()}.mjs`, import.meta.url));
const output = await build({
  entryPoints: [fileURLToPath(new URL('../src/pages/Notes.jsx', import.meta.url))], bundle: true, write: false,
  platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', loader: { '.css': 'empty' },
  define: { 'import.meta.env.PROD': 'false', 'import.meta.env.VITE_API_URL': '"http://localhost:3000"' },
  plugins: [{ name: 'workspace-fixtures', setup(builder) {
    builder.onResolve({ filter: /\/AuthContext$/ }, () => ({ path: 'auth', namespace: 'fixture' }));
    builder.onResolve({ filter: /\/NoteRichText$/ }, () => ({ path: 'rich-text', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ resolveDir: fileURLToPath(new URL('../', import.meta.url)), contents: path === 'auth'
      ? 'export const useAuth = () => ({ user: { id: 1, role: "ADM" } });'
      : 'import React from "react"; export default function RichText({value,onChange,disabled,label="Conteúdo da nota"}) { return React.createElement("textarea", {"aria-label":label,value,disabled,onChange:event=>onChange(event.target.value)}); }' }));
  } }],
});
await writeFile(bundlePath, output.outputFiles[0].text);
const { default: Notes } = await import(pathToFileURL(bundlePath).href);
const { createRoot } = await import('react-dom/client');
const { createMemoryRouter, RouterProvider } = await import('react-router-dom');
const mounted = new Set();
const nextTurn = () => new Promise(resolve => setTimeout(resolve, 0));
const note = (fields = {}) => ({ id: 1, ownerId: 1, title: 'Nota original', content: 'Texto confirmado', items: [], kind: 'TEXT', version: 1,
  role: 'OWNER', owner: { id: 1, nome: 'Dono' }, access: [], labels: [], state: { color: 'default', isPinned: false, version: 1 }, updatedAt: '2026-10-25T10:00:00Z', ...fields });
const finish = async (call, payload, status = 200) => {
  assert.ok(call, 'Requisição esperada não foi enviada.');
  await act(async () => { call.resolve(new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })); await nextTurn(); });
};
const mount = async (initial = [note()], extra = {}) => {
  const calls = [];
  globalThis.fetch = (url, options = {}) => new Promise(resolve => calls.push({ url: String(url), method: options.method || 'GET', body: options.body && JSON.parse(options.body), signal: options.signal, resolve }));
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  const router = createMemoryRouter([{ path: '/notes', element: React.createElement(Notes) }], { initialEntries: ['/notes'] });
  await act(async () => { root.render(React.createElement(RouterProvider, { router })); });
  await finish(calls.find(call => call.url.endsWith('/note-labels')), []);
  await finish(calls.find(call => call.url.includes('/notes?')), { notes: initial, total: initial.length, page: 1, pageSize: 40, ...extra });
  const harness = {
    calls, container,
    listCalls: () => calls.filter(call => call.url.includes('/notes?')),
    button(label) {
      const found = [...document.querySelectorAll('button')].filter(button => button.getAttribute('aria-label') === label || button.textContent.trim() === label);
      assert.equal(found.length, 1, `Botão único esperado: ${label}`); return found[0];
    },
    async click(label) { await act(async () => { harness.button(label).click(); await nextTurn(); }); },
    async title(value) {
      const input = document.querySelector('input[aria-label="Título da nota, opcional"]');
      assert.ok(input);
      await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); await nextTurn(); });
    },
    async unmount() { await act(async () => { root.unmount(); }); router.dispose(); container.remove(); mounted.delete(harness); },
  };
  mounted.add(harness); return harness;
};
afterEach(async () => {
  for (const harness of [...mounted]) await harness.unmount();
  sessionStorage.clear(); localStorage.clear(); globalThis.fetch = originalFetch;
});
after(async () => {
  await unlink(bundlePath).catch(() => {}); dom.window.close();
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
});

test('abre do cache antes do GET e aplica fixação sem consulta extra ou regressão pelo GET antigo', async () => {
  const app = await mount();
  await app.click('Abrir nota: Nota original');
  assert.equal(document.querySelector('input[aria-label="Título da nota, opcional"]').value, 'Nota original');
  const read = app.calls.find(call => call.url.endsWith('/notes/1'));
  assert.ok(read, 'A abertura deve revalidar em segundo plano.');
  const pin = [...document.querySelectorAll('[role="dialog"] button')].find(button => button.getAttribute('aria-label') === 'Fixar nota');
  await act(async () => { pin.click(); await nextTurn(); });
  const patch = app.calls.find(call => call.method === 'PATCH');
  await finish(patch, note({ state: { version: 2, color: 'blue', isPinned: true } }));
  assert.ok(document.querySelector('[role="dialog"] button[aria-label="Desafixar nota"]'));
  assert.equal(app.calls.filter(call => call.method === 'GET' && call.url.endsWith('/notes/1')).length, 1);
  await finish(read, note());
  assert.ok(document.querySelector('[role="dialog"] button[aria-label="Desafixar nota"]'));
  await app.click('Concluir');
  assert.equal(app.listCalls().length, 1, 'Fechar uma nota limpa não precisa recarregar a lista.');
});

test('criação confirmada aparece como cartão sem GET e mantém uma única contagem', async () => {
  const app = await mount([]);
  await app.click('Criar uma nota…'); await app.title('Nota recém-criada'); await app.click('Concluir');
  const post = app.calls.find(call => call.method === 'POST');
  assert.equal(post.body.title, 'Nota recém-criada');
  await finish(post, note({ id: 2, title: 'Nota recém-criada', content: '' }), 201);
  assert.ok(app.button('Abrir nota: Nota recém-criada'));
  assert.match(app.container.textContent, /1 nota/);
  assert.equal(app.listCalls().length, 1);
  assert.equal(document.querySelector('[role="dialog"]'), null);
});

test('envio à lixeira remove o cartão com o POST e dispensa recarregamento da lista', async () => {
  const app = await mount();
  await app.click('Mover nota para a lixeira'); await app.click('Mover para a lixeira');
  await finish(app.calls.find(call => call.method === 'POST'), note({ version: 2, deletedAt: '2026-10-25T11:00:00Z' }));
  assert.equal(app.container.querySelector('button[aria-label="Abrir nota: Nota original"]'), null);
  assert.match(app.container.textContent, /0 notas/);
  assert.equal(app.listCalls().length, 1);
});

test('Concluir permanece disponível no autosave e só bloqueia durante o fechamento solicitado', async () => {
  const app = await mount([]);
  await app.click('Criar uma nota…'); await app.title('Criação em andamento');
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 760)); });
  const post = app.calls.find(call => call.method === 'POST');
  assert.ok(post);
  assert.equal(app.button('Concluir').disabled, false);
  await app.click('Concluir');
  assert.equal(app.button('Concluindo…').disabled, true);
  assert.equal(document.querySelector('input[aria-label="Título da nota, opcional"]').disabled, true);
  await finish(post, note({ title: 'Criação em andamento', content: '' }), 201);
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.ok(app.button('Abrir nota: Criação em andamento'));
  assert.equal(app.calls.filter(call => call.method === 'POST').length, 1);
});

test('lista iniciada antes da exclusão não ressuscita cartão; reconciliação da corrida ocorre uma vez', async () => {
  const app = await mount();
  await act(async () => { window.dispatchEvent(new window.Event('focus')); await nextTurn(); });
  const oldRead = app.listCalls()[1];
  assert.ok(oldRead);
  await app.click('Mover nota para a lixeira'); await app.click('Mover para a lixeira');
  await finish(app.calls.find(call => call.method === 'POST'), note({ version: 2, deletedAt: 'agora' }));
  assert.equal(oldRead.signal.aborted, true);
  await finish(oldRead, { notes: [note()], total: 1, page: 1, pageSize: 40 });
  assert.equal(app.container.querySelector('button[aria-label="Abrir nota: Nota original"]'), null);
  assert.equal(app.listCalls().length, 3);
  await finish(app.listCalls()[2], { notes: [], total: 0, page: 1, pageSize: 40 });
  assert.match(app.container.textContent, /0 notas/);
});

test('excluir o último cartão da segunda página retorna à primeira e atualiza a paginação', async () => {
  const first = note(), second = note({ id: 2, title: 'Segunda' }), third = note({ id: 3, title: 'Terceira' });
  const app = await mount([first, second], { total: 3, pageSize: 2 });
  await app.click('Próxima página');
  await finish(app.listCalls()[1], { notes: [third], total: 3, page: 2, pageSize: 2 });
  await app.click('Mover nota para a lixeira'); await app.click('Mover para a lixeira');
  await finish(app.calls.find(call => call.method === 'POST'), { ...third, version: 2, deletedAt: 'agora' });
  assert.match(app.listCalls()[2].url, /page=1/);
  await finish(app.listCalls()[2], { notes: [first, second], total: 2, page: 1, pageSize: 2 });
  assert.ok(app.button('Abrir nota: Nota original'));
  assert.match(app.container.textContent, /2 notas/);
  assert.equal(app.container.querySelector('button[aria-label="Próxima página"]'), null);
});

test('fixação atualiza imediatamente e reconcilia a posição global quando há outras páginas', async () => {
  const app = await mount([note()], { total: 2, pageSize: 1 });
  await app.click('Fixar nota');
  const updated = note({ state: { version: 2, isPinned: true, color: 'default' } });
  await finish(app.calls.find(call => call.method === 'PATCH'), updated);
  assert.ok(app.button('Desafixar nota'), 'A organização muda antes de a listagem terminar.');
  assert.equal(app.listCalls().length, 2);
  await finish(app.listCalls()[1], { notes: [updated], total: 2, page: 1, pageSize: 1 });
  assert.equal(app.listCalls().length, 2, 'A conciliação paginada deve terminar sem loop.');
});
