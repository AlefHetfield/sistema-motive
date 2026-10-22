import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clearNoteDrafts, hasNoteContent, normalizeNoteForm, noteDraftKey, noteFormSignature,
  prepareNoteDraftUser, readNoteDraft, removeNoteDraft, writeNoteDraft,
} from '../frontend/src/utils/noteDrafts.js';

const TTL = 30 * 60 * 1000;
const makeDraft = (userId, fields = {}) => ({
  userId, noteId: 100, mutationId: '9ae0a65f-e51c-4631-b069-4fe9646d92cb',
  kind: 'TEXT', baseVersion: 4,
  form: { title: 'Reunião', content: 'Conteúdo que ainda não foi confirmado', items: [] }, ...fields,
});

// Web Storage exposes its stored keys to Object.keys while methods stay hidden.
const memoryStorage = () => {
  const storage = Object.create(null);
  Object.defineProperties(storage, {
    getItem: { value: key => Object.hasOwn(storage, String(key)) ? storage[String(key)] : null },
    setItem: { value: (key, value) => { storage[String(key)] = String(value); } },
    removeItem: { value: key => { delete storage[String(key)]; } },
  });
  return storage;
};
const withStorage = callback => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const storage = memoryStorage();
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage });
  try { return callback(storage); }
  finally {
    if (descriptor) Object.defineProperty(globalThis, 'sessionStorage', descriptor);
    else delete globalThis.sessionStorage;
  }
};

test('rascunhos: normalização mantém conteúdo e IDs, ignora itens vazios e não altera o formulário', () => {
  const source = {
    title: '  Decisões da reunião  ', content: '  Primeira linha\nSegunda linha  ',
    items: [
      { id: 'estavel-1', text: '  Conferir matrícula  ', checked: false },
      { id: 'vazio', text: ' \n ', checked: false },
      { id: 'estavel-2', text: 'Enviar documentação', checked: true },
    ],
  };
  const original = structuredClone(source);
  const normalized = normalizeNoteForm(source);
  assert.deepEqual(source, original);
  assert.deepEqual(normalized, {
    title: 'Decisões da reunião', content: '  Primeira linha\nSegunda linha  ',
    items: [
      { id: 'estavel-1', text: 'Conferir matrícula', checked: false },
      { id: 'estavel-2', text: 'Enviar documentação', checked: true },
    ],
  });
  assert.equal(noteFormSignature(source), noteFormSignature(normalized));
  assert.notEqual(noteFormSignature(source), noteFormSignature({ ...source, content: `${source.content}\n` }));
  assert.notEqual(noteFormSignature(source), noteFormSignature({ ...source, items: [...source.items].reverse() }));
  assert.notEqual(noteFormSignature(source), noteFormSignature({ ...source, items: source.items.map(item => ({ ...item, checked: !item.checked })) }));
  assert.equal(hasNoteContent({ title: '  ', content: '\n ', items: [{ id: 'a', text: ' ', checked: false }] }), false);
  assert.equal(hasNoteContent({ title: 'Título sem texto' }), true);
  assert.equal(hasNoteContent({ content: 'Texto sem título' }), true);
  assert.equal(hasNoteContent({ items: [{ id: 'a', text: 'Um item', checked: false }] }), true);
});

test('rascunhos: chaves separam pessoas, notas e novas listas', () => {
  assert.notEqual(noteDraftKey(1, 100), noteDraftKey(2, 100));
  assert.notEqual(noteDraftKey(1, 100), noteDraftKey(1, 101));
  assert.notEqual(noteDraftKey(1, null, 'TEXT'), noteDraftKey(1, null, 'CHECKLIST'));
  assert.notEqual(noteDraftKey(1, null), noteDraftKey(1, 100));
});

test('rascunhos: recuperação na mesma conta preserva base, mutação e última fotografia digitada', () => withStorage(storage => {
  const key = noteDraftKey(1, 100);
  const first = makeDraft(1);
  const before = Date.now();
  assert.equal(writeNoteDraft(key, first), true);
  const recovered = readNoteDraft(key, 1);
  assert.deepEqual({ ...recovered, savedAt: undefined }, { ...first, savedAt: undefined });
  assert.ok(recovered.savedAt >= before && recovered.savedAt <= Date.now());
  const latest = makeDraft(1, { form: { title: '', content: 'Mais texto digitado durante o salvamento', items: [] } });
  writeNoteDraft(key, latest);
  assert.deepEqual(readNoteDraft(key, 1).form, latest.form);
  assert.equal(readNoteDraft(key, 1).baseVersion, first.baseVersion);
  assert.equal(readNoteDraft(key, 1).mutationId, first.mutationId);
  removeNoteDraft(key);
  assert.equal(storage.getItem(key), null);
  assert.equal(readNoteDraft(key, 1), null);
}));

