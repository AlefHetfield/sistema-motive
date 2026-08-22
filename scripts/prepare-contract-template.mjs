import fs from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const [, , sourceArg, outputArg] = process.argv;

if (!sourceArg || !outputArg) {
  console.error('Uso: node scripts/prepare-contract-template.mjs <origem.docx> <destino.docx>');
  process.exit(1);
}

const source = path.resolve(sourceArg);
const output = path.resolve(outputArg);
const markers = [
  'PARAGRAFO_VENDEDOR',
  'PARAGRAFO_COMPRADOR',
  'PARAGRAFO_IMOVEL',
  'NOME_VENDEDOR',
  'NOME_SEGUNDO_VENDEDOR',
  'NOME_COMPRADOR',
  'NOME_SEGUNDO_COMPRADOR',
  'VALOR_DO_IMOVEL',
  'EXTENSO_VALOR_DO_IMOVEL',
  'VALOR_SINAL',
  'EXTENSO_SINAL',
  'VALOR_FGTS',
  'EXTENSO_FGTS',
  'VALOR_RECURSOS',
  'EXTENSO_RECURSOS',
  'VALOR_FINANCIAMENTO',
  'EXTENSO_FINANCIAMENTO',
  'NOME_BANCO',
  'DATA_ATUAL',
].sort((a, b) => b.length - a.length);
const additionalTags = ['VALOR_DOCUMENTACAO', 'EXTENSO_DOCUMENTACAO', 'PRAZO_DIAS', 'EXTENSO_PRAZO_DIAS'];
const allTags = [...markers, ...additionalTags];

const zip = new PizZip(fs.readFileSync(source));
const documentXml = zip.file('word/document.xml')?.asText();

if (!documentXml) {
  throw new Error('O arquivo não possui word/document.xml.');
}

const xmlDocument = new DOMParser().parseFromString(documentXml, 'application/xml');
const paragraphs = Array.from(xmlDocument.getElementsByTagName('w:p'));
const replacementCounts = Object.fromEntries(markers.map(marker => [marker, 0]));
const replacementToken = marker => `@@MOTIVE_SLOT_${allTags.indexOf(marker)}@@`;

const closestParagraph = (node) => {
  let current = node.parentNode;
  while (current && current.nodeType === 1) {
    if (current.nodeName === 'w:p') return current;
    current = current.parentNode;
  }
  return null;
};

const replaceTextInParagraph = (paragraph, search, replacement) => {
  const nodes = Array.from(paragraph.getElementsByTagName('w:t'))
    .filter(node => closestParagraph(node) === paragraph);
  const texts = nodes.map(node => node.textContent || '');
  const fullText = texts.join('');
  const startIndex = fullText.indexOf(search);
  if (startIndex === -1) return 0;
  const endIndex = startIndex + search.length;
  const starts = [];
  let cursor = 0;
  for (const text of texts) {
    starts.push(cursor);
    cursor += text.length;
  }
  const affected = texts
    .map((text, index) => ({ text, index, start: starts[index] }))
    .filter(item => item.start < endIndex && item.start + item.text.length > startIndex);
  if (!affected.length) return 0;
  const first = affected[0].index;
  const last = affected.at(-1).index;
  const before = texts[first].slice(0, Math.max(0, startIndex - starts[first]));
  const after = texts[last].slice(Math.max(0, endIndex - starts[last]));
  texts[first] = `${before}${replacement}${after}`;
  for (let index = first + 1; index <= last; index += 1) texts[index] = '';
  nodes.forEach((node, index) => { node.textContent = texts[index]; });
  return 1;
};

