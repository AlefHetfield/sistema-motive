import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createNoteQueueStore } from '../src/utils/noteQueueStore.js';
import { createNoteQueue } from '../src/utils/noteQueue.js';
import { guardedNoteRequest } from '../src/utils/guardedNoteRequest.js';

const queues = [], stores = [];
const form = content => ({ title: 'Nota', content, items: [] });
const note = (content, extra = {}) => ({ id: 10, ownerId: 1, title: 'Nota', content, items: [], kind: 'TEXT', version: 1,
  role: 'OWNER', owner: { id: 1, nome: 'Teste' }, state: { version: 1, color: 'default' }, labels: [], access: [], ...extra });
const input = (content, extra = {}) => ({ id: 'draft-1', userId: 1, kind: 'TEXT', mutationId: 'af12c5b0-711e-4234-b894-e22155f56a11',
  noteId: null, baseVersion: undefined, baseForm: form(''), remoteNote: null, form: form(content), ...extra });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const waitCalls = async (calls, total) => { for (let i = 0; i < 100 && calls.length < total; i++) await tick(); assert.equal(calls.length, total); };
const make = async ({ store = createNoteQueueStore(new IDBFactory()), withLock = async (_name, work) => work(), auto = false } = {}) => {
  const calls = [];
  const request = (path, options = {}) => new Promise((resolve, reject) => calls.push({ path, ...options, resolve, reject }));
  const queue = createNoteQueue({ store, request, withLock, auto, now: auto ? Date.now : () => 10000 });
  queues.push(queue); stores.push(store); await queue.activate(1);
  return { queue, store, calls, entry: () => queue.getSnapshot().entries[0] };
};
afterEach(async () => { for (const queue of queues.splice(0)) queue.destroy(); for (const store of stores.splice(0)) await store.close(); });

test('fila persiste no IndexedDB e retoma na mesma conta depois de recarregar', async () => {
  const first = await make(); await first.queue.save(input('Texto preservado'));
  first.queue.destroy();
  const reopened = await make({ store: first.store });
  assert.equal(reopened.entry().form.content, 'Texto preservado');
  const sending = reopened.queue.run(true); await waitCalls(reopened.calls, 1);
  assert.equal(reopened.calls[0].expectedUserId, 1);
  assert.equal(reopened.calls[0].method, 'POST');
  reopened.calls[0].resolve(note('Texto preservado')); await sending;
  assert.equal(reopened.entry().status, 'synced');
});

test('digitação durante POST é preservada e segue como PATCH com a versão confirmada', async () => {
  const app = await make(); await app.queue.save(input('Primeiro'));
  const posting = app.queue.run(true); await waitCalls(app.calls, 1);
  await app.queue.save(input('Segundo'), 1); await app.queue.save(input('Último'), 2);
  app.calls[0].resolve(note('Primeiro')); await posting;
  assert.equal(app.entry().status, 'pending'); assert.equal(app.entry().form.content, 'Último');
  const patching = app.queue.run(true); await waitCalls(app.calls, 2);
  assert.equal(app.calls[1].method, 'PATCH'); assert.equal(app.calls[1].body.version, 1);
  assert.equal(app.calls[1].body.content, 'Último');
  app.calls[1].resolve(note('Último', { version: 2 })); await patching;
  assert.equal(app.entry().status, 'synced');
});

test('resposta perdida de POST repete a mesma chave e fotografia antes de enviar o texto novo', async () => {
  const app = await make(); await app.queue.save(input('Primeiro'));
  const posting = app.queue.run(true); await waitCalls(app.calls, 1);
  await app.queue.save(input('Último'), 1);
  app.calls[0].reject(new TypeError('Failed to fetch')); await posting;
  assert.equal(app.entry().status, 'retry'); app.queue.destroy();
  const reopened = await make({ store: app.store });
  const retry = reopened.queue.run(true); await waitCalls(reopened.calls, 1);
  assert.deepEqual(reopened.calls[0].body, app.calls[0].body);
  reopened.calls[0].resolve(note('Primeiro')); await retry;
  assert.equal(reopened.entry().form.content, 'Último'); assert.equal(reopened.entry().status, 'pending');
});

test('PATCH cuja resposta se perdeu reconhece o conteúdo confirmado antes de avançar a fila', async () => {
  const app = await make(); const original = note('Original');
  await app.queue.save(input('Primeiro', { noteId: 10, baseVersion: 1, baseForm: form('Original'), remoteNote: original }));
  const first = app.queue.run(true); await waitCalls(app.calls, 1);
  await app.queue.save(input('Último'), 1);
  app.calls[0].reject(new TypeError('Failed to fetch')); await first;
  const retry = app.queue.run(true); await waitCalls(app.calls, 2);
  app.calls[1].reject(Object.assign(new Error('Versão mudou'), { status: 409 }));
  await waitCalls(app.calls, 3); assert.equal(app.calls[2].method, undefined);
  app.calls[2].resolve(note('Primeiro', { version: 2 })); await retry;
  const latest = app.queue.run(true); await waitCalls(app.calls, 4);
  assert.equal(app.calls[3].body.version, 2); assert.equal(app.calls[3].body.content, 'Último');
  app.calls[3].resolve(note('Último', { version: 3 })); await latest;
  assert.equal(app.entry().status, 'synced');
});