test('rascunhos: outra conta, expiração e dados malformados nunca são recuperados', () => withStorage(storage => {
  const key = noteDraftKey(1, 100);
  writeNoteDraft(key, makeDraft(1));
  assert.equal(readNoteDraft(key, 2), null);
  assert.equal(storage.getItem(key), null);
  for (const value of [
    { ...makeDraft(1), savedAt: Date.now() - TTL - 60_000 },
    { ...makeDraft(1), savedAt: 'ontem' },
    { ...makeDraft(1), savedAt: Date.now(), form: null },
    { ...makeDraft(1), savedAt: Date.now(), form: { title: '', content: '', items: [{ id: 1, text: 'Item', checked: false }] } },
    { ...makeDraft(1), savedAt: Date.now(), form: { title: '', content: '', items: [{ id: 'a', text: 'Item', checked: 'false' }] } },
  ]) {
    storage.setItem(key, JSON.stringify(value));
    assert.equal(readNoteDraft(key, 1), null);
    assert.equal(storage.getItem(key), null);
  }
  storage.setItem(key, '{json quebrado');
  assert.equal(readNoteDraft(key, 1), null);
}));

test('rascunhos: renovar a sessão da mesma pessoa conserva só os rascunhos válidos', () => withStorage(storage => {
  prepareNoteDraftUser(1);
  const validKey = noteDraftKey(1, 100);
  const expiredKey = noteDraftKey(1, 101);
  const malformedKey = noteDraftKey(1, 102);
  const wrongUserKey = noteDraftKey(2, 100);
  writeNoteDraft(validKey, makeDraft(1));
  storage.setItem(expiredKey, JSON.stringify({ ...makeDraft(1), savedAt: Date.now() - TTL - 60_000 }));
  storage.setItem(malformedKey, 'invalid');
  writeNoteDraft(wrongUserKey, makeDraft(2));
  storage.setItem('outra-funcionalidade', 'preservar');
  prepareNoteDraftUser(1);
  assert.deepEqual(readNoteDraft(validKey, 1).form, makeDraft(1).form);
  for (const key of [expiredKey, malformedKey, wrongUserKey]) assert.equal(storage.getItem(key), null);
  assert.equal(storage.getItem('outra-funcionalidade'), 'preservar');
}));

test('rascunhos: trocar de conta ou sair apaga rascunhos sem apagar dados de outras funcionalidades', () => withStorage(storage => {
  prepareNoteDraftUser(1);
  const firstKey = noteDraftKey(1, 100);
  writeNoteDraft(firstKey, makeDraft(1));
  storage.setItem('outra-funcionalidade', 'preservar');
  prepareNoteDraftUser(2);
  assert.equal(storage.getItem(firstKey), null);
  assert.equal(readNoteDraft(firstKey, 2), null);
  const secondKey = noteDraftKey(2, 200);
  writeNoteDraft(secondKey, makeDraft(2, { noteId: 200 }));
  clearNoteDrafts();
  assert.equal(storage.getItem(secondKey), null);
  assert.equal(storage.getItem('motive.note-draft-user'), null);
  assert.equal(storage.getItem('outra-funcionalidade'), 'preservar');
}));

test('rascunhos: armazenamento bloqueado não derruba o editor e informa falha de persistência', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() { throw new Error('Storage indisponível'); } });
  try {
    const key = noteDraftKey(1, 100);
    assert.equal(writeNoteDraft(key, makeDraft(1)), false);
    assert.equal(readNoteDraft(key, 1), null);
    assert.doesNotThrow(() => prepareNoteDraftUser(1));
    assert.doesNotThrow(() => removeNoteDraft(key));
    assert.doesNotThrow(() => clearNoteDrafts());
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'sessionStorage', descriptor);
    else delete globalThis.sessionStorage;
  }
});
