import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act, useEffect, useState } from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:5173/notes' });
const globals = new Map();
for (const [key, value] of Object.entries({
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement, Event: dom.window.Event, CustomEvent: dom.window.CustomEvent,
  sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true,
})) {
  globals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
const originalFetch = globalThis.fetch;
const bundlePath = fileURLToPath(new URL(`.verify-autosave-${randomUUID()}.mjs`, import.meta.url));
const mounted = new Set();
after(async () => {
  globalThis.fetch = originalFetch;
  await unlink(bundlePath).catch(() => {});
  dom.window.close();
  for (const [key, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
});

// Bundle the real hook and HTTP client exactly once. React/router stay external
// so the harness and hook share the same React dispatcher and router context.
const output = await build({
  entryPoints: [fileURLToPath(new URL('../src/hooks/useNoteAutosave.js', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'esm', packages: 'external',
  define: { 'import.meta.env.PROD': 'false', 'import.meta.env.VITE_API_URL': '"http://localhost:3000"' },
});
await writeFile(bundlePath, output.outputFiles[0].text);
const { default: useNoteAutosave } = await import(pathToFileURL(bundlePath).href);
const { createRoot } = await import('react-dom/client');
const { createMemoryRouter, RouterProvider } = await import('react-router-dom');

const draftKey = (noteId = 100) => `motive.note-draft.v1.1.${noteId || 'new-TEXT'}`;
const readStored = (noteId = 100) => JSON.parse(sessionStorage.getItem(draftKey(noteId)) || 'null');
const note = (fields = {}) => ({
  id: 100, ownerId: 1, title: 'Reunião', content: 'Conteúdo confirmado', kind: 'TEXT', items: [],
  version: 1, deletedAt: null, owner: { id: 1, nome: 'Dono' }, role: 'OWNER', access: [], labels: [],
  state: { color: 'default', isPinned: false, archivedAt: null, hiddenAt: null, version: 1 }, ...fields,
});
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const nextTurn = () => new Promise(resolve => setTimeout(resolve, 0));
const waitPastAutosave = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 760)); }); };
const fakeHttp = () => {
  const calls = [];
  globalThis.fetch = (url, options = {}) => {
    let resolve;
    let reject;
    const promise = new Promise((success, failure) => { resolve = success; reject = failure; });
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null, resolve, reject });
    return promise;
  };
  return calls;
};
const finish = async (call, payload, status = 200) => {
  assert.ok(call, 'A requisição esperada não foi enviada.');
  await act(async () => { call.resolve(response(payload, status)); await nextTurn(); });
};
const mount = async (initialNote = note(), extra = {}) => {
  const container = document.createElement('div');
  document.body.append(container);
  let current;
  const saved = [];
  function Probe() {
    current = useNoteAutosave({ initialNote, kind: initialNote?.kind || 'TEXT', userId: 1, onSaved: value => saved.push(value) });
    return React.createElement('div', { 'data-status': current.status }, current.form.content);
  }
  function Host() {
    const [active, setActive] = useState(true);
    useEffect(() => {
      if (!extra.teardownOnUnauthorized) return undefined;
      const teardown = () => { extra.onUnauthorized?.(); setActive(false); };
      window.addEventListener('motive:unauthorized', teardown);
      return () => window.removeEventListener('motive:unauthorized', teardown);
    }, []);
    return active ? React.createElement(Probe) : null;
  }
  const router = createMemoryRouter([
    { path: '/', element: React.createElement(Host) },
    { path: '/away', element: React.createElement('div', null, 'Outra página') },
  ], { initialEntries: ['/'] });
  const root = createRoot(container);
  await act(async () => { root.render(React.createElement(RouterProvider, { router })); });
  const harness = {
    get current() { return current; }, saved, container, router,
    async edit(field, value) { await act(async () => { current.setField(field, value); }); },
    async start(method) {
      let promise;
      await act(async () => { promise = current[method](); });
      return { promise };
    },
    async call(method) {
      let value;
      await act(async () => { value = await current[method](); });
      return value;
    },
    async unmount() {
      if (!mounted.has(harness)) return;
      await act(async () => { root.unmount(); });
      router.dispose(); container.remove(); mounted.delete(harness);
    },
  };
  mounted.add(harness);
  return harness;
};
afterEach(async () => {
  for (const harness of [...mounted]) await harness.unmount();
  sessionStorage.clear();
  globalThis.fetch = originalFetch;
});

