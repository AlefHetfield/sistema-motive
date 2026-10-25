import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeNoteSnapshot, matchesNoteView, reconcileNotePage } from '../src/utils/noteSnapshots.js';
import { projectNoteQueue } from '../src/utils/noteQueueProjection.js';

const note = (fields = {}) => ({ id: 1, ownerId: 1, version: 1, title: 'Documentação', content: 'Matrícula', items: [], labels: [],
  updatedAt: '2026-10-25T10:00:00Z', state: { version: 1, color: 'default', isPinned: false }, ...fields });
const criteria = { view: 'active', scope: 'all', search: '', color: '', labelId: '' };
const page = (notes, extra = {}) => ({ notes, total: notes.length, page: 1, pageSize: 40, ...extra });

test('respostas fora de ordem preservam conteúdo e organização pelas versões independentes', () => {
  const current = note({ version: 3, content: 'Novo', state: { version: 4, color: 'blue' }, labels: [{ id: 7 }] });
  const oldContent = note({ version: 2, content: 'Antigo', state: { version: 5, color: 'green' }, labels: [] });
  const merged = mergeNoteSnapshot(current, oldContent);
  assert.equal(merged.content, 'Novo');
  assert.equal(merged.state.color, 'green');
  assert.deepEqual(merged.labels, []);
  const newContent = note({ version: 4, content: 'Mais novo' });
  const next = mergeNoteSnapshot(merged, newContent);
  assert.equal(next.content, 'Mais novo');
  assert.equal(next.state.version, 5);
});

test('nova nota entra imediatamente, repetições substituem e nunca duplicam a contagem', () => {
  let current = page([]);
  const created = note();
  current = reconcileNotePage(current, null, created, criteria, 1);
  assert.equal(current.total, 1);
  current = reconcileNotePage(current, created, note({ version: 2, content: 'Editado' }), criteria, 1);
  assert.equal(current.total, 1);
  assert.equal(current.notes.length, 1);
  assert.equal(current.notes[0].content, 'Editado');
});

test('filtros de texto, cor, marcador e origem são respeitados após uma gravação', () => {
  assert.equal(matchesNoteView(note(), { ...criteria, search: 'matricula' }, 1), true);
  const filtered = { ...criteria, color: 'blue', labelId: '7', scope: 'mine' };
  const created = note();
  assert.equal(reconcileNotePage(page([]), null, created, filtered, 1).total, 0);
  const matching = note({ state: { version: 2, color: 'blue' }, labels: [{ id: 7 }] });
  assert.equal(reconcileNotePage(page([]), created, matching, filtered, 1).total, 1);
  assert.equal(matchesNoteView(matching, { ...filtered, scope: 'shared' }, 1), false);
});

test('arquivar, ocultar, restaurar e mover à lixeira atualizam cartões e contagem sem recarregar', () => {
  const original = note();
  for (const changed of [note({ deletedAt: '2026-10-25T11:00:00Z' }), note({ state: { version: 2, archivedAt: 'agora' } }), note({ state: { version: 2, hiddenAt: 'agora' } })]) {
    const current = reconcileNotePage(page([original]), original, changed, criteria, 1);
    assert.equal(current.notes.length, 0); assert.equal(current.total, 0);
  }
  const trashed = note({ deletedAt: 'agora' });
  const trash = { ...criteria, view: 'trash' };
  assert.equal(reconcileNotePage(page([trashed]), trashed, original, trash, 1).total, 0);
  assert.equal(reconcileNotePage(page([trashed]), trashed, null, trash, 1).notes.length, 0);
});

test('fixação ordena os cartões imediatamente e mantém limite e total na primeira página', () => {
  const original = note();
  const newer = note({ id: 2, updatedAt: '2026-10-25T11:00:00Z' });
  const current = reconcileNotePage(page([newer, original]), original, note({ state: { version: 2, isPinned: true } }), criteria, 1);
  assert.deepEqual(current.notes.map(item => item.id), [1, 2]);
  const created = note({ id: 3, updatedAt: '2026-10-25T12:00:00Z' });
  const limited = reconcileNotePage(page([newer], { pageSize: 1, total: 2 }), null, created, criteria, 1);
  assert.equal(limited.total, 3); assert.deepEqual(limited.notes.map(item => item.id), [3]);
});

test('remover último item de uma página posterior preserva total para voltar à página anterior', () => {
  const original = note();
  const current = reconcileNotePage(page([original], { page: 2, pageSize: 2, total: 3 }), original, null, criteria, 1);
  assert.equal(current.total, 2); assert.deepEqual(current.notes, []);
  const outside = reconcileNotePage(page([original], { page: 2, pageSize: 2, total: 3 }), null, note({ id: 99 }), criteria, 1);
  assert.equal(outside.total, 4); assert.deepEqual(outside.notes.map(item => item.id), [1]);
});

test('projeção preserva texto pendente mesmo que a lista já contenha uma versão remota mais nova', () => {
  const remote = note({ version: 3, content: 'Texto de outra pessoa' });
  const pending = { id: 'copy-1', userId: 1, noteId: remote.id, baseVersion: 1, remoteNote: note(),
    form: { title: 'Documentação', content: 'Meu texto local', items: [] }, kind: 'TEXT', status: 'conflict', updatedAt: Date.now() };
  const projected = projectNoteQueue(page([remote]), [pending], new Map(), criteria, { id: 1 });
  assert.equal(projected.notes[0].content, 'Meu texto local');
  assert.equal(projected.notes[0]._syncState, 'conflict');
  assert.equal(projected.total, 1);
  assert.equal(pending.baseVersion, 1, 'Uma versão visual não altera a base usada na gravação.');
});
