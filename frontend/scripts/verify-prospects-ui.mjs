import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

const dom = new JSDOM('<!doctype html><body><div id="root"></div>', { url: 'http://fixture.invalid/properties-map?tab=captacao' });
const savedGlobals = new Map();
const scenario = { requests: [], saved: [], closed: 0, lookup: null, defer: null, postalDefer: null, isFavorite: false, failPhoto: false, saveError: null, deleteError: null, deleteDefer: null, deleted: false, user: { id: 1, role: 'ADM' } };
const candidate = { id: 1, registration: '12345', street: 'Rua Jatobá', number: '120', city: 'Sumaré', neighborhood: 'Jardim Teste', lot: '4', block: '11', fiscal: '123' };
const unique = () => ({ results: [candidate], total: 1, page: 1, pages: 1, automatic: '12345' });
const base = { id: 15, version: 2, createdById: 2, createdByName: 'Corretor QA', createdAt: '2026-11-24T12:00:00Z', street: 'Rua Jatobá', number: '120', city: 'Sumaré', state: 'SP', stage: 'SEARCHING', ownerName: '', ownerPhone: '', notes: '', registration: '', hasPhoto: true, photoUpdatedAt: '2026-11-24T12:00:00Z' };
for (const [name, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true, __prospectScenario: scenario, fetch: async (url, options = {}) => {
  const target = new URL(url); assert.equal(target.hostname, 'fixture.invalid', 'Nunca acessar serviços reais.');
  if (options.signal?.aborted) throw Object.assign(new Error('Cancelado'), { name: 'AbortError' });
  const body = options.body ? JSON.parse(options.body) : null;
  scenario.requests.push({ path: target.pathname, body, method: options.method || 'GET' });
  const json = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
  if (target.pathname.endsWith('/metadata')) return json({ streets: [], cities: [{ value: 'sumare', label: 'Sumaré' }] });
  if (target.pathname.endsWith('/lookup-registration')) { if (scenario.defer) await scenario.defer; return json(scenario.lookup || unique()); }
  if (target.pathname.endsWith('/lookup-postal-code')) {
    if (scenario.postalDefer) await scenario.postalDefer;
    return json({ postalCode: '13170123', status: 'found' });
  }
  if (target.pathname.endsWith('/favorite')) {
    scenario.isFavorite = body.isFavorite;
    return json({ id: base.id, isFavorite: scenario.isFavorite });
  }
  if (options.method === 'DELETE') {
    if (scenario.deleteDefer) await scenario.deleteDefer;
    if (scenario.deleteError) return json({ error: scenario.deleteError }, 409);
    scenario.deleted = true;
    return { ok: true, status: 204, json: async () => { throw new Error('Resposta 204 não tem JSON.'); } };
  }
  if (options.method === 'PATCH' || options.method === 'POST') {
    if (scenario.saveError) return json({ error: scenario.saveError }, 409);
    return json({ ...base, ...body, version: 3 });
  }
  const items = scenario.deleted || (target.searchParams.has('favorites') && !scenario.isFavorite)
    ? [] : [{ ...base, isFavorite: scenario.isFavorite }];
  return json({ items, total: items.length, page: 1, pageSize: 24, cities: ['Sumaré'], summary: { SEARCHING: scenario.deleted ? 0 : 1 } });
} })) {
  savedGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}