test('conflito de texto pausa a fila e preserva ambas as versões sem sobrescrever', async () => {
  const app = await make();
  await app.queue.save(input('Meu texto', { noteId: 10, baseVersion: 1, baseForm: form('Original'), remoteNote: note('Original') }));
  const work = app.queue.run(true); await waitCalls(app.calls, 1);
  app.calls[0].reject(Object.assign(new Error('Conflito'), { status: 409 })); await waitCalls(app.calls, 2);
  app.calls[1].resolve(note('Texto de outra pessoa', { version: 2 })); await work;
  assert.equal(app.entry().status, 'conflict'); assert.equal(app.entry().form.content, 'Meu texto');
  assert.equal(app.entry().conflict.content, 'Texto de outra pessoa');
  await app.queue.retry('draft-1'); await app.queue.run(true); assert.equal(app.calls.length, 2);
});

test('versão de compartilhamento sem mudança no texto permite nova tentativa segura', async () => {
  const app = await make();
  await app.queue.save(input('Meu texto', { noteId: 10, baseVersion: 1, baseForm: form('Original'), remoteNote: note('Original') }));
  const work = app.queue.run(true); await waitCalls(app.calls, 1);
  app.calls[0].reject(Object.assign(new Error('Conflito'), { status: 409 })); await waitCalls(app.calls, 2);
  app.calls[1].resolve(note('Original', { version: 2 })); await work;
  const retry = app.queue.run(true); await waitCalls(app.calls, 3); assert.equal(app.calls[2].body.version, 2);
  app.calls[2].resolve(note('Meu texto', { version: 3 })); await retry;
  assert.equal(app.entry().status, 'synced');
});

test('revogação bloqueia envio automático e outra conta não recebe nem envia a cópia', async () => {
  const app = await make(); await app.queue.save(input('Texto privado', { noteId: 10, baseVersion: 1 }));
  const work = app.queue.run(true); await waitCalls(app.calls, 1);
  app.calls[0].reject(Object.assign(new Error('Acesso negado'), { status: 403 })); await work;
  await app.queue.run(true); assert.equal(app.calls.length, 1); assert.equal(app.entry().status, 'blocked');
  await app.queue.activate(2); assert.deepEqual(app.queue.getSnapshot().entries, []);
  await app.queue.run(true); assert.equal(app.calls.length, 1);
  await app.queue.activate(1); assert.equal(app.entry().form.content, 'Texto privado');
});

test('duas abas não enviam simultaneamente a mesma fotografia e não perdem edições locais', async () => {
  let locked = false;
  const withLock = async (_name, work) => { if (locked) return null; locked = true; try { return await work(); } finally { locked = false; } };
  const first = await make({ withLock }); await first.queue.save(input('Texto'));
  const second = await make({ store: first.store, withLock });
  const sending = first.queue.run(true); await waitCalls(first.calls, 1);
  await second.queue.run(true); assert.equal(second.calls.length, 0);
  await assert.rejects(second.queue.save(input('Outra aba'), 0), error => error.code === 'LOCAL_CONFLICT');
  first.calls[0].resolve(note('Texto')); await sending;
  await second.queue.run(true); assert.equal(second.calls.length, 0);
});

test('troca de conta durante o envio não confirma uma resposta tardia na conta nova', async () => {
  const app = await make(); await app.queue.save(input('Conta um'));
  const sending = app.queue.run(true); await waitCalls(app.calls, 1);
  await app.queue.activate(2); app.calls[0].resolve(note('Conta um')); await sending;
  assert.deepEqual(app.queue.getSnapshot().entries, []);
  await app.queue.activate(1); assert.equal(app.entry().status, 'pending');
  assert.equal(app.entry().attempt.snapshot.content, 'Conta um');
});

test('erro de armazenamento nunca informa que o texto foi preservado', async () => {
  const app = await make({ store: { list: async () => [], update: async () => { throw new DOMException('Quota', 'QuotaExceededError'); }, close: async () => {} } });
  await assert.rejects(app.queue.save(input('Texto importante')), /Quota/);
  assert.deepEqual(app.queue.getSnapshot().entries, []); assert.equal(app.calls.length, 0);
});

test('a transação do armazenamento rejeita gravações de outra conta', async () => {
  const app = await make(); await app.queue.save(input('Texto'));
  assert.deepEqual(await app.store.list(2), []);
  await assert.rejects(app.store.update('draft-1', 2, entry => entry), /outra conta/);
});

