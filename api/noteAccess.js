import { noteContentText } from '../frontend/src/utils/noteContent.js';
// Notes have their own access boundary. An administrator never bypasses it.
export const NOTE_COLORS = ['default', 'yellow', 'green', 'blue', 'pink', 'purple'];
export const noteFail = (message, status = 400, code = 'VALIDATION_ERROR') => Object.assign(new Error(message), { status, code });

export function noteId(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) > 2147483647) {
    throw noteFail('Identificador ou versão inválida.');
  }
  return Number(value);
}

export function normalizedNoteText(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();
}

export function noteScope(userId) {
  return { OR: [{ ownerId: userId }, { deletedAt: null, access: { some: { userId } } }] };
}

export function effectiveNoteRole(note, userId) {
  if (note.ownerId === userId) return 'OWNER';
  if (note.deletedAt) return null;
  return note.access.find(entry => entry.userId === userId)?.role ?? null;
}

export function assertNoteAccess(note, userId, permission = 'read') {
  const role = note && effectiveNoteRole(note, userId);
  if (!role) throw noteFail('Nota não encontrada.', 404, 'NOT_FOUND');
  if (permission === 'owner' && role !== 'OWNER') throw noteFail('Somente o dono pode realizar esta ação.', 403, 'FORBIDDEN');
  if (permission === 'edit' && role === 'VIEWER') throw noteFail('Você tem permissão apenas para visualizar esta nota.', 403, 'FORBIDDEN');
  return role;
}

export function assertNoteVersion(actual, requested) {
  if (actual !== noteId(requested)) throw noteFail('A nota mudou. Carregue a versão atual antes de salvar novamente.', 409, 'VERSION_CONFLICT');
}

export function assertNoteActive(note) {
  if (note.deletedAt) throw noteFail('Restaure a nota da lixeira antes de realizar esta ação.', 409, 'NOTE_IN_TRASH');
}

export function strictNoteBody(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw noteFail('Dados inválidos.');
  if (Object.keys(body).some(key => !allowed.includes(key))) throw noteFail('A requisição contém campos não permitidos.');
  return body;
}

export function noteData(body, previous = null) {
  const data = {};
  const creating = !previous;
  if (creating) {
    if (!['TEXT', 'CHECKLIST'].includes(body.kind)) throw noteFail('Tipo de nota inválido.');
    if (typeof body.clientMutationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.clientMutationId)) {
      throw noteFail('Informe uma chave UUID válida para criar a nota.');
    }
    data.kind = body.kind;
    data.clientMutationId = body.clientMutationId.toLowerCase();
  }
  if (creating || body.title !== undefined) {
    const title = body.title === undefined ? '' : body.title;
    if (typeof title !== 'string' || title.length > 250) throw noteFail('O título deve ter até 250 caracteres.');
    data.title = title;
  }
  if (creating || body.content !== undefined) {
    const content = body.content === undefined ? '' : body.content;
    if (typeof content !== 'string' || content.length > 100000) throw noteFail('O texto ou sua formatação ultrapassa o limite permitido.');
    try {
      if (noteContentText(content).length > 20000) throw new Error('Texto longo.');
    } catch { throw noteFail('Use um documento válido com até 20.000 caracteres de texto.'); }
    data.content = content;
  }
  if (creating || body.items !== undefined) {
    const items = body.items === undefined ? [] : body.items;
    if (!Array.isArray(items) || items.length > 100) throw noteFail('Use no máximo 100 itens na lista.');
    const ids = new Set();
    data.items = items.map(item => {
      strictNoteBody(item, ['id', 'text', 'checked']);
      if (typeof item.id !== 'string' || !item.id.trim() || item.id.length > 80 || ids.has(item.id) || typeof item.text !== 'string' || item.text.length > 500 || typeof item.checked !== 'boolean') {
        throw noteFail('Os itens devem ter IDs únicos, texto de até 500 caracteres e estado de conclusão válido.');
      }
      ids.add(item.id);
      return { id: item.id, text: item.text, checked: item.checked };
    });
  }
  const merged = { ...previous, ...data };
  if (merged.kind === 'TEXT' && merged.items.length) throw noteFail('Notas de texto não podem ter itens de checklist.');
  if (!merged.title.trim() && !noteContentText(merged.content).trim() && !merged.items.some(item => item.text.trim())) throw noteFail('Preencha o título, o texto ou um item antes de salvar.');
  data.searchText = normalizedNoteText([merged.title, noteContentText(merged.content), ...merged.items.map(item => item.text)].join('\n'));
  return data;
}

export function noteInclude(userId) {
  return {
    owner: { select: { id: true, nome: true } },
    access: { include: { user: { select: { id: true, nome: true, isActive: true } } }, orderBy: { userId: 'asc' } },
    states: { where: { userId } },
    labelAssignments: { where: { label: { ownerId: userId } }, include: { label: { select: { id: true, name: true } } }, orderBy: { labelId: 'asc' } },
  };
}

export function presentNote(note, userId) {
  const state = note.states[0];
  return {
    id: note.id, ownerId: note.ownerId, title: note.title, content: note.content,
    kind: note.kind, items: note.items, version: note.version, deletedAt: note.deletedAt,
    createdAt: note.createdAt, updatedAt: note.updatedAt, owner: note.owner,
    role: effectiveNoteRole(note, userId),
    access: note.access.map(({ userId: id, role, user }) => ({ userId: id, role, user })),
    state: state ? { color: state.color, isPinned: state.isPinned, archivedAt: state.archivedAt, hiddenAt: state.hiddenAt, version: state.version }
      : { color: 'default', isPinned: false, archivedAt: null, hiddenAt: null, version: 1 },
    labels: note.labelAssignments.map(entry => entry.label),
  };
}

// Call inside a transaction before re-reading access. All existing-note writes
// use this same lock, including personal preferences and access revocation.
export async function lockNote(tx, id) {
  await tx.$queryRaw`SELECT "id" FROM "public"."notes" WHERE "id" = ${id} FOR UPDATE`;
}

// Personal label operations acquire this lock BEFORE any Note lock, allowing a
// label deletion to lock every affected note in ID order without racing a new
// assignment to that label. Access revocation only removes assignments.
export async function lockNoteLabels(tx, userId) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(602217, ${userId}::integer)::text`;
}
