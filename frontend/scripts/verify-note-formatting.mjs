import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { NoteTaskList, NoteTaskItem } from '../src/components/notes/noteTaskExtensions.js';
import { encodeNoteDocument, noteContentText, parseNoteDocument, plainNoteDocument, NOTE_DOCUMENT_PREFIX } from '../src/utils/noteContent.js';
import { noteData } from '../../api/noteAccess.js';

test('texto antigo preserva linhas e caracteres literais sem interpretar HTML', () => {
  const value = 'Antes\n\n<script>alert(1)</script> & depois';
  assert.equal(noteContentText(encodeNoteDocument(plainNoteDocument(value))), value);
  assert.equal(parseNoteDocument(value), null);
});

test('documentos inválidos, marcas executáveis e limites são rejeitados no servidor', () => {
  const previous = { kind: 'TEXT', title: 'Nota', content: '', items: [] };
  for (const document of [
    { type: 'script', content: [] },
    { type: 'doc', content: [{ type: 'image', attrs: { src: 'javascript:alert(1)' } }] },
    { type: 'doc', content: [{ type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
  ]) assert.throws(() => noteData({ content: NOTE_DOCUMENT_PREFIX + JSON.stringify(document) }, previous));
  assert.throws(() => noteData({ content: encodeNoteDocument(plainNoteDocument('x'.repeat(20001))) }, previous));
  assert.equal(encodeNoteDocument({ type: 'doc', content: [{ type: 'paragraph' }] }), '');
});

test('editor real preserva negrito, listas e caixas ao salvar/reabrir e busca inclui texto', () => {
  const dom = new JSDOM('<html><body></body></html>');
  const descriptors = new Map();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, requestAnimationFrame: () => 0 })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const options = { extensions: [StarterKit.configure({ heading: false, code: false, codeBlock: false, blockquote: false, horizontalRule: false, link: false }), NoteTaskList, NoteTaskItem] };
  let editor, reopened;
  try {
    editor = new Editor({ ...options, content: plainNoteDocument('Matrícula e documentação') });
    editor.commands.selectAll(); editor.commands.toggleBold();
    assert.match(editor.getHTML(), /<strong>/);
    editor.commands.toggleBulletList();
    assert.match(editor.getHTML(), /<ul>/);
    editor.commands.setTextSelection(3);
    editor.commands.toggleTaskList();
    assert.equal(editor.getJSON().content[0].content.length, 1, JSON.stringify(editor.getJSON()));
    assert.match(editor.getHTML(), /type="checkbox"/);
    const checkbox = editor.view.dom.querySelector('input[type=checkbox]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    const content = encodeNoteDocument(editor.getJSON());
    const data = noteData({ content }, { kind: 'TEXT', title: '', content: '', items: [] });
    assert.match(data.searchText, /matricula e documentacao/);
    assert.doesNotMatch(data.searchText, /MOTIVE_NOTE|taskItem|checked/);
    reopened = new Editor({ ...options, content: plainNoteDocument(content), editable: false });
    assert.match(reopened.getHTML(), /<strong>/);
    assert.equal(reopened.getJSON().content[0].content[0].attrs.checked, true);
    assert.equal(noteContentText(content).trimEnd(), 'Matrícula e documentação');
    assert.equal(reopened.isEditable, false);
    const liveItem = editor.view.dom.querySelector('li[data-type=taskItem]');
    assert.ok(liveItem, 'O node view precisa do atributo usado para alinhar caixa e texto na mesma linha.');
    assert.ok(liveItem.querySelector(':scope > label > input[type=checkbox]'));
    assert.ok(liveItem.querySelector(':scope > div > p'));
    const completed = editor.view.dom.querySelector('.note-task-completed');
    assert.match(completed.textContent, /1 item concluído/);
    completed.click();
    assert.equal(completed.getAttribute('aria-expanded'), 'false');
    assert.ok(editor.view.dom.querySelector('.note-task-collapsed'));
    editor.view.dom.querySelector('.note-task-add').click();
    const pending = editor.getJSON().content[0].content;
    assert.equal(pending.length, 2);
    assert.equal(pending[0].attrs.checked, false);
    assert.equal(pending[1].attrs.checked, true);
    editor.view.dom.querySelector('.note-task-remove').click();
    assert.equal(editor.getJSON().content[0].content.length, 1);
  } finally {
    editor?.destroy(); reopened?.destroy(); dom.window.close();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
