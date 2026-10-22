import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import { createNoteRouter, createNoteLabelRouter } from '../api/noteRoutes.js';
import { encodeSession, decodeSession } from '../api/session.js';
import { encodeNoteDocument, plainNoteDocument } from '../frontend/src/utils/noteContent.js';

// This integration suite owns every record it creates and refuses remote databases.
test('Notas com PostgreSQL: acesso, preferências, conflitos e recuperação', { timeout: 120_000 }, async () => {
  assert.ok(process.env.DATABASE_URL, 'Configure DATABASE_URL para um PostgreSQL local.');
  const database = new URL(process.env.DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(database.hostname), 'Este teste só pode usar banco local.');
  assert.notEqual(process.env.NODE_ENV, 'production', 'Não execute esta suíte em produção.');
  const prisma = new PrismaClient();
  const userIds = [];
  const prefix = `note-test-${randomUUID()}`;
  let server;
  try {
    const createUser = async (name, role, isActive = true) => {
      const user = await prisma.user.create({ data: {
        nome: `${prefix} ${name}`, email: `${prefix}-${name}@example.test`,
        passwordHash: 'not-a-login-hash', role, isActive,
      } });
      userIds.push(user.id);
      return user;
    };
    const owner = await createUser('Dono', 'ASSISTENTE');
    const editor = await createUser('Editor', 'CORRETOR');
    const viewer = await createUser('Leitor', 'ASSISTENTE');
    const outsider = await createUser('Terceiro', 'CORRETOR');
    const admin = await createUser('Administrador', 'ADM');
    const inactive = await createUser('Inativo', 'ASSISTENTE', false);
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    const requireAuth = (req, res, next) => {
      const session = decodeSession(req.cookies.motive_session);
      if (!session) return res.sendStatus(401);
      req.user = session;
      next();
    };
    app.use('/notes', createNoteRouter(prisma, requireAuth));
    app.use('/note-labels', createNoteLabelRouter(prisma, requireAuth));
    app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message, code: error.code }));
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (user, path = '/notes', method = 'GET', body, headers = {}) => {
      const requestHeaders = {
        ...(user ? { Cookie: `motive_session=${encodeSession({ id: user.id, role: 'ADM' })}` } : {}),
        'Content-Type': 'application/json', Origin: 'http://localhost:5173', ...headers,
      };
      for (const key of Object.keys(requestHeaders)) if (requestHeaders[key] === null) delete requestHeaders[key];
      const response = await fetch(`${base}${path}`, {
        method,
        headers: requestHeaders,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const data = await response.json().catch(() => null);
      return { status: response.status, data, headers: response.headers };
    };
    const expect = async (status, user, path, method, body, headers) => {
      const response = await request(user, path, method, body, headers);
      assert.equal(response.status, status, `${method || 'GET'} ${path}: ${JSON.stringify(response.data)}`);
      return response.data;
    };
    const create = async (user, fields = {}) => {
      const response = await request(user, '/notes', 'POST', {
        clientMutationId: randomUUID(), kind: 'TEXT', title: `${prefix} nota`, content: '', items: [], ...fields,
      });
      assert.equal(response.status, 201, JSON.stringify(response.data));
      return response.data;
    };
    const get = (user, note) => expect(200, user, `/notes/${note.id}`);
    const write = (user, note, fields) => expect(200, user, `/notes/${note.id}`, 'PATCH', { version: note.version, ...fields });
    const state = (user, note, fields) => expect(200, user, `/notes/${note.id}/state`, 'PATCH', { version: note.state.version, ...fields });
    const share = (note, access) => expect(200, owner, `/notes/${note.id}/access`, 'PUT', { version: note.version, access });
    const label = (user, name) => expect(201, user, '/note-labels', 'POST', { name });
    const list = (user, query = '') => expect(200, user, `/notes${query}`);
    const contains = (result, note) => result.notes.some(item => item.id === note.id);

    // A cookie claim of ADM cannot grant access: the router revalidates the user.
    await expect(401, null, '/notes');
    await expect(401, null, '/note-labels');
    await expect(401, inactive, '/notes');
    await expect(401, inactive, '/note-labels');
    const defaultMutationId = randomUUID();
    let privateNote = await create(owner, { clientMutationId: defaultMutationId, title: 'Particular', content: `${prefix} sigilo` });
    assert.equal(privateNote.access.length, await prisma.user.count({ where: { isActive: true, id: { not: owner.id } } }));
    // New notes grant editing to the active team atomically, with independent personal states.
    for (const user of [editor, viewer, outsider, admin]) {
      assert.equal(privateNote.access.find(entry => entry.userId === user.id)?.role, 'EDITOR');
      const teamNote = await get(user, privateNote);
      assert.equal(teamNote.role, 'EDITOR');
      assert.equal(contains(await list(user), privateNote), true);
      assert.equal(teamNote.state.version, 1);
    }
    assert.equal(privateNote.access.some(entry => entry.userId === inactive.id || entry.userId === owner.id), false);
    privateNote = await write(editor, privateNote, { content: `${prefix} edição da equipe` });
    // The owner can still restrict a note explicitly. Existing/private notes are not backfilled.
    privateNote = await share(privateNote, []);
    const restrictedRetry = await expect(200, owner, '/notes', 'POST', {
      clientMutationId: defaultMutationId, kind: 'TEXT', title: 'Particular', content: `${prefix} sigilo`, items: [],
    });
    assert.deepEqual(restrictedRetry.access, [], 'Repetir a criação não deve conceder novamente acessos removidos.');
    assert.equal(privateNote.ownerId, owner.id);
    assert.equal(privateNote.owner.id, owner.id);
    assert.equal(privateNote.role, 'OWNER');
    assert.equal(privateNote.deletedAt, null);
    assert.equal(privateNote.state.color, 'default');
    assert.equal(privateNote.state.isPinned, false);
    assert.deepEqual(privateNote.access, []);
    assert.deepEqual(privateNote.labels, []);
    for (const user of [editor, viewer, outsider, admin]) {
      await expect(404, user, `/notes/${privateNote.id}`);
      await expect(404, user, `/notes/${privateNote.id}`, 'PATCH', { version: privateNote.version, content: 'Intrusão' });
      await expect(404, user, `/notes/${privateNote.id}/state`, 'PATCH', { version: 1, color: 'pink' });
      assert.equal((await list(user, `?q=${prefix}`)).total, 0);
    }
    const privateResponse = await request(owner, `/notes/${privateNote.id}`);
    assert.match(privateResponse.headers.get('cache-control'), /private/);
    assert.match(privateResponse.headers.get('cache-control'), /no-store/);

    // Repeated and concurrent creation retries must return exactly one note.
    const mutationId = randomUUID();
    const creation = { clientMutationId: mutationId, kind: 'TEXT', title: 'Idempotência', content: `${prefix} retry`, items: [] };
    const repeated = await Promise.all([request(owner, '/notes', 'POST', creation), request(owner, '/notes', 'POST', creation)]);
    for (const response of repeated) assert.ok([200, 201].includes(response.status), JSON.stringify(response.data));
    assert.equal(repeated[0].data.id, repeated[1].data.id);
    assert.equal(await prisma.note.count({ where: { ownerId: owner.id, clientMutationId: mutationId } }), 1);
    const retry = await request(owner, '/notes', 'POST', creation);
    assert.equal(retry.data.id, repeated[0].data.id);
    const changedRetryNote = await write(owner, retry.data, { content: 'Edição posterior ao primeiro envio' });
    const lateRetry = await request(owner, '/notes', 'POST', creation);
    assert.ok([200, 201].includes(lateRetry.status), JSON.stringify(lateRetry.data));
    assert.equal(lateRetry.data.id, changedRetryNote.id);
    assert.equal(lateRetry.data.content, changedRetryNote.content);
    assert.equal(lateRetry.data.version, changedRetryNote.version);
    const otherOwnerRetry = await create(editor, creation);
    assert.notEqual(otherOwnerRetry.id, retry.data.id);

    // Both mutation guards are exercised with an otherwise valid signed cookie.
    const beforeOriginTest = await prisma.note.count({ where: { ownerId: owner.id } });
    await expect(403, owner, '/notes', 'POST', { ...creation, clientMutationId: randomUUID() }, { Origin: 'https://attacker.example.test' });
    await expect(403, owner, '/notes', 'POST', { ...creation, clientMutationId: randomUUID() }, { Origin: null });
    await expect(403, owner, `/notes/${privateNote.id}`, 'PATCH', { version: privateNote.version, title: 'CSRF' }, { Origin: 'https://attacker.example.test' });
    await expect(403, owner, '/note-labels', 'POST', { name: 'CSRF' }, { Origin: 'https://attacker.example.test' });
    assert.equal(await prisma.note.count({ where: { ownerId: owner.id } }), beforeOriginTest);

    // Reject mass assignment and malformed values before persisting anything.
    for (const invalid of [
      { title: '', content: '', items: [] }, { title: 'x'.repeat(251) }, { content: 'x'.repeat(20_001) },
      { clientMutationId: 'not-a-uuid' }, { ownerId: outsider.id }, { kind: 'RICH_TEXT' },
      { kind: 'CHECKLIST', items: [{ id: 'a', text: 'Item', checked: 'true' }] },
      { kind: 'CHECKLIST', items: [{ id: 'a', text: 'Um', checked: false }, { id: 'a', text: 'Dois', checked: false }] },
      { kind: 'CHECKLIST', items: [{ id: 'a', text: 'x'.repeat(501), checked: false }] },
      { kind: 'CHECKLIST', items: Array.from({ length: 101 }, (_, i) => ({ id: `item-${i}`, text: 'Item', checked: false })) },
    ]) await expect(400, owner, '/notes', 'POST', { ...creation, clientMutationId: randomUUID(), ...invalid });
    await expect(400, owner, '/notes?view=invalid');
    await expect(400, owner, '/notes?scope=invalid');
    await expect(400, owner, '/notes?page=0');
    await expect(400, owner, `/notes/${privateNote.id}`, 'PATCH', { title: 'Sem versão' });
    await expect(400, owner, `/notes/${privateNote.id}`, 'PATCH', { version: privateNote.version, kind: 'CHECKLIST' });
    const untitled = await create(owner, { title: '', content: 'Uma anotação sem título' });
    assert.equal((await get(owner, untitled)).title, '');
    const untitledChecklist = await create(owner, { kind: 'CHECKLIST', title: '', content: '', items: [{ id: 'primeiro', text: 'Primeiro item', checked: false }] });
    assert.equal((await get(owner, untitledChecklist)).items[0].id, 'primeiro');
    const formattedDocument = plainNoteDocument(`Negrito pesquisável ${prefix}`);
    formattedDocument.content[0].content[0].marks = [{ type: 'bold' }];
    const formattedContent = encodeNoteDocument(formattedDocument);
    const formattedNote = await create(owner, { title: 'Formatação', content: formattedContent });
    assert.equal((await get(editor, formattedNote)).content, formattedContent);
    const formattedSearch = await list(editor, `?q=${encodeURIComponent(`Negrito pesquisavel ${prefix}`)}`);
    assert.equal(formattedSearch.total, 1);
    assert.equal(formattedSearch.notes[0].id, formattedNote.id);

    let shared = await create(owner, {
      kind: 'CHECKLIST', title: `${prefix} Reunião`, content: 'Decisões da equipe',
      items: [{ id: 'documentos', text: 'Conferir matrícula e documentação', checked: false }],
    });
    const beforeSharing = shared.version;
    shared = await share(shared, [{ userId: editor.id, role: 'EDITOR' }, { userId: viewer.id, role: 'VIEWER' }]);
    await expect(409, owner, `/notes/${shared.id}/access`, 'PUT', { version: beforeSharing, access: [] });
    assert.equal(shared.access.length, 2);
    assert.equal((await get(editor, shared)).role, 'EDITOR');
    assert.equal((await get(viewer, shared)).role, 'VIEWER');
    await expect(404, admin, `/notes/${shared.id}`);
    await expect(403, viewer, `/notes/${shared.id}`, 'PATCH', { version: shared.version, items: [{ id: 'documentos', text: 'Alterado', checked: true }] });
    await expect(403, editor, `/notes/${shared.id}/access`, 'PUT', { version: shared.version, access: [] });
    await expect(403, viewer, `/notes/${shared.id}/trash`, 'POST', { version: shared.version });
    await expect(403, editor, `/notes/${shared.id}`, 'DELETE', { version: shared.version });
    const options = await expect(200, owner, `/notes/share-options?q=${encodeURIComponent(prefix)}`);
    assert.ok(options.some(user => user.id === editor.id));
    assert.equal(options.some(user => user.id === inactive.id), false);
    assert.equal(options.some(user => user.id === owner.id), false);
    for (const user of options) assert.deepEqual(Object.keys(user).sort(), ['id', 'nome']);
    await expect(400, owner, `/notes/${shared.id}/access`, 'PUT', { version: shared.version, access: [{ userId: inactive.id, role: 'EDITOR' }] });
    await expect(400, owner, `/notes/${shared.id}/access`, 'PUT', { version: shared.version, access: [{ userId: editor.id, role: 'OWNER' }] });
    await expect(400, owner, `/notes/${shared.id}/access`, 'PUT', { version: shared.version, access: [{ userId: owner.id, role: 'EDITOR' }] });
    await expect(400, owner, `/notes/${shared.id}/access`, 'PUT', { version: shared.version, access: [{ userId: editor.id, role: 'EDITOR' }, { userId: editor.id, role: 'VIEWER' }] });

    // Search normalizes case/accents in checklist text and scopes its count first.
    const accents = await list(viewer, '?q=MATRICULA');
    assert.equal(accents.total, 1);
    assert.equal(contains(accents, shared), true);
    assert.equal((await list(outsider, '?q=MATRICULA')).total, 0);
    assert.equal(contains(await list(owner, '?scope=mine'), shared), true);
    assert.equal(contains(await list(viewer, '?scope=mine'), shared), false);
    assert.equal(contains(await list(viewer, '?scope=shared'), shared), true);
    for (let index = 0; index < 3; index++) await create(owner, { title: `${prefix} paginação ${index}` });
    const page1 = await list(owner, `?q=${prefix}%20paginacao&pageSize=2&page=1`);
    const page2 = await list(owner, `?q=${prefix}%20paginacao&pageSize=2&page=2`);
    assert.equal(page1.total, 3); assert.equal(page2.total, 3);
    assert.equal(page1.notes.length, 2); assert.equal(page2.notes.length, 1);
    assert.equal(new Set([...page1.notes, ...page2.notes].map(note => note.id)).size, 3);

    // Labels and presentation state belong solely to the current participant.
    const ownerLabel = await label(owner, 'Atendimento');
    let viewerLabel = await label(viewer, 'Reuniões');
    assert.deepEqual(await expect(200, viewer, '/note-labels'), [viewerLabel]);
    await expect(404, owner, `/note-labels/${viewerLabel.id}`, 'PATCH', { name: 'Apropriação' });
    await expect(404, owner, `/note-labels/${viewerLabel.id}`, 'DELETE');
    const duplicateLabel = await expect(409, viewer, '/note-labels', 'POST', { name: 'reunioes' });
    assert.equal(duplicateLabel.code, 'LABEL_EXISTS');
    viewerLabel = await expect(200, viewer, `/note-labels/${viewerLabel.id}`, 'PATCH', { name: 'Equipe' });
    let viewerNote = await get(viewer, shared);
    const foreignLabel = await expect(404, viewer, `/notes/${shared.id}/state`, 'PATCH', { version: viewerNote.state.version, labelIds: [ownerLabel.id] });
    assert.equal(foreignLabel.code, 'NOT_FOUND');
    await expect(403, owner, `/notes/${shared.id}/state`, 'PATCH', { version: shared.state.version, hidden: true });
    viewerNote = await state(viewer, viewerNote, { color: 'yellow', isPinned: true, labelIds: [viewerLabel.id] });
    assert.equal(viewerNote.version, shared.version);
    assert.equal(viewerNote.labels[0].id, viewerLabel.id);
    assert.equal((await get(owner, shared)).state.color, 'default');
    assert.deepEqual((await get(owner, shared)).labels, []);
    assert.equal(contains(await list(viewer, `?labelId=${viewerLabel.id}&color=yellow`), shared), true);
    assert.equal((await list(owner, '?color=yellow')).total, 0);
    viewerNote = await state(viewer, viewerNote, { archived: true });
    assert.equal(contains(await list(viewer), shared), false);
    assert.equal(contains(await list(viewer, '?view=archived'), shared), true);
    assert.equal(contains(await list(owner), shared), true);
    viewerNote = await state(viewer, viewerNote, { archived: false, hidden: true });
    assert.equal(contains(await list(viewer), shared), false);
    assert.equal(contains(await list(viewer, '?view=hidden'), shared), true);
    assert.equal(contains(await list(owner), shared), true);
    viewerNote = await state(viewer, viewerNote, { hidden: false });
    await expect(204, viewer, `/note-labels/${viewerLabel.id}`, 'DELETE');
    assert.deepEqual((await get(viewer, shared)).labels, []);
    assert.equal((await get(viewer, shared)).content, shared.content);

    // Content and personal state have independent optimistic versions.
    const beforeContent = await get(editor, shared);
    const beforeState = await get(viewer, shared);
    shared = await write(editor, beforeContent, { content: 'Atualizado pelo editor', items: [{ id: 'documentos', text: 'Conferir matrícula e documentação', checked: true }] });
    assert.ok(shared.version > beforeContent.version);
    const conflict = await expect(409, owner, `/notes/${shared.id}`, 'PATCH', { version: beforeContent.version, content: 'Texto obsoleto' });
    assert.equal(conflict.code, 'VERSION_CONFLICT');
    viewerNote = await state(viewer, beforeState, { color: 'green' });
    assert.equal(viewerNote.version, shared.version);
    assert.ok(viewerNote.state.version > beforeState.state.version);
    await expect(409, viewer, `/notes/${shared.id}/state`, 'PATCH', { version: beforeState.state.version, color: 'pink' });
    shared = await write(owner, shared, { title: 'Título após preferências' });
    const races = await Promise.all([
      request(owner, `/notes/${shared.id}`, 'PATCH', { version: shared.version, content: 'Venceu dono' }),
      request(editor, `/notes/${shared.id}`, 'PATCH', { version: shared.version, content: 'Venceu editor' }),
    ]);
    assert.deepEqual(races.map(result => result.status).sort(), [200, 409]);
    shared = await get(owner, shared);
    assert.equal(shared.content, races.find(result => result.status === 200).data.content);

    // Downgrading immediately stops writes, while revoking also cleans preferences.
    shared = await share(shared, [{ userId: editor.id, role: 'VIEWER' }, { userId: viewer.id, role: 'VIEWER' }]);
    await expect(403, editor, `/notes/${shared.id}`, 'PATCH', { version: shared.version, content: 'Editor antigo' });
    const editorLabel = await label(editor, 'Só deste participante');
    const editorNote = await state(editor, await get(editor, shared), { color: 'purple', labelIds: [editorLabel.id] });
    const revokeRace = await Promise.all([
      request(owner, `/notes/${shared.id}/access`, 'PUT', { version: shared.version, access: [{ userId: viewer.id, role: 'VIEWER' }] }),
      request(editor, `/notes/${shared.id}/state`, 'PATCH', { version: editorNote.state.version, color: 'blue', labelIds: [editorLabel.id] }),
    ]);
    assert.equal(revokeRace[0].status, 200, JSON.stringify(revokeRace[0].data));
    assert.ok([200, 404].includes(revokeRace[1].status), JSON.stringify(revokeRace[1].data));
    shared = revokeRace[0].data;
    await expect(404, editor, `/notes/${shared.id}`);
    await expect(404, editor, `/notes/${shared.id}/state`, 'PATCH', { version: editorNote.state.version + 1, color: 'pink' });
    assert.equal((await list(editor, `?q=${prefix}`)).notes.some(note => note.id === shared.id), false);
    assert.equal(await prisma.noteUserState.count({ where: { noteId: shared.id, userId: editor.id } }), 0);
    assert.equal(await prisma.noteLabelAssignment.count({ where: { noteId: shared.id, labelId: editorLabel.id } }), 0);
    assert.equal(await prisma.noteLabel.count({ where: { id: editorLabel.id, ownerId: editor.id } }), 1);
    shared = await share(shared, [{ userId: editor.id, role: 'EDITOR' }, { userId: viewer.id, role: 'VIEWER' }]);
    const rejoined = await get(editor, shared);
    assert.equal(rejoined.state.color, 'default');
    assert.deepEqual(rejoined.labels, []);
    await prisma.user.update({ where: { id: editor.id }, data: { isActive: false } });
    await expect(401, editor, `/notes/${shared.id}`);
    await expect(401, editor, `/notes/${shared.id}`, 'PATCH', { version: shared.version, content: 'Conta desativada' });
    await prisma.user.update({ where: { id: editor.id }, data: { isActive: true } });

    // Only the owner sees the trash and can restore/permanently delete.
    const notInTrash = await expect(409, owner, `/notes/${shared.id}`, 'DELETE', { version: shared.version });
    assert.equal(notInTrash.code, 'NOTE_NOT_IN_TRASH');
    const preTrashVersion = shared.version;
    shared = await expect(200, owner, `/notes/${shared.id}/trash`, 'POST', { version: shared.version });
    assert.ok(shared.deletedAt);
    assert.equal(contains(await list(owner), shared), false);
    assert.equal(contains(await list(owner, '?view=trash'), shared), true);
    assert.equal(contains(await list(viewer, '?view=trash'), shared), false);
    await expect(404, viewer, `/notes/${shared.id}`);
    await expect(404, editor, `/notes/${shared.id}/restore`, 'POST', { version: shared.version });
    await expect(409, owner, `/notes/${shared.id}/restore`, 'POST', { version: preTrashVersion });
    const trashEdit = await expect(409, owner, `/notes/${shared.id}`, 'PATCH', { version: shared.version, content: 'Na lixeira' });
    assert.equal(trashEdit.code, 'NOTE_IN_TRASH');
    const trashShare = await expect(409, owner, `/notes/${shared.id}/access`, 'PUT', { version: shared.version, access: [] });
    assert.equal(trashShare.code, 'NOTE_IN_TRASH');
    shared = await expect(200, owner, `/notes/${shared.id}/restore`, 'POST', { version: shared.version });
    assert.equal(shared.deletedAt, null);
    assert.equal((await get(viewer, shared)).state.color, 'green');
    await prisma.user.update({ where: { id: owner.id }, data: { isActive: false } });
    await expect(401, owner, `/notes/${shared.id}`);
    assert.equal((await get(editor, shared)).role, 'EDITOR');
    await prisma.user.update({ where: { id: owner.id }, data: { isActive: true } });
    shared = await expect(200, owner, `/notes/${shared.id}/trash`, 'POST', { version: shared.version });
    await expect(204, owner, `/notes/${shared.id}`, 'DELETE', { version: shared.version });
    await expect(404, owner, `/notes/${shared.id}`);
    assert.equal(await prisma.noteUserState.count({ where: { noteId: shared.id } }), 0);
    assert.equal(await prisma.noteAccess.count({ where: { noteId: shared.id } }), 0);
    assert.equal(await prisma.noteLabelAssignment.count({ where: { noteId: shared.id } }), 0);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (userIds.length) {
      await prisma.note.deleteMany({ where: { ownerId: { in: userIds } } });
      await prisma.noteLabel.deleteMany({ where: { ownerId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  }
});
