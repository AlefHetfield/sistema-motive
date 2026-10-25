import express from 'express';
import { readNoteSnapshot } from './noteRead.js';
import {
  NOTE_COLORS, noteFail as fail, noteId as id, normalizedNoteText, noteScope,
  assertNoteAccess, assertNoteVersion, assertNoteActive, strictNoteBody,
  noteData, noteInclude, presentNote, lockNote, lockNoteLabels,
} from './noteAccess.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const userSelect = { id: true, nome: true, isActive: true };

function allowedOrigin(req) {
  const raw = req.get('Origin');
  // The real application authenticates with a cross-site production cookie.
  // A missing Origin is accepted only for non-cookie integrations/tests.
  if (!raw) return !req.cookies?.motive_session && !req.get('Cookie');
  let origin;
  try { origin = new URL(raw); } catch { return false; }
  if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== raw) return false;
  const configured = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(value => value.trim());
  return configured.includes(origin.origin) || origin.host === req.get('Host');
}

function privateRouter(prisma, requireAuth) {
  const router = express.Router();
  router.use((_req, res, next) => {
    const started = performance.now();
    const writeHead = res.writeHead;
    res.writeHead = function (...args) {
      this.setHeader('Server-Timing', `notes;dur=${(performance.now() - started).toFixed(1)}`);
      return writeHead.apply(this, args);
    };
    res.set('Cache-Control', 'private, no-store'); next();
  });
  router.use(requireAuth);
  router.use(async (req, _res, next) => {
    try {
      let userId;
      try { userId = id(req.user?.id); } catch { throw fail('Sessão inválida. Entre novamente.', 401, 'UNAUTHENTICATED'); }
      const user = await prisma.user.findUnique({ where: { id: userId }, select: userSelect });
      if (!user?.isActive) throw fail('Sessão inválida. Entre novamente.', 401, 'UNAUTHENTICATED');
      req.noteUser = user;
      if (MUTATING_METHODS.has(req.method) && !allowedOrigin(req)) throw fail('Origem da requisição não permitida.', 403, 'ORIGIN_NOT_ALLOWED');
      next();
    } catch (error) { next(error); }
  });
  return router;
}

function handleErrors(router) {
  router.use((error, _req, res, _next) => {
    if (error.status) return res.status(error.status).json({ error: error.message, code: error.code || 'VALIDATION_ERROR' });
    if (error.code === 'P2002') return res.status(409).json({ error: 'Já existe um marcador com este nome.', code: 'LABEL_EXISTS' });
    if (error.code === 'P2034') return res.status(409).json({ error: 'Os dados mudaram. Atualize antes de tentar novamente.', code: 'VERSION_CONFLICT' });
    // Never log request bodies, content, or SQL parameters from personal notes.
    return res.status(500).json({ error: 'Não foi possível concluir a operação de notas.', code: 'NOTES_UNAVAILABLE' });
  });
  return router;
}

async function readNote(tx, noteId, userId, permission = 'read') {
  const note = await readNoteSnapshot(tx, noteId, userId);
  assertNoteAccess(note, userId, permission);
  return note;
}

async function readForMutation(tx, noteId, userId, kind, permission = 'read') {
  // Authorization still runs after the shared row lock. Presentation relations
  // are loaded only once, after the write, rather than twice per action.
  const note = await tx.note.findUnique({ where: { id: noteId }, select: {
    id: true, ownerId: true, version: true, deletedAt: true,
    access: { ...(kind === 'access' ? {} : { where: { userId } }), select: { userId: true, role: true } },
    ...(kind === 'content' ? { title: true, content: true, items: true, kind: true } : {}),
    ...(kind === 'state' ? { states: { where: { userId }, select: { version: true, archivedAt: true, hiddenAt: true } } } : {}),
  } });
  assertNoteAccess(note, userId, permission);
  return note;
}

async function mutateNote(prisma, noteId, userId, callback, { labels = false, kind = 'content' } = {}) {
  return prisma.$transaction(async tx => {
    if (labels) await lockNoteLabels(tx, userId);
    await lockNote(tx, noteId);
    const note = await readForMutation(tx, noteId, userId, kind);
    await callback(tx, note);
    return presentNote(await readNote(tx, noteId, userId), userId);
  }, { maxWait: 10000, timeout: 15000 });
}

function positiveQuery(value, fallback, max) {
  if (value === undefined) return fallback;
  const parsed = id(value);
  if (parsed > max) throw fail('Paginação inválida.');
  return parsed;
}