const frontend = fileURLToPath(new URL('../', import.meta.url));
const bundle = fileURLToPath(new URL(`../.verify-prospects-${randomUUID()}.mjs`, import.meta.url));
let root;
try {
  const output = await build({ absWorkingDir: frontend, bundle: true, write: false, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic',
    stdin: { resolveDir: frontend, loader: 'jsx', contents: "export { default as Modal } from './src/components/prospects/ProspectModal.jsx'; export { default as Page } from './src/pages/PropertyProspects.jsx';" },
    plugins: [{ name: 'prospect-fixtures', setup(builder) {
      builder.onResolve({ filter: /\/config\/api$/ }, () => ({ path: 'config', namespace: 'fixture' }));
      builder.onResolve({ filter: /\/utils\/prospectPhoto$/ }, () => ({ path: 'photo', namespace: 'fixture' }));
      builder.onResolve({ filter: /\/context\/AuthContext$/ }, () => ({ path: 'auth', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents: args.path === 'config' ? "export const API_BASE_URL='http://fixture.invalid';" : args.path === 'auth' ? 'export const useAuth=()=>({user:globalThis.__prospectScenario.user});' : `export async function compressProspectPhoto() { if(globalThis.__prospectScenario.failPhoto) throw new Error('Foto inválida'); return {dataUrl:'data:image/jpeg;base64,QUJDRA==',bytes:4}; }` }));
    } }],
  });
  await writeFile(bundle, output.outputFiles[0].text);
  const { Modal, Page } = await import(pathToFileURL(bundle).href);
  const { createRoot } = await import('react-dom/client');
  const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
  const button = text => [...document.querySelectorAll('button')].find(el => el.textContent.trim() === text);
  const input = name => document.querySelector(`[id$="-${name}"]`);
  const fill = async (name, value) => {
    const el = input(name); assert.ok(el, name);
    await act(async () => {
      const proto = el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
      el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  };
  const click = async target => { assert.ok(target, 'Controle esperado existe.'); await act(async () => { target.focus(); target.click(); }); await flush(); };
  const submit = async () => { await act(async () => document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))); await flush(); };
  const mount = async (item = base) => {
    if (root) await act(async () => root.unmount());
    Object.assign(scenario, { requests: [], saved: [], closed: 0, lookup: null, defer: null, postalDefer: null, failPhoto: false, saveError: null });
    root = createRoot(document.getElementById('root'));
    await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(Modal, { item, onClose: () => { scenario.closed++; }, onSaved: item => scenario.saved.push(item) }))));
    await flush();
  };

  await mount();
  assert.equal(input('registration').readOnly, false, 'Matrícula sempre permite preenchimento manual.');
  assert.equal(input('state').value, 'SP');
  assert.equal(input('state').readOnly, true);
  await click(button('Buscar pelo endereço'));
  assert.equal(input('registration').value, '12345', 'Resultado único e exato preenche automaticamente.');
  assert.deepEqual(scenario.requests.find(request => request.path.endsWith('/lookup-registration')).body,
    { street: base.street, number: base.number, city: base.city, complement: '', state: 'SP', page: 1 });
  await fill('number', '121');
  assert.equal(input('registration').value, '', 'Mudar endereço invalida a matrícula preenchida automaticamente, inclusive em StrictMode.');
  await fill('registration', '99999');
  await fill('number', '120');
  assert.equal(input('registration').value, '99999', 'Matrícula digitada manualmente é preservada.');
  await click(button('Buscar pelo endereço'));
  assert.equal(input('registration').value, '99999', 'Buscar não sobrescreve a matrícula manual.');
  await click(button('Usar matrícula'));
  assert.equal(input('registration').value, '12345');
  await submit();
  const patch = scenario.requests.find(request => request.method === 'PATCH');
  assert.equal(patch.body.version, 2); assert.equal(patch.body.registration, '12345');
  assert.equal(Object.hasOwn(patch.body, 'photoDataUrl'), false, 'Editar os dados não reenvia a foto existente.');

  await mount();
  scenario.lookup = { ...unique(), total: 2, automatic: null, results: [candidate, { ...candidate, id: 2, registration: '67890', lot: '5' }] };
  await click(button('Buscar pelo endereço'));
  assert.equal(input('registration').value, '');
  assert.match(document.body.textContent, /mais de um registro/);
  assert.equal([...document.querySelectorAll('button')].filter(el => el.textContent.trim() === 'Usar matrícula').length, 2);

  await mount();
  scenario.lookup = { results: [], total: 0, page: 1, pages: 0, automatic: null };
  await click(button('Buscar pelo endereço'));
  assert.match(document.body.textContent, /Nenhum registro encontrado/);
  await fill('registration', '777');
  await submit(); assert.equal(scenario.saved.at(-1).registration, '777');

  await mount();
  let release;
  scenario.defer = new Promise(resolve => { release = resolve; });
  await act(async () => button('Buscar pelo endereço').click());
  await fill('street', 'Rua Nova');
  await act(async () => release()); await flush();
  assert.equal(input('registration').value, '', 'Resposta antiga não preenche matrícula de outro endereço.');

  await mount(null);
  await fill('street', 'Rua Jatobá');
  await fill('number', '120');
  assert.equal(button('Buscar pelo endereço').disabled, true, 'A busca usa a cidade do formulário.');
  await fill('city', 'Sumaré');
  await act(async () => new Promise(resolve => setTimeout(resolve, 700)));
  assert.equal(input('postalCode').value, '13170-123');
  assert.equal(scenario.requests.filter(request => request.path.endsWith('/lookup-postal-code')).length, 1, 'A digitação não dispara consultas antes de completar o endereço.');
  await submit();
  assert.equal(scenario.saved.at(-1).postalCode, '13170-123');
  await fill('number', '121');
  assert.equal(input('postalCode').value, '', 'Trocar o número apaga o CEP do endereço anterior.');
  let releasePostal;
  scenario.postalDefer = new Promise(resolve => { releasePostal = resolve; });
  await act(async () => new Promise(resolve => setTimeout(resolve, 700)));
  await fill('postalCode', '13170000');
  await act(async () => releasePostal());
  assert.equal(input('postalCode').value, '13170-000', 'O retorno da busca preserva o CEP digitado.');

  await mount();
  await fill('notes', 'Observação que deve continuar no formulário');
  scenario.failPhoto = true;
  const photoInput = document.querySelector('input[type="file"]');
  Object.defineProperty(photoInput, 'files', { configurable: true, value: [new dom.window.File(['teste'], 'teste.jpg', { type: 'image/jpeg' })] });
  await act(async () => photoInput.dispatchEvent(new dom.window.Event('change', { bubbles: true }))); await flush();
  assert.match(document.body.textContent, /Foto inválida/);
  assert.equal(input('notes').value, 'Observação que deve continuar no formulário');
  scenario.failPhoto = false;
  await act(async () => photoInput.dispatchEvent(new dom.window.Event('change', { bubbles: true }))); await flush();
  await submit();
  assert.equal(scenario.requests.find(request => request.method === 'PATCH').body.photoDataUrl, 'data:image/jpeg;base64,QUJDRA==', 'Só a imagem reduzida entra no payload.');

  await mount();
  await fill('ownerName', 'Contato localizado');
  scenario.saveError = 'Atualizada por outra pessoa';
  await submit();
  assert.equal(scenario.saved.length, 0); assert.match(document.body.textContent, /Atualizada por outra pessoa/);
  assert.equal(input('ownerName').value, 'Contato localizado');
  await click(button('Cancelar'));
  assert.ok(document.querySelector('[role="alertdialog"]'), 'Fechar um rascunho pede confirmação.');
  await click(button('Continuar preenchendo'));
  assert.equal(scenario.closed, 0);

  if (root) await act(async () => root.unmount());
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(Page))); await flush();
  assert.match(document.querySelector('article').textContent, /Rua Jatobá/);
  assert.match(document.querySelector('article').textContent, /Proprietário a localizar/);
  const star = () => document.querySelector('button[aria-label="Favorito: Rua Jatobá, 120"]');
  await click(star());
  assert.equal(star().getAttribute('aria-pressed'), 'true');
  await click(button('Favoritas'));
  assert.ok(star());
  await click(star());
  assert.match(document.body.textContent, /Nenhuma favorita nesta seleção/);
  await click(button('Favoritas'));
  assert.equal(star().getAttribute('aria-pressed'), 'false');
  const trash = () => document.querySelector('button[aria-label="Excluir captação Rua Jatobá, 120"]');
  await click(trash());
  assert.ok(document.querySelector('[role="alertdialog"]'));
  assert.match(document.body.textContent, /permanentemente/);
  assert.match(document.activeElement.textContent, /Cancelar/, 'A confirmação começa com foco na ação segura.');
  await click(button('Cancelar'));
  assert.equal(scenario.requests.filter(request => request.method === 'DELETE').length, 0, 'Cancelar não exclui.');
  assert.ok(document.activeElement === trash(), 'Fechar a confirmação devolve o foco à lixeira.');
  await click(trash());
  scenario.deleteError = 'Atualizada por outra pessoa. Atualize a lista.';
  await click(button('Excluir captação'));
  assert.match(document.querySelector('[role="alert"]').textContent, /Atualizada por outra pessoa/);
  assert.ok(document.querySelector('[role="alertdialog"]'), 'Falha mantém a confirmação e o cadastro.');
  assert.ok(document.querySelector('article'));
  await click(button('Cancelar'));
  scenario.deleteError = null;
  scenario.user = { id: 3, role: 'CORRETOR' };
  await act(async () => root.render(React.createElement(Page))); await flush();
  assert.ok(!trash(), 'Corretor não vê exclusão de cadastros de outros.');
  scenario.user = { id: 2, role: 'CORRETOR' };
  await act(async () => root.render(React.createElement(Page))); await flush();
  assert.ok(trash(), 'Corretor vê exclusão dos próprios cadastros.');
  await click(button('Registrar contato'));
  assert.ok(document.querySelector('[role="dialog"]'));
  assert.ok(document.activeElement.id.endsWith('-ownerName'), 'Registrar contato abre diretamente o campo do proprietário.');
  await click(button('Cancelar'));
  await click(trash());
  let releaseDelete;
  scenario.deleteDefer = new Promise(resolve => { releaseDelete = resolve; });
  await act(async () => button('Excluir captação').click());
  assert.equal(button('Excluindo…').disabled, true);
  assert.equal(button('Cancelar').disabled, true, 'Aguarda a exclusão terminar antes de fechar.');
  await act(async () => document.querySelector('[role="alertdialog"]').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  assert.ok(document.querySelector('[role="alertdialog"]'));
  await act(async () => releaseDelete()); await flush();
  const removal = scenario.requests.filter(request => request.method === 'DELETE');
  assert.equal(removal.length, 2, 'Uma tentativa recusada e uma exclusão confirmada, sem duplicação.');
  assert.deepEqual(removal.at(-1).body, { version: 2 });
  assert.equal(removal.at(-1).path, '/api/property-prospects/15');
  assert.ok(!document.querySelector('[role="alertdialog"]'), 'Exclusão confirmada fecha a janela.');
  assert.ok(!document.querySelector('article'), 'A lista atualiza depois da exclusão.');
  assert.match(document.body.textContent, /sua próxima captação/);
  console.log('Captação validada: CEP automático e manual, UF fixa, matrícula pelo endereço, favoritos, foto, rascunho e exclusão.');
} finally {
  if (root) await act(async () => root.unmount());
  await unlink(bundle).catch(() => {}); dom.window.close();
  for (const [name, descriptor] of savedGlobals) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
}
