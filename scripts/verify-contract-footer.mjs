import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import PizZip from 'pizzip';
import { DOMParser } from '@xmldom/xmldom';

const filename = 'assets/templates/contrato-motive-v1.docx';
const current = new PizZip(fs.readFileSync(filename));
const previous = new PizZip(execFileSync('git', ['show', `HEAD:${filename}`], { maxBuffer: 1024 * 1024 }));
test('only first-page footer changed in the template', () => {
  for (const name of Object.keys(previous.files).filter(name => !previous.files[name].dir)) {
    if (name === 'word/footer2.xml') continue;
    assert.deepEqual(current.file(name).asUint8Array(), previous.file(name).asUint8Array(), name);
  }
});
test('contact footer has fixed columns, preserved content and no floating shapes', () => {
  const xml = current.file('word/footer2.xml').asText();
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  assert.equal(document.getElementsByTagName('w:tbl').length, 1);
  assert.equal(document.getElementsByTagName('w:tc').length, 4);
  assert.match(xml, /w:tblLayout w:type="fixed"/);
  assert.doesNotMatch(xml, /wp:anchor|w:txbxContent|v:rect/);
  const text = [...document.getElementsByTagName('w:t')].map(node => node.textContent).join(' ');
  for (const value of ['Rua Justino França, 454', '13170-050', 'Sumaré/SP', '(19) 98293-8955', 'motiveimoveis@gmail.com', 'motiveimoveis.com', 'MOTIVE CONSULTORIA', 'IMOBILIÁRIA', '43789J']) assert.ok(text.includes(value), value);
});