export function createNoteRouter(prisma, requireAuth) {
  const router = privateRouter(prisma, requireAuth);

  router.get('/share-options', async (req, res) => {
    const q = req.query.q ?? '';
    if (typeof q !== 'string' || q.length > 100) throw fail('Pesquisa de pessoas inválida.');
    res.json(await prisma.user.findMany({
      where: { isActive: true, id: { not: req.noteUser.id }, ...(q.trim() ? { nome: { contains: q.trim(), mode: 'insensitive' } } : {}) },
      select: { id: true, nome: true }, orderBy: [{ nome: 'asc' }, { id: 'asc' }], take: 40,
    }));
  });

  router.get('/', async (req, res) => {
    const userId = req.noteUser.id;
    const { scope = 'all', view = 'active', color, labelId, q = '' } = req.query;
    if (!['all', 'mine', 'shared'].includes(scope) || !['active', 'archived', 'hidden', 'trash'].includes(view)) throw fail('Filtro de notas inválido.');
    if (color !== undefined && !NOTE_COLORS.includes(color)) throw fail('Cor inválida.');
    if (typeof q !== 'string' || q.length > 250) throw fail('A busca deve ter até 250 caracteres.');
    const page = positiveQuery(req.query.page, 1, 1000000);
    const pageSize = positiveQuery(req.query.pageSize, 40, 100);
    const noteWhere = { AND: [noteScope(userId)] };
    if (scope === 'mine') noteWhere.AND.push({ ownerId: userId });
    if (scope === 'shared') noteWhere.AND.push({ ownerId: { not: userId }, access: { some: { userId } } });
    if (view === 'trash') noteWhere.AND.push({ ownerId: userId, deletedAt: { not: null } });
    else noteWhere.AND.push({ deletedAt: null });
    const search = normalizedNoteText(q);
    if (search) noteWhere.AND.push({ searchText: { contains: search } });
    if (labelId !== undefined) noteWhere.AND.push({ labelAssignments: { some: { labelId: id(labelId), label: { ownerId: userId } } } });
    const where = {
      userId, note: noteWhere,
      ...(color ? { color } : {}),
      ...(view === 'active' ? { archivedAt: null, hiddenAt: null } : {}),
      ...(view === 'archived' ? { archivedAt: { not: null }, hiddenAt: null } : {}),
      ...(view === 'hidden' ? { hiddenAt: { not: null } } : {}),
    };
    const orderBy = [...(view === 'active' ? [{ isPinned: 'desc' }] : []), { note: { updatedAt: 'desc' } }, { noteId: 'desc' }];
    const [states, total] = await prisma.$transaction([
      prisma.noteUserState.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, include: { note: { include: noteInclude(userId) } } }),
      prisma.noteUserState.count({ where }),
    ], { isolationLevel: 'RepeatableRead' });
    res.json({ notes: states.map(state => presentNote(state.note, userId)), total, page, pageSize });
  });

  router.post('/', async (req, res) => {
    strictNoteBody(req.body, ['clientMutationId', 'kind', 'title', 'content', 'items']);
    const data = noteData(req.body);
    const userId = req.noteUser.id;
    const result = await prisma.$transaction(async tx => {
      // Serialize duplicate creations before the unique key is inserted. A
      // retried request returns the already-saved note, even with stale text.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(602218, ${userId}::integer)::text`;
      const existing = await tx.note.findUnique({ where: { ownerId_clientMutationId: { ownerId: userId, clientMutationId: data.clientMutationId } }, select: { id: true } });
      if (existing) return { note: presentNote(await readNote(tx, existing.id, userId), userId), created: false };
      const team = await tx.user.findMany({ where: { isActive: true, id: { not: userId } }, select: { id: true } });
      const note = await tx.note.create({
        data: {
          ...data, ownerId: userId,
          ...(team.length ? { access: { createMany: { data: team.map(user => ({ userId: user.id, role: 'EDITOR' })) } } } : {}),
          states: { createMany: { data: [userId, ...team.map(user => user.id)].map(id => ({ userId: id })) } },
        },
        select: { id: true },
      });
      return { note: presentNote(await readNote(tx, note.id, userId), userId), created: true };
    });
    res.status(result.created ? 201 : 200).json(result.note);
  });

  router.get('/:id', async (req, res) => {
    res.json(presentNote(await readNote(prisma, id(req.params.id), req.noteUser.id), req.noteUser.id));
  });

  router.patch('/:id', async (req, res) => {
    strictNoteBody(req.body, ['version', 'title', 'content', 'items']);
    const version = id(req.body.version);
    if (!['title', 'content', 'items'].some(key => req.body[key] !== undefined)) throw fail('Informe uma alteração para salvar.');
    res.json(await mutateNote(prisma, id(req.params.id), req.noteUser.id, async (tx, note) => {
      assertNoteAccess(note, req.noteUser.id, 'edit');
      assertNoteActive(note);
      assertNoteVersion(note.version, version);
      await tx.note.update({ where: { id: note.id }, data: { ...noteData(req.body, note), version: { increment: 1 } } });
    }));
  });

  router.patch('/:id/state', async (req, res) => {
    strictNoteBody(req.body, ['version', 'color', 'isPinned', 'archived', 'hidden', 'labelIds']);
    const version = id(req.body.version);
    if (!['color', 'isPinned', 'archived', 'hidden', 'labelIds'].some(key => req.body[key] !== undefined)) throw fail('Informe uma preferência para salvar.');
    const data = {};
    if (req.body.color !== undefined) {
      if (!NOTE_COLORS.includes(req.body.color)) throw fail('Cor inválida.');
      data.color = req.body.color;
    }
    for (const field of ['isPinned', 'archived', 'hidden']) {
      if (req.body[field] !== undefined && typeof req.body[field] !== 'boolean') throw fail('Preferência inválida.');
    }
    if (req.body.isPinned !== undefined) data.isPinned = req.body.isPinned;
    const userId = req.noteUser.id;
    let labelIds;
    if (req.body.labelIds !== undefined) {
      if (!Array.isArray(req.body.labelIds) || req.body.labelIds.length > 10) throw fail('Use no máximo 10 marcadores por nota.');
      labelIds = req.body.labelIds.map(id);
      if (new Set(labelIds).size !== labelIds.length) throw fail('Marcadores repetidos.');
    }
    res.json(await mutateNote(prisma, id(req.params.id), userId, async (tx, note) => {
      assertNoteActive(note);
      const state = note.states[0];
      if (!state) throw fail('As preferências mudaram. Atualize a nota.', 409, 'VERSION_CONFLICT');
      assertNoteVersion(state.version, version);
      if (note.ownerId === userId && req.body.hidden === true) throw fail('O dono pode arquivar a nota; ocultar é uma opção dos participantes.', 403, 'FORBIDDEN');
      if (req.body.archived !== undefined) data.archivedAt = req.body.archived ? (state.archivedAt || new Date()) : null;
      if (req.body.hidden !== undefined) data.hiddenAt = req.body.hidden ? (state.hiddenAt || new Date()) : null;
      if (labelIds !== undefined) {
        const labels = await tx.noteLabel.findMany({ where: { ownerId: userId, id: { in: labelIds } }, select: { id: true } });
        if (labels.length !== labelIds.length) throw fail('Marcador não encontrado.', 404, 'NOT_FOUND');
        await tx.noteLabelAssignment.deleteMany({ where: { noteId: note.id, label: { ownerId: userId } } });
        if (labelIds.length) await tx.noteLabelAssignment.createMany({ data: labelIds.map(labelId => ({ noteId: note.id, labelId })) });
      }
      await tx.noteUserState.update({ where: { noteId_userId: { noteId: note.id, userId } }, data: { ...data, version: { increment: 1 } } });
    }, { labels: labelIds !== undefined, kind: 'state' }));
  });

  router.put('/:id/access', async (req, res) => {
    strictNoteBody(req.body, ['version', 'access']);
    const version = id(req.body.version), userId = req.noteUser.id;
    if (!Array.isArray(req.body.access) || req.body.access.length > 100) throw fail('Use no máximo 100 participantes.');
    const ids = new Set();
    const access = req.body.access.map(entry => {
      strictNoteBody(entry, ['userId', 'role']);
      const targetId = id(entry.userId);
      if (targetId === userId || ids.has(targetId) || !['VIEWER', 'EDITOR'].includes(entry.role)) throw fail('Participante ou permissão inválida.');
      ids.add(targetId);
      return { userId: targetId, role: entry.role };
    });
    res.json(await mutateNote(prisma, id(req.params.id), userId, async (tx, note) => {
      assertNoteAccess(note, userId, 'owner');
      assertNoteActive(note);
      assertNoteVersion(note.version, version);
      const users = await tx.user.findMany({ where: { id: { in: [...ids] } }, select: userSelect });
      if (users.length !== access.length || users.some(user => !user.isActive && !note.access.some(old => old.userId === user.id && old.role === access.find(entry => entry.userId === user.id).role))) {
        throw fail('Selecione pessoas ativas para compartilhar.');
      }
      const removed = note.access.filter(entry => !ids.has(entry.userId)).map(entry => entry.userId);
      if (removed.length) {
        await tx.noteLabelAssignment.deleteMany({ where: { noteId: note.id, label: { ownerId: { in: removed } } } });
        await tx.noteUserState.deleteMany({ where: { noteId: note.id, userId: { in: removed } } });
        await tx.noteAccess.deleteMany({ where: { noteId: note.id, userId: { in: removed } } });
      }
      for (const entry of access) {
        await tx.noteAccess.upsert({ where: { noteId_userId: { noteId: note.id, userId: entry.userId } }, create: { noteId: note.id, ...entry }, update: { role: entry.role } });
        await tx.noteUserState.upsert({ where: { noteId_userId: { noteId: note.id, userId: entry.userId } }, create: { noteId: note.id, userId: entry.userId }, update: {} });
      }
      await tx.note.update({ where: { id: note.id }, data: { version: { increment: 1 } } });
    }, { kind: 'access' }));
  });

  for (const action of ['trash', 'restore']) {
    router.post(`/:id/${action}`, async (req, res) => {
      strictNoteBody(req.body, ['version']);
      const version = id(req.body.version), userId = req.noteUser.id;
      res.json(await mutateNote(prisma, id(req.params.id), userId, async (tx, note) => {
        assertNoteAccess(note, userId, 'owner');
        assertNoteVersion(note.version, version);
        if (action === 'trash' && note.deletedAt) throw fail('A nota já está na lixeira.', 409, 'NOTE_IN_TRASH');
        if (action === 'restore' && !note.deletedAt) throw fail('A nota já foi restaurada.', 409, 'NOTE_NOT_IN_TRASH');
        await tx.note.update({ where: { id: note.id }, data: { deletedAt: action === 'trash' ? new Date() : null, version: { increment: 1 } } });
      }, { kind: 'lifecycle' }));
    });
  }

  router.delete('/:id', async (req, res) => {
    strictNoteBody(req.body, ['version']);
    const version = id(req.body.version), userId = req.noteUser.id, noteId = id(req.params.id);
    await prisma.$transaction(async tx => {
      await lockNote(tx, noteId);
      const note = await readForMutation(tx, noteId, userId, 'lifecycle', 'owner');
      assertNoteVersion(note.version, version);
      if (!note.deletedAt) throw fail('Envie a nota para a lixeira antes de excluir definitivamente.', 409, 'NOTE_NOT_IN_TRASH');
      await tx.note.delete({ where: { id: noteId } });
    });
    res.sendStatus(204);
  });

  return handleErrors(router);
}