for (const paragraph of paragraphs) {
  const textNodes = Array.from(paragraph.getElementsByTagName('w:t'))
    .filter(node => closestParagraph(node) === paragraph);
  if (!textNodes.length) continue;

  for (const marker of markers) {
    let texts = textNodes.map(node => node.textContent || '');
    let fullText = texts.join('');
    let markerIndex = fullText.indexOf(marker);

    while (markerIndex !== -1) {
      const markerEnd = markerIndex + marker.length;
      const starts = [];
      let cursor = 0;
      for (const text of texts) {
        starts.push(cursor);
        cursor += text.length;
      }

      const affected = texts
        .map((text, index) => ({ text, index, start: starts[index] }))
        .filter(item => item.start < markerEnd && item.start + item.text.length > markerIndex);

      if (!affected.length) break;
      const first = affected[0].index;
      const last = affected.at(-1).index;
      const before = texts[first].slice(0, Math.max(0, markerIndex - starts[first]));
      const after = texts[last].slice(Math.max(0, markerEnd - starts[last]));
      const token = replacementToken(marker);
      texts[first] = `${before}${token}${after}`;
      for (let index = first + 1; index <= last; index += 1) texts[index] = '';
      replacementCounts[marker] += 1;
      fullText = texts.join('');
      markerIndex = fullText.indexOf(marker, markerIndex + token.length);
    }

    textNodes.forEach((node, index) => {
      node.textContent = texts[index];
    });
  }
}
const missingMarkers = markers.filter(marker => replacementCounts[marker] === 0);
if (missingMarkers.length) throw new Error(`Marcadores ausentes no modelo: ${missingMarkers.join(', ')}`);

let documentationSlots = 0;
let deadlineSlots = 0;
for (const paragraph of paragraphs) {
  const paragraphText = Array.from(paragraph.getElementsByTagName('w:t'))
    .filter(node => closestParagraph(node) === paragraph)
    .map(node => node.textContent || '')
    .join('');
  if (paragraphText.includes('será reservado o valor')) {
    documentationSlots += replaceTextInParagraph(paragraph, 'R$10.000', replacementToken('VALOR_DOCUMENTACAO'));
    documentationSlots += replaceTextInParagraph(paragraph, 'dez mil reais', replacementToken('EXTENSO_DOCUMENTACAO'));
  }
  if (paragraphText.includes('com vencimento máximo em até')) {
    deadlineSlots += replaceTextInParagraph(paragraph, 'cento e vinte', replacementToken('EXTENSO_PRAZO_DIAS'));
    deadlineSlots += replaceTextInParagraph(paragraph, '120', replacementToken('PRAZO_DIAS'));
  }
}
if (documentationSlots !== 2 || deadlineSlots !== 2) {
  throw new Error('Não foi possível preparar os campos de documentação e prazo.');
}

let preparedDocumentXml = new XMLSerializer().serializeToString(xmlDocument);
for (const marker of allTags) {
  preparedDocumentXml = preparedDocumentXml.replaceAll(replacementToken(marker), `{${marker}}`);
}
zip.file('word/document.xml', preparedDocumentXml);

const corePath = 'docProps/core.xml';
const coreXml = zip.file(corePath)?.asText();
if (coreXml) {
  zip.file(
    corePath,
    coreXml
      .replace(/<dc:creator[^>]*>[\s\S]*?<\/dc:creator>/g, '<dc:creator></dc:creator>')
      .replace(/<cp:lastModifiedBy[^>]*>[\s\S]*?<\/cp:lastModifiedBy>/g, '<cp:lastModifiedBy></cp:lastModifiedBy>'),
  );
}

for (const fileName of Object.keys(zip.files)) {
  if (!/^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/.test(fileName)) continue;
  const xml = zip.file(fileName)?.asText();
  if (xml) zip.file(fileName, xml.replace(/\s+w:rsid[A-Za-z]*="[^"]*"/g, ''));
}

const settingsPath = 'word/settings.xml';
const settingsXml = zip.file(settingsPath)?.asText();
if (settingsXml) {
  zip.file(settingsPath, settingsXml.replace(/<w:attachedTemplate\b[^>]*\/?\s*>/g, ''));
}

const settingsRelsPath = 'word/_rels/settings.xml.rels';
const settingsRels = zip.file(settingsRelsPath)?.asText();
if (settingsRels) {
  zip.file(
    settingsRelsPath,
    settingsRels.replace(/<Relationship\b[^>]*Type="[^"]*\/attachedTemplate"[^>]*\/?\s*>/g, ''),
  );
}

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));

console.log(`Modelo preparado: ${output}`);