test('autosave serializa respostas atrasadas e salva a digitação nova com a versão confirmada', async () => {
  const calls = fakeHttp();
  const editor = await mount();
  await editor.edit('content', 'Primeira fotografia');
  const work = await editor.start('flush');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'PATCH');
  assert.equal(calls[0].body.version, 1);
  await editor.edit('content', 'Texto novo digitado enquanto a primeira resposta demora');
  assert.equal(readStored().form.content, editor.current.form.content);
  await finish(calls[0], note({ content: 'Primeira fotografia', version: 2 }));
  assert.equal(calls.length, 2);
  assert.equal(calls[1].body.version, 2);
  assert.equal(calls[1].body.content, 'Texto novo digitado enquanto a primeira resposta demora');
  assert.equal(editor.current.form.content, calls[1].body.content);
  assert.equal(editor.current.saving, true);
  assert.equal(editor.current.dirty, true);
  await finish(calls[1], note({ content: calls[1].body.content, version: 3 }));
  await work.promise;
  assert.equal(editor.current.note.version, 3);
  assert.equal(editor.current.dirty, false);
  assert.equal(editor.current.saving, false);
  assert.equal(editor.current.status, 'saved');
  assert.equal(readStored(), null);
});

test('resposta da organização atualiza o editor sem GET e invalida polling antigo', async () => {
  const calls = fakeHttp();
  const editor = await mount();
  const read = await editor.start('checkRemote');
  const organized = note({ state: { color: 'blue', isPinned: true, version: 2 } });
  await act(async () => { editor.current.acceptMutation(organized); });
  assert.equal(editor.current.note.state.isPinned, true);
  assert.equal(calls.length, 1, 'Adotar o PATCH não deve disparar outro GET.');
  await finish(calls[0], note());
  await read.promise;
  assert.equal(editor.current.note.state.color, 'blue');
  assert.equal(editor.current.note.state.version, 2);
});

test('criação em segundo plano agrupa texto digitado durante o POST em uma próxima pausa', async () => {
  const calls = fakeHttp();
  const editor = await mount(null);
  await editor.edit('title', 'Nota nova');
  await waitPastAutosave();
  assert.equal(calls.length, 1); assert.equal(calls[0].method, 'POST');
  await editor.edit('content', 'Primeira parte');
  await editor.edit('content', 'Texto completo digitado durante a criação');
  await finish(calls[0], note({ title: 'Nota nova', content: '' }));
  assert.equal(calls.length, 1, 'Não deve emendar um PATCH enquanto a pessoa ainda escreve.');
  assert.equal(editor.current.saving, false);
  assert.equal(editor.current.dirty, true);
  assert.equal(readStored().form.content, 'Texto completo digitado durante a criação');
  await editor.edit('content', 'Versão final agrupada');
  await waitPastAutosave();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].body.content, 'Versão final agrupada');
  await finish(calls[1], note({ title: 'Nota nova', content: 'Versão final agrupada', version: 2 }));
  assert.equal(editor.current.dirty, false);
});

test('Concluir durante criação em segundo plano aguarda POST e salva a última digitação antes de sair', async () => {
  const calls = fakeHttp();
  const editor = await mount(null);
  await editor.edit('title', 'Minha nota');
  await waitPastAutosave();
  await editor.edit('content', 'Último texto antes de concluir');
  const closing = await editor.start('flush');
  await finish(calls[0], note({ title: 'Minha nota', content: '' }));
  assert.equal(calls.length, 2, 'Concluir deve salvar imediatamente, sem a pausa do autosave.');
  assert.equal(calls[1].body.content, 'Último texto antes de concluir');
  await finish(calls[1], note({ title: 'Minha nota', content: 'Último texto antes de concluir', version: 2 }));
  assert.equal((await closing.promise).version, 2);
  assert.equal(editor.current.dirty, false);
});