function labelName(body) {
  strictNoteBody(body, ['name']);
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 50) throw fail('Informe um marcador de até 50 caracteres.');
  const name = body.name.trim();
  const normalizedName = normalizedNoteText(name);
  if (!normalizedName) throw fail('Informe um nome de marcador válido.');
  return { name, normalizedName };
}

export function createNoteLabelRouter(prisma, requireAuth) {
  const router = privateRouter(prisma, requireAuth);
  router.get('/', async (req, res) => {
    res.json(await prisma.noteLabel.findMany({ where: { ownerId: req.noteUser.id }, select: { id: true, name: true }, orderBy: [{ normalizedName: 'asc' }, { id: 'asc' }] }));
  });
  router.post('/', async (req, res) => {
    const data = labelName(req.body), userId = req.noteUser.id;
    const label = await prisma.$transaction(async tx => {
      await lockNoteLabels(tx, userId);
      if (await tx.noteLabel.count({ where: { ownerId: userId } }) >= 50) throw fail('Você pode criar até 50 marcadores.');
      return tx.noteLabel.create({ data: { ...data, ownerId: userId }, select: { id: true, name: true } });
    });
    res.status(201).json(label);
  });
  router.patch('/:id', async (req, res) => {
    const data = labelName(req.body), userId = req.noteUser.id, labelId = id(req.params.id);
    const label = await prisma.$transaction(async tx => {
      await lockNoteLabels(tx, userId);
      const owned = await tx.noteLabel.findFirst({ where: { id: labelId, ownerId: userId } });
      if (!owned) throw fail('Marcador não encontrado.', 404, 'NOT_FOUND');
      return tx.noteLabel.update({ where: { id: labelId }, data, select: { id: true, name: true } });
    });
    res.json(label);
  });
  router.delete('/:id', async (req, res) => {
    const userId = req.noteUser.id, labelId = id(req.params.id);
    await prisma.$transaction(async tx => {
      await lockNoteLabels(tx, userId);
      const owned = await tx.noteLabel.findFirst({ where: { id: labelId, ownerId: userId } });
      if (!owned) throw fail('Marcador não encontrado.', 404, 'NOT_FOUND');
      const assignments = await tx.noteLabelAssignment.findMany({ where: { labelId }, select: { noteId: true }, orderBy: { noteId: 'asc' } });
      for (const assignment of assignments) await lockNote(tx, assignment.noteId);
      // Revocation may have finished while these locks were being acquired.
      // Only still-accessible personal states may be updated after the locks.
      const accessible = await tx.note.findMany({ where: { id: { in: assignments.map(entry => entry.noteId) }, ...noteScope(userId) }, select: { id: true } });
      await tx.noteLabel.delete({ where: { id: labelId } });
      if (accessible.length) await tx.noteUserState.updateMany({ where: { userId, noteId: { in: accessible.map(note => note.id) } }, data: { version: { increment: 1 } } });
    }, { maxWait: 10000, timeout: 15000 });
    res.sendStatus(204);
  });
  return handleErrors(router);
}
