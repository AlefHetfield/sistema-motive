import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost:5173/tasks', pretendToBeVisual: true });
const descriptors = new Map();
const globals = {
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement, Event: dom.window.Event,
  IS_REACT_ACT_ENVIRONMENT: true,
  fetch: () => { throw Error('Nenhuma API real é permitida neste teste'); },
};
for (const [name, value] of Object.entries(globals)) {
  descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
let now = Date.parse('2026-10-29T12:00:00.000Z');
const realNow = Date.now;
Date.now = () => now;

const task = { id: 1, title: 'Conferir matrícula', status: 'TODO', category: 'GENERAL', notes: '', assigneeId: 1,
  assignee: { id: 1, nome: 'Teste' }, version: 1, steps: [{ title: 'Conferir documento', done: false }] };
const result = item => ({ tasks: item ? [structuredClone(item)] : [], total: item ? 1 : 0, page: 1, pages: 1 });
const calls = [];
const listRequests = [];
const patchRequests = [];
let currentTask = structuredClone(task);
let deferLists = true;
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
const api = async (pathname = '', options = {}) => {
  calls.push({ pathname, options });
  if (pathname === '/options') return { userId: 1, canManageAll: true, lists: [], users: [{ id: 1, nome: 'Teste', isActive: true }] };
  if (pathname === '/summary') return { all: 1, important: 0 };
  if (options.method === 'PATCH' && pathname === '/1') {
    const request = { pathname, options, ...deferred() };
    patchRequests.push(request);
    return request.promise;
  }
  if (pathname.startsWith('?')) {
    const request = { pathname, options, ...deferred() };
    listRequests.push(request);
    return deferLists ? request.promise : result(currentTask);
  }
  throw Error(`Requisição inesperada: ${options.method || 'GET'} ${pathname}`);
};
descriptors.set('__taskRefreshApi', Object.getOwnPropertyDescriptor(globalThis, '__taskRefreshApi'));
globalThis.__taskRefreshApi = api;

const frontend = fileURLToPath(new URL('../', import.meta.url));
const bundlePath = fileURLToPath(new URL(`../.verify-task-refresh-${randomUUID()}.mjs`, import.meta.url));
let root;
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const perform = async action => act(async () => { action(); await flush(); });
const loading = () => document.body.textContent.includes('Carregando tarefas…');
const cards = () => [...document.querySelectorAll('article')];
const button = text => [...document.querySelectorAll('button')].find(element => element.textContent.trim() === text);
const focus = () => perform(() => window.dispatchEvent(new Event('focus')));
const settleList = (request, item = currentTask) => perform(() => request.resolve(result(item)));
const advance = milliseconds => { now += milliseconds; };
try {
  const output = await build({
    absWorkingDir: frontend, entryPoints: ['src/pages/Tasks.jsx'], bundle: true, write: false,
    platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic',
    plugins: [{ name: 'task-refresh-fixtures', setup(builder) {
      builder.onResolve({ filter: /^react(?:\/.*)?$/ }, args => ({ path: args.path, external: true }));
      builder.onResolve({ filter: /\/services\/api$|\/TaskEditor$|\/TaskPropertyCard$|\/FancySelect$|^sonner$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => {
        if (path.endsWith('/api')) return { contents: 'export const taskApi=(...args)=>globalThis.__taskRefreshApi(...args);' };
        if (path === 'sonner') return { contents: 'export const toast={error(){},success(){}};' };
        if (path.endsWith('/FancySelect')) return { contents: 'import React from "react";export default function Select({options=[],value,onChange,ariaLabel}){return React.createElement("select",{value,onChange:event=>onChange(event.target.value),"aria-label":ariaLabel},options.map(item=>React.createElement("option",{key:item.value,value:item.value},item.label)));}' };
        return { contents: 'export default()=>null;' };
      });
    } }],
  });
  await writeFile(bundlePath, output.outputFiles[0].text);
  const { default: Tasks } = await import(pathToFileURL(bundlePath).href);
  const { createRoot } = await import('react-dom/client');
  const { MemoryRouter } = await import('react-router-dom');
  root = createRoot(document.getElementById('root'));
  await perform(() => root.render(React.createElement(MemoryRouter, null, React.createElement(Tasks))));
  assert.equal(loading(), true, 'Primeiro acesso mantém o indicador de carregamento');
  assert.equal(cards().length, 0);
  assert.equal(listRequests.length, 1);
  await settleList(listRequests.at(-1));
  assert.equal(loading(), false);
  assert.equal(cards().length, 1);
  const firstCard = cards()[0];
  const initialCalls = calls.length;
  await focus();
  assert.equal(calls.length, initialCalls, 'Foco logo após o carregamento não repete consultas');

  advance(30001);
  const beforeRefresh = calls.length;
  await perform(() => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const refreshCalls = calls.slice(beforeRefresh).map(call => call.pathname);
  assert.equal(refreshCalls.length, 3, 'Retorno após o intervalo sincroniza lista, opções e contadores');
  assert.ok(refreshCalls.includes('/options'));
  assert.ok(refreshCalls.includes('/summary'));
  assert.ok(refreshCalls.some(path => path.startsWith('?')));
  assert.equal(loading(), false, 'Sincronização não substitui os cartões por carregamento');
  assert.equal(cards()[0], firstCard, 'O mesmo nó do cartão permanece na tela enquanto a API responde');
  advance(30001);
  const inFlightCalls = calls.length;
  await focus();
  assert.equal(calls.length, inFlightCalls, 'Mesmo após 30 segundos, foco não duplica consulta em andamento');
  await settleList(listRequests.at(-1));
  assert.equal(cards()[0], firstCard, 'Resposta idêntica não remonta o cartão');

  // A new server snapshot updates the existing card without hiding it.
  advance(30001);
  await focus();
  currentTask = { ...currentTask, title: 'Matrícula atualizada pela equipe', version: 2 };
  await settleList(listRequests.at(-1));
  assert.equal(cards()[0], firstCard);
  assert.match(firstCard.textContent, /Matrícula atualizada pela equipe/);
  const recentCalls = calls.length;
  await focus();
  assert.equal(calls.length, recentCalls, 'Retorno imediato após sincronizar também respeita o intervalo');

  // Hidden documents and pending mutations cannot start background snapshots.
  advance(30001);
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  const hiddenCalls = calls.length;
  await focus();
  assert.equal(calls.length, hiddenCalls);
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  const step = document.querySelector('input[type="checkbox"][aria-label="Concluir subtarefa Conferir documento"]');
  assert.ok(step);
  await perform(() => step.click());
  assert.equal(patchRequests.length, 1);
  const duringMutation = calls.length;
  await focus();
  assert.equal(calls.length, duringMutation, 'Foco não inicia leitura durante gravação de subtarefa');
  currentTask = { ...currentTask, version: 3, steps: [{ title: 'Conferir documento', done: true }] };
  await perform(() => patchRequests.at(-1).resolve(structuredClone(currentTask)));
  assert.equal(cards()[0], firstCard);
  assert.ok(document.querySelector('input[aria-label="Reabrir subtarefa Conferir documento"]')?.checked);

  // A refresh already in flight must not overwrite a later optimistic mutation.
  advance(30001);
  await focus();
  const beforeMutationSnapshot = listRequests.at(-1);
  const staleTask = structuredClone(currentTask);
  const reopen = document.querySelector('input[aria-label="Reabrir subtarefa Conferir documento"]');
  await perform(() => reopen.click());
  currentTask = { ...currentTask, version: 4, steps: [{ title: 'Conferir documento', done: false }] };
  await perform(() => patchRequests.at(-1).resolve(structuredClone(currentTask)));
  await settleList(beforeMutationSnapshot, staleTask);
  assert.equal(cards()[0], firstCard);
  assert.equal(document.querySelector('input[aria-label="Concluir subtarefa Conferir documento"]')?.checked, false, 'Snapshot anterior à gravação não restaura uma versão antiga da subtarefa');

  advance(30001);
  const afterStaleCalls = calls.length;
  await focus();
  assert.equal(calls.length - afterStaleCalls, 3, 'Descartar resposta por revisão de mutação também libera o guard para o próximo foco');
  const failedRefresh = listRequests.at(-1);
  await perform(() => failedRefresh.reject(new Error('Falha temporária de rede')));
  assert.equal(loading(), false);
  assert.equal(cards()[0], firstCard, 'Falha em segundo plano preserva os dados visíveis');
  assert.match(document.querySelector('[role="alert"]').textContent, /Falha temporária de rede/);
  assert.ok(button('Tentar novamente'));
  await perform(() => button('Tentar novamente').click());
  assert.equal(cards()[0], firstCard, 'Tentar novamente usa a lista já carregada enquanto aguarda');
  await settleList(listRequests.at(-1));
  assert.equal(document.querySelector('[role="alert"]'), null);

  // Switching the query keeps the normal loading behavior and cancels older snapshots.
  advance(30001);
  await focus();
  const obsolete = listRequests.at(-1);
  await perform(() => button('Importantes').click());
  const filtered = listRequests.at(-1);
  assert.notEqual(filtered, obsolete);
  assert.ok(filtered.pathname.includes('view=important'));
  assert.equal(obsolete.options.signal.aborted, true);
  assert.equal(loading(), true, 'Trocar filtros continua mostrando carregamento para a nova consulta');
  assert.equal(cards().length, 0, 'Não apresenta cartões da consulta anterior como se fossem do novo filtro');
  const importantTask = { ...currentTask, important: true, title: 'Tarefa importante da equipe' };
  await settleList(filtered, importantTask);
  const filteredCard = cards()[0];
  assert.match(filteredCard.textContent, /Tarefa importante da equipe/);
  await settleList(obsolete, { ...task, title: 'Resposta antiga que deve ser ignorada' });
  assert.equal(cards()[0], filteredCard);
  assert.doesNotMatch(document.body.textContent, /Resposta antiga que deve ser ignorada/);
  assert.equal(loading(), false);
  console.log('Tarefas validadas: foco/visibilidade com intervalo de 30 s, consulta em voo/oculta/gravação protegidas, cartões preservados, sincronização da equipe, resposta anterior à mutação descartada sem travar consultas futuras, falha com retry e filtros com cancelamento de respostas antigas. Nenhuma API real acessada.');
} finally {
  if (root) await act(async () => root.unmount());
  Date.now = realNow;
  await unlink(bundlePath).catch(() => {});
  dom.window.close();
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}