test('revalidações simultâneas compartilham uma consulta', async () => {
  const calls = fakeHttp();
  const editor = await mount();
  const first = await editor.start('checkRemote');
  const second = await editor.start('checkRemote');
  assert.equal(calls.length, 1);
  await finish(calls[0], note());
  await Promise.all([first.promise, second.promise]);
  await editor.start('checkRemote');
  assert.equal(calls.length, 2, 'Uma consulta terminada não deve impedir revalidações futuras.');
  await finish(calls[1], note());
});

test('resposta de compartilhamento preserva texto digitado e avança somente a base compatível', async () => {
  const calls = fakeHttp();
  const editor = await mount();
  await editor.edit('content', 'Texto local ainda pendente');
  await act(async () => { editor.current.acceptMutation(note({ version: 2 })); });
  assert.equal(editor.current.form.content, 'Texto local ainda pendente');
  assert.equal(editor.current.dirty, true);
  const work = await editor.start('flush');
  assert.equal(calls[0].body.version, 2);
  await finish(calls[0], note({ version: 3, content: 'Texto local ainda pendente' }));
  await work.promise;
  assert.equal(editor.current.dirty, false);
});

test('salvamento de conteúdo não regride uma organização confirmada durante a requisição', async () => {
  const calls = fakeHttp();
  const editor = await mount();
  await editor.edit('content', 'Texto em trânsito');
  const work = await editor.start('flush');
  await act(async () => { editor.current.acceptMutation(note({ state: { color: 'green', version: 2 } })); });
  assert.equal(editor.current.dirty, true);
  await finish(calls[0], note({ version: 2, content: 'Texto em trânsito' }));
  await work.promise;
  assert.equal(editor.current.form.content, 'Texto em trânsito');
  assert.equal(editor.current.note.state.color, 'green');
  assert.equal(editor.current.note.state.version, 2);
  assert.equal(editor.current.dirty, false);
});

test('revalidar acesso revogado preserva o rascunho e bloqueia gravações', async () => {
  const calls = fakeHttp();
  const editor = await mount();
  await editor.edit('content', 'Edição antes de descobrir a revogação');
  const read = await editor.start('checkRemote');
  await finish(calls[0], { error: 'Nota não encontrada.' }, 404);
  await read.promise;
  assert.equal(editor.current.accessLost, true);
  assert.equal(editor.current.canEdit, false);
  assert.equal(readStored().form.content, 'Edição antes de descobrir a revogação');
  assert.equal(await editor.call('flush'), false);
  assert.equal(calls.length, 1);
});

test('conflito409 mantém rascunho/base e bloqueia retry até carregar a versão atual conscientemente', async () => {
  const calls = fakeHttp();
  const editor = await mount();
  await editor.edit('content', 'Meu texto que não pode desaparecer');
  const work = await editor.start('flush');
  await finish(calls[0], { error: 'Outra pessoa salvou.', code: 'VERSION_CONFLICT' }, 409);
  assert.equal(calls[1].method, 'GET');
  await finish(calls[1], note({ content: 'Texto da outra pessoa', version: 2 }));
  assert.equal(await work.promise, false);
  assert.equal(editor.current.form.content, 'Meu texto que não pode desaparecer');
  assert.equal(editor.current.conflict.version, 2);
  assert.equal(editor.current.status, 'conflict');
  assert.equal(readStored().baseVersion, 1);
  assert.equal(await editor.call('retry'), false);
  await editor.edit('content', 'Meu rascunho continuou sendo digitado');
  await waitPastAutosave();
  assert.equal(calls.length, 2, 'Conflito não deve provocar gravação automática com uma versão trocada.');
  const reload = await editor.start('reload');
  assert.equal(calls[2].method, 'GET');
  await finish(calls[2], note({ content: 'Texto da outra pessoa', version: 2 }));
  await reload.promise;
  assert.equal(editor.current.form.content, 'Texto da outra pessoa');
  assert.equal(editor.current.conflict, null);
  assert.equal(editor.current.dirty, false);
  assert.equal(readStored(), null);
  await editor.edit('content', 'Reaplicação consciente após comparar');
  const secondSave = await editor.start('flush');
  assert.equal(calls[3].body.version, 2);
  await finish(calls[3], note({ content: calls[3].body.content, version: 3 }));
  await secondSave.promise;
  assert.equal(editor.current.dirty, false);
});

