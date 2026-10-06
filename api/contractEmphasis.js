import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const isWord = (node, localName) => node?.namespaceURI === WORD_NS && node.localName === localName;
const closestParagraph = node => {
  for (let parent = node.parentNode; parent; parent = parent.parentNode) if (isWord(parent, 'p')) return parent;
  return null;
};

function boldRun(run, document) {
  let properties = [...run.childNodes].find(node => isWord(node, 'rPr'));
  if (!properties) {
    properties = document.createElementNS(WORD_NS, 'w:rPr');
    run.insertBefore(properties, run.firstChild);
  }
  for (const node of [...properties.childNodes]) if (isWord(node, 'b') || isWord(node, 'bCs')) properties.removeChild(node);
  const before = [...properties.childNodes].find(node => !isWord(node, 'rStyle') && !isWord(node, 'rFonts')) || null;
  for (const tag of ['b', 'bCs']) properties.insertBefore(document.createElementNS(WORD_NS, `w:${tag}`), before);
}

// Operates on the generated text, including values split over several Word runs.
// Only matching fragments are split; fonts, colors, shapes and paragraph layout stay intact.
export function emphasizeContractXml(xml, tokens) {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const terms = [...new Set(tokens.filter(Boolean))].sort((a, b) => b.length - a.length);
  let changed = false;
  for (const paragraph of [...document.getElementsByTagNameNS(WORD_NS, 'p')]) {
    const runs = [...paragraph.getElementsByTagNameNS(WORD_NS, 'r')].filter(run => closestParagraph(run) === paragraph);
    const texts = [];
    let content = '';
    for (const run of runs) for (const node of [...run.childNodes]) {
      if (isWord(node, 't')) {
        texts.push({ run, node, start: content.length, end: content.length + node.textContent.length });
        content += node.textContent;
      } else if (isWord(node, 'br')) content += '\n';
      else if (isWord(node, 'tab')) content += '\t';
    }
    const ranges = [];
    for (const term of terms) {
      let index = content.indexOf(term);
      while (index !== -1) {
        const end = index + term.length;
        if (!/[\p{L}\p{N}]/u.test(content[index - 1] || '') && !/[\p{L}\p{N}]/u.test(content[end] || '')) ranges.push([index, end]);
        index = content.indexOf(term, end);
      }
    }
    // Also handles a registry number pasted in the complete legal description.
    for (const match of content.matchAll(/matr[ií]cula\s*(?:n(?:[º°o.]|[uú]mero)?\s*[:.]?\s*)?([0-9][\d.\/-]*|\[matricula\])/gi)) {
      const start = match.index + match[0].lastIndexOf(match[1]);
      ranges.push([start, start + match[1].length]);
    }
    for (const run of runs) {
      const entries = texts.filter(entry => entry.run === run);
      if (!entries.some(entry => ranges.some(([start, end]) => start < entry.end && end > entry.start))) continue;
      const properties = [...run.childNodes].find(node => isWord(node, 'rPr'));
      const cloneRun = () => {
        const clone = run.cloneNode(false);
        if (properties) clone.appendChild(properties.cloneNode(true));
        return clone;
      };
      for (const child of [...run.childNodes]) {
        if (isWord(child, 'rPr')) continue;
        const entry = entries.find(item => item.node === child);
        if (!entry) {
          const clone = cloneRun();
          clone.appendChild(child.cloneNode(true));
          run.parentNode.insertBefore(clone, run);
          continue;
        }
        const cuts = new Set([entry.start, entry.end]);
        for (const [start, end] of ranges) {
          if (start > entry.start && start < entry.end) cuts.add(start);
          if (end > entry.start && end < entry.end) cuts.add(end);
        }
        const points = [...cuts].sort((a, b) => a - b);
        for (let i = 0; i < points.length - 1; i++) {
          const start = points[i], end = points[i + 1];
          const clone = cloneRun();
          const text = child.cloneNode(false);
          text.setAttributeNS(XML_NS, 'xml:space', 'preserve');
          text.appendChild(document.createTextNode(content.slice(start, end)));
          clone.appendChild(text);
          if (ranges.some(([from, to]) => start >= from && end <= to)) boldRun(clone, document);
          run.parentNode.insertBefore(clone, run);
        }
      }
      run.parentNode.removeChild(run);
      changed = true;
    }
  }
  return changed ? new XMLSerializer().serializeToString(document) : xml;
}

export function emphasizeContract(zip, data, fields) {
  const tokens = [
    ...data.vendedores.map(person => person.nome.toUpperCase()),
    ...data.compradores.map(person => person.nome.toUpperCase()),
    ...Object.entries(fields).filter(([key]) => /^VALOR_|^EXTENSO_(?!PRAZO)/.test(key)).map(([, value]) => value),
  ];
  for (const name of Object.keys(zip.files).filter(name => /^word\/.*\.xml$/.test(name))) {
    const original = zip.file(name).asText();
    if (!original.includes('<w:t')) continue;
    const result = emphasizeContractXml(original, tokens);
    if (result !== original) zip.file(name, result);
  }
}