test('apagar uma nova nota ainda não enviada cancela a criação sem POST', async () => {
  const app = await make(); await app.queue.save(input('Rascunho'));
  await app.queue.save({ ...input(''), form: { title: '', content: '', items: [] } }, 1);
  await app.queue.run(true); assert.equal(app.calls.length, 0); assert.equal(app.entry(), undefined);
});

test('apagar o texto durante um POST guarda a intenção vazia e não reenvia o texto antigo', async () => {
  const app = await make(); await app.queue.save(input('Primeiro'));
  const sending = app.queue.run(true); await waitCalls(app.calls, 1);
  await app.queue.save({ ...input(''), form: { title: '', content: '', items: [] } }, 1);
  app.calls[0].resolve(note('Primeiro')); await sending;
  await app.queue.run(true);
  assert.equal(app.entry().status, 'blocked'); assert.equal(app.entry().form.content, ''); assert.equal(app.calls.length, 1);
});

test('acknowledgements antigos não ressuscitam cartões após uma nova sessão', async () => {
  const first = await make(); await first.queue.save(input('Texto'));
  const sending = first.queue.run(true); await waitCalls(first.calls, 1);
  first.calls[0].resolve(note('Texto')); await sending;
  const anotherTab = await make({ store: first.store });
  assert.deepEqual(anotherTab.queue.getSnapshot().entries, []);
  // The original editor can continue after another tab authenticates.
  await first.queue.save(input('Nova edição'), 1); assert.equal(first.entry().form.content, 'Nova edição');
});

test('flush com fila pausada retorna sem bloquear o navegador', async () => {
  const app = await make(); await app.queue.save(input('Texto'));
  app.queue.pause(); assert.equal(await app.queue.flush('draft-1'), null); assert.equal(app.calls.length, 0);
});

test('protocolo verifica a conta antes de transmitir o corpo e recusa API antiga', async () => {
  const calls = [];
  const request = guardedNoteRequest(async (path, options) => {
    calls.push({ path, options });
    if (path === '/sync-session') return { userId: options.expectedUserId, persistentQueue: 1 };
    return note('Texto');
  });
  await request('', { expectedUserId: 1, method: 'POST', body: form('Texto') });
  assert.equal(calls[0].path, '/sync-session'); assert.equal(calls[0].options.body, undefined);
  assert.equal(calls[1].options.body.content, 'Texto');
  const oldApi = guardedNoteRequest(async () => { throw Object.assign(new Error('Rota inválida'), { status: 400 }); });
  await assert.rejects(oldApi('', { expectedUserId: 1, body: form('Texto') }), error => error.status === 503);
  const wrongAccount = guardedNoteRequest(async () => ({ userId: 2, persistentQueue: 1 }));
  await assert.rejects(wrongAccount('', { expectedUserId: 1, body: form('Texto') }), error => error.code === 'SESSION_CHANGED');
});

test('o worker automático inicia após a pausa e não duplica uma gravação em andamento', async () => {
  const app = await make({ auto: true }); await app.queue.save(input('Primeiro'));
  await new Promise(resolve => setTimeout(resolve, 780)); await waitCalls(app.calls, 1);
  await app.queue.save(input('Último'), 1);
  assert.equal(app.calls.length, 1);
  app.calls[0].resolve(note('Primeiro'));
  await new Promise(resolve => setTimeout(resolve, 780)); await waitCalls(app.calls, 2);
  assert.equal(app.calls[1].body.content, 'Último');
  app.calls[1].resolve(note('Último', { version: 2 }));
  for (let i = 0; i < 100 && app.entry().status !== 'synced'; i++) await tick();
  assert.equal(app.entry().status, 'synced');
});

test('expiração da sessão permite terminar a cópia local sem enviar dados fora da conta original', async () => {
  const app = await make(); await app.queue.save(input('Primeiro'));
  await app.queue.activate(null);
  await app.queue.save(input('Último texto antes da sessão expirar'), 1);
  assert.equal((await app.store.list(1))[0].form.content, 'Último texto antes da sessão expirar');
  await app.queue.run(true); assert.equal(app.calls.length, 0);
  await app.queue.activate(2);
  await assert.rejects(app.queue.save(input('Não misturar contas'), 2), error => error.code === 'SESSION_CHANGED');
  assert.deepEqual(await app.store.list(2), []);
});

test('estado confirmado pode adotar uma versão remota nova sem regredir a próxima edição', async () => {
  const app = await make(); await app.queue.save(input('Original'));
  const sending = app.queue.run(true); await waitCalls(app.calls, 1); app.calls[0].resolve(note('Original')); await sending;
  await app.queue.acceptRemote('draft-1', note('Mudança remota', { version: 2 }));
  assert.equal(app.entry().baseVersion, 2); assert.equal(app.entry().form.content, 'Mudança remota');
  await app.queue.save(input('Minha edição seguinte'), 1);
  const next = app.queue.run(true); await waitCalls(app.calls, 2);
  assert.equal(app.calls[1].body.version, 2);
  app.calls[1].resolve(note('Minha edição seguinte', { version: 3 })); await next;
});