test('falha de rede preserva texto e não reenvia ao digitar; retry explícito usa a base original', async () => {
  const calls = fakeHttp();
  const editor = await mount();
  await editor.edit('content', 'Rascunho sem conexão');
  const work = await editor.start('flush');
  await act(async () => { calls[0].reject(new TypeError('Failed to fetch')); await nextTurn(); });
  assert.equal(await work.promise, false);
  assert.equal(editor.current.status, 'error');
  await editor.edit('content', 'Continuei escrevendo sem conexão');
  await waitPastAutosave();
  assert.equal(calls.length, 1);
  assert.equal(readStored().form.content, 'Continuei escrevendo sem conexão');
  const retry = await editor.start('retry');
  assert.equal(calls[1].body.version, 1);
  await finish(calls[1], note({ content: calls[1].body.content, version: 2 }));
  await retry.promise;
  assert.equal(editor.current.status, 'saved');
  assert.equal(editor.current.dirty, false);
});

test('401 preserva a última digitação antes de desmontar o editor e permite recuperar na mesma conta', async () => {
  const calls = fakeHttp();
  let atTeardown;
  const editor = await mount(note(), { teardownOnUnauthorized: true, onUnauthorized: () => { atTeardown = readStored(); } });
  await editor.edit('content', 'Fotografia enviada');
  const work = await editor.start('flush');
  await editor.edit('content', 'Texto mais recente antes de expirar a sessão');
  await finish(calls[0], { error: 'Entre novamente.', code: 'UNAUTHENTICATED' }, 401);
  assert.equal(await work.promise, false);
  assert.equal(editor.container.textContent, '');
  assert.equal(atTeardown.form.content, 'Texto mais recente antes de expirar a sessão');
  assert.equal(atTeardown.baseVersion, 1);
  assert.equal(readStored().form.content, atTeardown.form.content);
  await editor.unmount();
  const reopened = await mount(note());
  assert.equal(reopened.current.form.content, atTeardown.form.content);
  assert.equal(reopened.current.dirty, true);
  const resumed = await reopened.start('flush');
  assert.equal(calls[1].body.version, 1);
  await finish(calls[1], note({ content: calls[1].body.content, version: 2 }));
  await resumed.promise;
  assert.equal(readStored(), null);
  assert.equal(reopened.current.dirty, false);
});

test('polling iniciado limpo preserva o texto digitado enquanto GET estava pendente', async () => {
  const calls = fakeHttp();
  const editor = await mount();
  const poll = await editor.start('checkRemote');
  await editor.edit('content', 'Comecei a escrever depois da consulta');
  await finish(calls[0], note({ content: 'Uma atualização remota', version: 2 }));
  await poll.promise;
  assert.equal(editor.current.form.content, 'Comecei a escrever depois da consulta');
  assert.equal(editor.current.dirty, true);
  assert.equal(editor.current.status, 'conflict');
  assert.equal(editor.current.conflict.version, 2);
  assert.equal(readStored().baseVersion, 1);
  assert.equal(await editor.call('retry'), false);
  assert.equal(calls.length, 1);
});

test('GET antigo de polling não regride conteúdo já confirmado por PATCH mais recente', async () => {
  const calls = fakeHttp();
  const editor = await mount();
  const poll = await editor.start('checkRemote');
  await editor.edit('content', 'Minha gravação mais recente');
  const save = await editor.start('flush');
  await finish(calls[1], note({ content: 'Minha gravação mais recente', version: 2 }));
  await save.promise;
  assert.equal(editor.current.dirty, false);
  await finish(calls[0], note());
  await poll.promise;
  assert.equal(editor.current.note.version, 2);
  assert.equal(editor.current.form.content, 'Minha gravação mais recente');
  assert.equal(editor.current.dirty, false);
});

