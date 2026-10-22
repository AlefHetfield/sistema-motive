export const NOTE_DOCUMENT_PREFIX = '\u001eMOTIVE_NOTE_V1:';
const types = new Set(['doc', 'paragraph', 'text', 'hardBreak', 'bulletList', 'orderedList', 'listItem', 'taskList', 'taskItem']);
const marks = new Set(['bold', 'italic', 'strike', 'underline']);

export function parseNoteDocument(content) {
  if (!content.startsWith(NOTE_DOCUMENT_PREFIX)) return null;
  let count = 0;
  const clean = (node, depth = 0) => {
    if (!node || typeof node !== 'object' || !types.has(node.type) || depth > 20 || ++count > 5000) throw new Error('Documento de nota inválido.');
    const result = { type: node.type };
    if (node.type === 'text') {
      if (typeof node.text !== 'string' || !node.text) throw new Error('Texto de nota inválido.');
      result.text = node.text;
      if (node.marks?.length) {
        if (!Array.isArray(node.marks) || node.marks.some(mark => !marks.has(mark?.type))) throw new Error('Formatação de nota inválida.');
        result.marks = node.marks.map(mark => ({ type: mark.type }));
      }
    } else if (node.content !== undefined) {
      if (!Array.isArray(node.content)) throw new Error('Documento de nota inválido.');
      result.content = node.content.map(child => clean(child, depth + 1));
    }
    if (node.type === 'taskItem') result.attrs = { checked: node.attrs?.checked === true };
    if (node.type === 'orderedList') {
      const start = node.attrs?.start ?? 1;
      if (!Number.isInteger(start) || start < 1 || start > 1000000) throw new Error('Numeração inválida.');
      result.attrs = { start };
    }
    return result;
  };
  const document = clean(JSON.parse(content.slice(NOTE_DOCUMENT_PREFIX.length)));
  if (document.type !== 'doc') throw new Error('Documento de nota inválido.');
  return document;
}

export function plainNoteDocument(content) {
  return parseNoteDocument(content) || { type: 'doc', content: content.split('\n').map(line => ({ type: 'paragraph', ...(line ? { content: [{ type: 'text', text: line }] } : {}) })) };
}

export function noteContentText(content = '') {
  const document = parseNoteDocument(content);
  if (!document) return content;
  const text = node => node.type === 'text' ? node.text : node.type === 'hardBreak' ? '\n'
    : (node.content || []).map(text).join(['doc', 'bulletList', 'orderedList', 'taskList', 'listItem', 'taskItem'].includes(node.type) ? '\n' : '');
  return text(document);
}

export function encodeNoteDocument(document) {
  const raw = NOTE_DOCUMENT_PREFIX + JSON.stringify(document);
  const sanitized = parseNoteDocument(raw);
  if (!noteContentText(raw).trim()) return '';
  return NOTE_DOCUMENT_PREFIX + JSON.stringify(sanitized);
}
