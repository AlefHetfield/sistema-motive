import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:5173/notes' });
const descriptors = new Map();
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  Event: dom.window.Event, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
  descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
const originalFetch = globalThis.fetch;
const bundlePath = fileURLToPath(new URL(`.verify-auth-${randomUUID()}.mjs`, import.meta.url));
const output = await build({ stdin: { contents: 'export { AuthProvider } from "./src/context/AuthContext.jsx"; export { default as PrivateRoute } from "./src/components/PrivateRoute.jsx";', resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' },
  bundle: true, write: false, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic',
  define: { 'import.meta.env.PROD': 'false', 'import.meta.env.VITE_API_URL': '"http://localhost:3000"' } });
await writeFile(bundlePath, output.outputFiles[0].text);
const { AuthProvider, PrivateRoute } = await import(pathToFileURL(bundlePath).href);
const { createRoot } = await import('react-dom/client');
const { createMemoryRouter, RouterProvider } = await import('react-router-dom');
let active;
const nextTurn = () => new Promise(resolve => setTimeout(resolve, 0));
const mount = async () => {
  const calls = [];
  globalThis.fetch = (url, options) => new Promise((resolve, reject) => calls.push({ url, options, resolve, reject }));
  const container = document.createElement('div'); document.body.append(container);
  const router = createMemoryRouter([
    { path: '/notes', element: React.createElement(PrivateRoute, null, React.createElement('p', null, 'Conteúdo protegido')) },
    { path: '/login', element: React.createElement('p', null, 'Tela de login') },
  ], { initialEntries: ['/notes'] });
  const root = createRoot(container);
  await act(async () => { root.render(React.createElement(AuthProvider, null, React.createElement(RouterProvider, { router }))); });
  active = { calls, container, router, root }; return active;
};
const finish = async (call, payload, status = 200) => { await act(async () => { call.resolve(new Response(JSON.stringify(payload), { status })); await nextTurn(); }); };
afterEach(async () => {
  if (active) { await act(async () => { active.root.unmount(); }); active.router.dispose(); active.container.remove(); active = null; }
  localStorage.clear(); sessionStorage.clear(); globalThis.fetch = originalFetch;
});
after(async () => {
  await unlink(bundlePath).catch(() => {}); dom.window.close();
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
});

test('timeout de sessão oferece retry sem liberar conteúdo nem perder o endereço solicitado', async () => {
  const app = await mount();
  assert.ok(app.calls[0].options.signal);
  await act(async () => { app.calls[0].reject(new DOMException('timeout', 'TimeoutError')); await nextTurn(); });
  assert.match(app.container.textContent, /demorou demais/);
  assert.doesNotMatch(app.container.textContent, /Conteúdo protegido/);
  assert.equal(app.router.state.location.pathname, '/notes');
  await act(async () => { [...app.container.querySelectorAll('button')].find(button => button.textContent === 'Tentar novamente').click(); await nextTurn(); });
  assert.match(app.container.textContent, /Verificando permissões/);
  await finish(app.calls[1], { id: 1, nome: 'Teste', role: 'ADM' });
  assert.match(app.container.textContent, /Conteúdo protegido/);
  assert.equal(app.router.state.location.pathname, '/notes');
});

test('503 de autenticação exibe falha recuperável em vez de tratar como sessão expirada', async () => {
  const app = await mount(); await finish(app.calls[0], { error: 'Indisponível' }, 503);
  assert.match(app.container.textContent, /Não foi possível verificar sua sessão/);
  assert.equal(app.router.state.location.pathname, '/notes');
  assert.doesNotMatch(app.container.textContent, /Conteúdo protegido/);
});

test('401 continua redirecionando ao login sem liberar conteúdo protegido', async () => {
  const app = await mount(); await finish(app.calls[0], { error: 'Não autenticado' }, 401);
  assert.equal(app.router.state.location.pathname, '/login');
  assert.match(app.container.textContent, /Tela de login/);
  assert.doesNotMatch(app.container.textContent, /Conteúdo protegido/);
});