test('reload explícito recusa apagar texto novo digitado enquanto sua consulta estava pendente', async () => {
  const calls = fakeHttp();
  const editor = await mount();
  await editor.edit('content', 'Rascunho que decidi comparar');
  const reload = await editor.start('reload');
  await editor.edit('content', 'Outra frase escrita depois de pedir para carregar');
  await finish(calls[0], note({ content: 'Versão consultada', version: 2 }));
  assert.equal(await reload.promise, false);
  assert.equal(editor.current.form.content, 'Outra frase escrita depois de pedir para carregar');
  assert.equal(editor.current.dirty, true);
  assert.equal(readStored().form.content, editor.current.form.content);
  assert.equal(readStored().baseVersion, 1);
  assert.match(editor.current.error.message, /continuou editando/i);
  const intentional = await editor.start('reload');
  await finish(calls[1], note({ content: 'Versão consultada', version: 2 }));
  await intentional.promise;
  assert.equal(editor.current.form.content, 'Versão consultada');
  assert.equal(editor.current.dirty, false);
  assert.equal(readStored(), null);
});

test('atualização apenas de participantes preserva texto pendente e avança a base com segurança', async () => {
  const calls = fakeHttp();
  const editor = await mount();
  await editor.edit('content', 'Rascunho pendente durante compartilhamento');
  const poll = await editor.start('checkRemote');
  await finish(calls[0], note({ version: 2, access: [{ userId: 2, role: 'EDITOR', user: { id: 2, nome: 'Colega', isActive: true } }] }));
  await poll.promise;
  assert.equal(editor.current.form.content, 'Rascunho pendente durante compartilhamento');
  assert.equal(editor.current.dirty, true);
  assert.equal(editor.current.conflict, null);
  assert.equal(readStored().baseVersion, 2);
  const save = await editor.start('flush');
  assert.equal(calls[1].body.version, 2);
  await finish(calls[1], note({ version: 3, content: calls[1].body.content }));
  await save.promise;
  assert.equal(editor.current.dirty, false);
});

test('debounce salva automaticamente a fotografia atual após uma pausa de digitação', async () => {
  const calls = fakeHttp();
  const editor = await mount();
  await editor.edit('content', 'Primeira digitação');
  await editor.edit('content', 'Texto final depois de continuar digitando');
  assert.equal(calls.length, 0);
  await waitPastAutosave();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.content, 'Texto final depois de continuar digitando');
  await finish(calls[0], note({ content: calls[0].body.content, version: 2 }));
  assert.equal(editor.current.status, 'saved');
  assert.equal(editor.current.dirty, false);
});

test('leitor sem rascunho pode obter a nota para organizar sem enviar gravação de conteúdo', async () => {
  const calls = fakeHttp();
  const existing = note({ role: 'VIEWER' });
  const editor = await mount(existing);
  assert.equal(editor.current.canEdit, false);
  assert.equal(editor.current.dirty, false);
  assert.deepEqual(await editor.call('flush'), existing);
  assert.equal(calls.length, 0);
});

test('leitor com rascunho recuperado mantém uma cópia local sem enviar conteúdo ao servidor', async () => {
  const calls = fakeHttp();
  sessionStorage.setItem(draftKey(), JSON.stringify({ userId: 1, noteId: 100, kind: 'TEXT', mutationId: randomUUID(), baseVersion: 1,
    form: { title: 'Título local', content: 'Texto escrito antes do rebaixamento', items: [] }, savedAt: Date.now() }));
  const editor = await mount(note({ role: 'VIEWER' }));
  assert.equal(editor.current.canEdit, false);
  assert.equal(editor.current.dirty, true);
  assert.equal(await editor.call('flush'), false);
  await waitPastAutosave();
  assert.equal(calls.length, 0);
  assert.match(editor.current.copyDraftText(), /Texto escrito antes do rebaixamento/);
  assert.equal(readStored().form.content, 'Texto escrito antes do rebaixamento');
});

test('rascunho de base antiga abre em conflito e não substitui a versão atual automaticamente', async () => {
  const calls = fakeHttp();
  const form = { title: 'Título local', content: 'Meu rascunho recuperado', items: [] };
  sessionStorage.setItem(draftKey(), JSON.stringify({ userId: 1, noteId: 100, kind: 'TEXT', mutationId: randomUUID(), baseVersion: 1, form, savedAt: Date.now() }));
  const editor = await mount(note({ content: 'Outra pessoa editou durante a pausa', version: 3 }));
  assert.equal(editor.current.status, 'conflict');
  assert.equal(editor.current.form.content, form.content);
  assert.equal(editor.current.conflict.version, 3);
  assert.equal(editor.current.dirty, true);
  assert.equal(await editor.call('flush'), false);
  assert.equal(await editor.call('retry'), false);
  await waitPastAutosave();
  assert.equal(calls.length, 0);
  assert.equal(readStored().baseVersion, 1);
});

test('criação idempotente descoberta com conteúdo diferente preserva rascunho na chave da nota salva', async () => {
  const calls = fakeHttp();
  const editor = await mount(null);
  await editor.edit('content', 'Tentativa local depois de perder a resposta');
  const save = await editor.start('flush');
  assert.equal(calls[0].method, 'POST');
  assert.ok(calls[0].body.clientMutationId);
  await finish(calls[0], note({ content: 'Esta nota já foi editada em outra aba', version: 4 }));
  assert.equal(await save.promise, false);
  assert.equal(editor.current.status, 'conflict');
  assert.equal(editor.current.form.content, 'Tentativa local depois de perder a resposta');
  assert.equal(readStored(null), null);
  assert.equal(readStored().form.content, editor.current.form.content);
  assert.equal(readStored().noteId, 100);
  assert.equal(await editor.call('retry'), false);
  assert.equal(calls.length, 1);
});

test('nova nota serializa POST e PATCH, preservando texto digitado durante sua criação', async () => {
  const calls = fakeHttp();
  const editor = await mount(null);
  await editor.edit('content', 'Primeiro texto da nota nova');
  const save = await editor.start('flush');
  const mutationId = calls[0].body.clientMutationId;
  assert.equal(calls[0].method, 'POST');
  assert.equal(readStored(null).mutationId, mutationId);
  await editor.edit('content', 'Texto mais recente durante o primeiro salvamento');
  await finish(calls[0], note({ title: '', content: 'Primeiro texto da nota nova' }), 201);
  assert.equal(calls[1].method, 'PATCH');
  assert.equal(calls[1].body.version, 1);
  assert.equal(calls[1].body.content, editor.current.form.content);
  assert.equal(readStored(null), null);
  assert.equal(readStored().mutationId, mutationId);
  await finish(calls[1], note({ title: '', content: calls[1].body.content, version: 2 }));
  await save.promise;
  assert.equal(editor.current.dirty, false);
  assert.equal(readStored(), null);
});

test('navegação e fechamento externo são bloqueados até descartar explicitamente o rascunho', async () => {
  const calls = fakeHttp();
  const editor = await mount();
  await editor.edit('content', 'Uma edição ainda pendente');
  const closing = new window.Event('beforeunload', { cancelable: true });
  window.dispatchEvent(closing);
  assert.equal(closing.defaultPrevented, true);
  assert.equal(readStored().form.content, 'Uma edição ainda pendente');
  await act(async () => { void editor.router.navigate('/away'); await nextTurn(); });
  assert.equal(editor.current.navigationBlocked, true);
  assert.equal(editor.router.state.location.pathname, '/');
  await editor.call('stay');
  assert.equal(editor.current.navigationBlocked, false);
  assert.equal(editor.current.dirty, true);
  await act(async () => { void editor.router.navigate('/away'); await nextTurn(); });
  assert.equal(editor.current.navigationBlocked, true);
  await editor.call('discardAndLeave');
  assert.equal(editor.router.state.location.pathname, '/away');
  assert.equal(editor.container.textContent, 'Outra página');
  assert.equal(readStored(), null);
  assert.equal(calls.length, 0);
});

test('reverter o texto confirmado e receber polling limpo libera novas gravações após conflito', async () => {
  const calls = fakeHttp();
  const editor = await mount();
  await editor.edit('content', 'Edição local que conflitou');
  const conflictedSave = await editor.start('flush');
  await finish(calls[0], { error: 'Outra versão foi salva.', code: 'VERSION_CONFLICT' }, 409);
  await finish(calls[1], note({ content: 'Nova versão remota', version: 2 }));
  await conflictedSave.promise;
  assert.equal(editor.current.status, 'conflict');
  await editor.edit('content', note().content);
  assert.equal(editor.current.dirty, false);
  const poll = await editor.start('checkRemote');
  await finish(calls[2], note({ content: 'Nova versão remota', version: 2 }));
  await poll.promise;
  assert.equal(editor.current.status, 'saved');
  assert.equal(editor.current.conflict, null);
  await editor.edit('content', 'Uma edição posterior ao conflito resolvido');
  const saved = await editor.start('flush');
  assert.equal(calls.length, 4, 'Adotar uma consulta limpa deve liberar a pausa deixada pelo conflito.');
  assert.equal(calls[3].body.version, 2);
  await finish(calls[3], note({ content: calls[3].body.content, version: 3 }));
  await saved.promise;
  assert.equal(editor.current.dirty, false);
});

test('logout de nota limpa bloqueia teclas sincronamente e o cancelamento libera o editor', async () => {
  const calls = fakeHttp();
  const editor = await mount();
  const decisions = [];
  await act(async () => {
    window.dispatchEvent(new window.CustomEvent('motive:before-logout', { detail: { waitUntil: promise => decisions.push(promise) } }));
    // The old event handler may still run before React renders disabled inputs.
    editor.current.setField('content', 'Tecla recebida no mesmo evento do logout');
  });
  assert.equal(editor.current.leaving, true);
  assert.equal(editor.current.canEdit, false);
  assert.equal(editor.current.form.content, note().content);
  assert.equal(editor.current.dirty, false);
  assert.equal(calls.length, 0);
  assert.equal(decisions.length, 0);
  await act(async () => { window.dispatchEvent(new window.Event('motive:logout-cancelled')); });
  assert.equal(editor.current.leaving, false);
  assert.equal(editor.current.canEdit, true);
  await editor.edit('content', 'Editei depois de cancelar a saída');
  assert.equal(editor.current.form.content, 'Editei depois de cancelar a saída');
  assert.equal(editor.current.dirty, true);
});

test('logout salva o último rascunho e mantém teclas bloqueadas enquanto a saída é confirmada', async () => {
  const calls = fakeHttp();
  const editor = await mount();
  await editor.edit('content', 'Última edição antes de sair');
  const decisions = [];
  await act(async () => {
    window.dispatchEvent(new window.CustomEvent('motive:before-logout', { detail: { waitUntil: promise => decisions.push(promise) } }));
    editor.current.setField('content', 'Tecla tardia durante logout');
  });
  assert.equal(calls.length, 1);
  assert.equal(decisions.length, 1);
  assert.equal(calls[0].body.content, 'Última edição antes de sair');
  assert.equal(editor.current.form.content, 'Última edição antes de sair');
  assert.equal(editor.current.leaving, true);
  await finish(calls[0], note({ content: calls[0].body.content, version: 2 }));
  assert.equal(await decisions[0], true);
  assert.equal(editor.current.dirty, false);
  assert.equal(readStored(), null);
  await editor.edit('content', 'Tecla após salvar, com logout HTTP ainda pendente');
  assert.equal(editor.current.form.content, 'Última edição antes de sair');
  assert.equal(editor.current.canEdit, false);
  assert.equal(calls.length, 1);
});

test('recusar descarte após falha no logout conserva o rascunho e permite continuar editando', async () => {
  const calls = fakeHttp();
  const editor = await mount();
  await editor.edit('content', 'Texto preservado se a saída for cancelada');
  const decisions = [];
  const originalConfirm = window.confirm;
  let confirmations = 0;
  window.confirm = () => { confirmations++; return false; };
  try {
    await act(async () => {
      window.dispatchEvent(new window.CustomEvent('motive:before-logout', { detail: { waitUntil: promise => decisions.push(promise) } }));
      editor.current.setField('content', 'Tecla durante a tentativa de sair');
    });
    await act(async () => { calls[0].reject(new TypeError('Failed to fetch')); await nextTurn(); });
    assert.equal(await decisions[0], false);
    assert.equal(confirmations, 1);
    assert.equal(editor.current.form.content, 'Texto preservado se a saída for cancelada');
    assert.equal(readStored().form.content, editor.current.form.content);
    await act(async () => { window.dispatchEvent(new window.Event('motive:logout-cancelled')); });
    assert.equal(editor.current.canEdit, true);
    assert.equal(editor.current.leaving, false);
    await editor.edit('content', 'Continuei escrevendo depois de cancelar a saída');
    assert.equal(readStored().form.content, 'Continuei escrevendo depois de cancelar a saída');
  } finally { window.confirm = originalConfirm; }
});
