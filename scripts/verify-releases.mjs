import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import express from 'express';
import { createReleaseRouter } from '../api/releaseRoutes.js';
import { releaseAnnouncements } from '../api/releaseAnnouncements.js';

const clock = new Date('2026-11-11T12:00:00.000Z');
const announcement = (id, publishedAt, audience = ['ADM', 'ASSISTENTE']) => ({
  id, publishedAt, audience, title: `Novidade ${id}`, highlights: ['Uma melhoria para a rotina.'],
});
const announcements = [
  announcement('older-release', '2026-10-01T03:00:00.000Z'),
  announcement('future-release', '2030-01-01T03:00:00.000Z'),
  announcement('latest-release', '2026-11-09T03:00:00.000Z'),
  announcement('broker-release', '2026-11-08T03:00:00.000Z', ['CORRETOR']),
];

function fixture() {
  const users = new Map([
    [1, { id: 1, role: 'ADM', isActive: true, createdAt: new Date('2025-01-01') }],
    [2, { id: 2, role: 'ASSISTENTE', isActive: true, createdAt: new Date('2025-01-01') }],
    [3, { id: 3, role: 'CORRETOR', isActive: true, createdAt: new Date('2025-01-01') }],
    [4, { id: 4, role: 'ADM', isActive: false, createdAt: new Date('2025-01-01') }],
    [5, { id: 5, role: 'ADM', isActive: true, createdAt: new Date('2026-11-10') }],
    [6, { id: 6, role: 'ADM', isActive: true, createdAt: new Date('2026-10-15') }],
  ]);
  const receipts = new Map();
  const state = { failUserRead: false, failReceipts: false, writes: 0 };
  const prisma = {
    user: { findUnique: async ({ where }) => {
      if (state.failUserRead) throw new Error('Banco temporariamente indisponível.');
      return users.get(where.id) || null;
    } },
    userReleaseReceipt: {
      findMany: async ({ where }) => {
        if (state.failReceipts) throw new Error('Falha na leitura.');
        return [...receipts.values()].filter(item => item.userId === where.userId && where.releaseId.in.includes(item.releaseId));
      },
      createMany: async ({ data, skipDuplicates }) => {
        if (state.failReceipts) throw new Error('Falha na confirmação.');
        assert.equal(skipDuplicates, true, 'O banco deve preservar confirmações anteriores.');
        state.writes++;
        for (const item of data) {
          const key = `${item.userId}:${item.releaseId}`;
          if (!receipts.has(key)) receipts.set(key, { ...item, acknowledgedAt: new Date() });
        }
      },
    },
  };
  return { prisma, users, receipts, state };
}

async function serve(t, prisma, catalog = announcements) {
  const app = express();
  app.use(express.json());
  app.use('/api/releases', createReleaseRouter(prisma, (req, res, next) => {
    const id = req.headers['x-user'];
    if (!id) return res.status(401).json({ error: 'Não autenticado.' });
    req.user = { id, role: 'ADM' };
    next();
  }, { announcements: catalog, now: () => clock }));
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
    next(error);
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/releases`;
  return async (user, path = '/pending', body, expectedUser) => fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(user === null ? {} : { 'X-User': String(user) }),
      ...(expectedUser === undefined ? {} : { 'X-Release-User': String(expectedUser) }),
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const read = async response => {
  assert.equal(response.status, 200);
  return response.json();
};

test('novidades: catálogo publicado possui título genérico, IDs estáveis e três destaques', () => {
  const ids = releaseAnnouncements.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length, 'Cada publicação possui um identificador exclusivo.');
  const item = releaseAnnouncements.find(release => release.id === '2026-11-imoveis-engenharias');
  assert.ok(item);
  assert.equal(item.highlights.length, 3);
  assert.deepEqual(item.audience, ['ADM', 'ASSISTENTE']);
  assert.equal(item.title, 'Atualização do sistema');
  assert.equal(item.action, undefined);
  assert.ok(Object.isFrozen(item) && Object.isFrozen(item.highlights));
});

test('novidades: nota de comissões possui público exclusivo ADM e quatro destaques', () => {
  const item = releaseAnnouncements.find(release => release.id === '2026-11-comissoes-clientes');
  assert.ok(item, 'A atualização de comissões deve estar publicada no catálogo.');
  assert.equal(item.publishedAt, '2026-11-10T03:00:00.000Z');
  assert.deepEqual(item.audience, ['ADM']);
  assert.equal(item.title, 'Atualização do sistema');
  assert.equal(item.highlights.length, 4);
  assert.ok(item.highlights.every(highlight => typeof highlight === 'string' && highlight.trim()));
  assert.equal(item.action, undefined);
  assert.ok(Object.isFrozen(item) && Object.isFrozen(item.audience) && Object.isFrozen(item.highlights));
});

test('API: catálogo real entrega a nota de comissões apenas ao perfil ADM atual', async t => {
  const { prisma, users, receipts } = fixture();
  const request = await serve(t, prisma, releaseAnnouncements);
  const commissionId = '2026-11-comissoes-clientes';
  const propertyId = '2026-11-imoveis-engenharias';
  const admin = await read(await request(1));
  assert.deepEqual(admin.items.map(item => item.id), [commissionId, propertyId]);
  assert.equal(admin.items[0].highlights.length, 4);
  assert.deepEqual((await read(await request(2))).items.map(item => item.id), [propertyId]);
  assert.deepEqual((await read(await request(3))).items, []);
  for (const user of [2, 3]) {
    assert.equal((await request(user, '/acknowledge', { ids: [commissionId] })).status, 404);
  }
  assert.equal(receipts.size, 0, 'Outros perfis não podem confirmar a atualização administrativa.');

  users.get(1).role = 'ASSISTENTE';
  assert.deepEqual((await read(await request(1))).items.map(item => item.id), [propertyId]);
  assert.equal((await request(1, '/acknowledge', { ids: [commissionId] })).status, 404,
    'O perfil ADM antigo da sessão não concede acesso após a troca de função.');
  assert.equal(receipts.size, 0);
});

test('API: nota real de comissões deixa de aparecer para o administrador após confirmar', async t => {
  const { prisma, receipts } = fixture();
  const request = await serve(t, prisma, releaseAnnouncements);
  const commissionId = '2026-11-comissoes-clientes';
  const propertyId = '2026-11-imoveis-engenharias';
  assert.deepEqual(await read(await request(1, '/acknowledge', { ids: [commissionId] })), {
    acknowledgedIds: [commissionId],
  });
  assert.deepEqual((await read(await request(1))).items.map(item => item.id), [propertyId]);
  await read(await request(1, '/acknowledge', { ids: [commissionId] }));
  assert.equal(receipts.size, 1, 'Confirmar novamente preserva um único registro por conta.');
  assert.deepEqual((await read(await request(5))).items.map(item => item.id), [commissionId],
    'A confirmação de um administrador não oculta a nota de outro administrador.');
  await read(await request(5, '/acknowledge', { ids: [commissionId] }));
  assert.deepEqual((await read(await request(5))).items, [],
    'Após reconhecer a nota mais recente, a conta nova não recebe anúncios antigos.');
});

test('API: exige sessão válida, usuário ativo e consulta o perfil atual', async t => {
  const { prisma, users, state } = fixture();
  const request = await serve(t, prisma);
  for (const user of [null, 'invalid', '0', '-1', '2147483648', '1.5', 4, 99]) {
    assert.equal((await request(user)).status, 401);
    assert.equal((await request(user, '/acknowledge', { ids: ['latest-release'] })).status, 401);
  }
  const admin = await read(await request(1));
  assert.deepEqual(admin.items.map(item => item.id), ['latest-release', 'older-release']);
  users.get(1).role = 'CORRETOR';
  const broker = await read(await request(1));
  assert.deepEqual(broker.items.map(item => item.id), ['broker-release'], 'O papel antigo do cookie não concede o anúncio.');
  assert.equal((await request(1, '/acknowledge', { ids: ['latest-release'] })).status, 404);
  state.failUserRead = true;
  assert.equal((await request(2)).status, 503);
});

test('API: pendências respeitam público, publicação e criação da conta', async t => {
  const { prisma } = fixture();
  const request = await serve(t, prisma);
  const oldAccountResponse = await request(1, '/pending');
  assert.equal(oldAccountResponse.headers.get('cache-control'), 'private, no-store');
  const oldAccount = await read(oldAccountResponse);
  assert.deepEqual(oldAccount.items.map(item => item.id), ['latest-release', 'older-release']);
  assert.equal(oldAccount.total, 2);
  for (const user of [5, 6]) {
    const pending = await read(await request(user, '/pending'));
    assert.deepEqual(pending.items.map(item => item.id), ['latest-release'], 'Novas contas começam pelo resumo mais recente.');
  }
  const broker = await read(await request(3, '/pending'));
  assert.deepEqual(broker.items.map(item => item.id), ['broker-release']);
  const emptyRequest = await serve(t, prisma, []);
  assert.deepEqual(await read(await emptyRequest(1, '/pending')), { items: [], total: 0 });
});

test('API: confirmação pertence à conta, preserva data e é idempotente entre acessos', async t => {
  const { prisma, receipts } = fixture();
  const request = await serve(t, prisma);
  assert.deepEqual(await read(await request(1, '/acknowledge', { ids: ['latest-release'] })), { acknowledgedIds: ['latest-release'] });
  const firstDate = receipts.get('1:latest-release').acknowledgedAt.toISOString();
  await Promise.all(Array.from({ length: 3 }, () => request(1, '/acknowledge', { ids: ['latest-release', 'latest-release'] }).then(read)));
  assert.equal(receipts.size, 1);
  assert.equal(receipts.get('1:latest-release').acknowledgedAt.toISOString(), firstDate);
  assert.deepEqual((await read(await request(1, '/pending'))).items.map(item => item.id), ['older-release']);
  assert.equal((await read(await request(2, '/pending'))).total, 2, 'Outra conta mantém suas próprias pendências.');
  await read(await request(5, '/acknowledge', { ids: ['latest-release'] }));
  assert.equal((await read(await request(5, '/pending'))).total, 0, 'Não apresenta o arquivo antigo à conta nova após confirmar o resumo.');
});

test('API: troca de sessão entre abertura e confirmação impede gravação na outra conta', async t => {
  const { prisma, receipts } = fixture();
  const request = await serve(t, prisma);
  const pendingResponse = await request(2, '/pending', undefined, 1);
  assert.equal(pendingResponse.status, 409);
  assert.equal((await pendingResponse.json()).code, 'SESSION_CHANGED');
  const response = await request(2, '/acknowledge', { ids: ['latest-release'] }, 1);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'SESSION_CHANGED');
  assert.equal(receipts.size, 0);
  await read(await request(2, '/acknowledge', { ids: ['latest-release'] }, 2));
  assert.deepEqual([...receipts.keys()], ['2:latest-release']);
});

test('API: confirma somente IDs solicitados e impede conteúdo futuro, outro perfil e corpo forjado', async t => {
  const { prisma, receipts, state } = fixture();
  const request = await serve(t, prisma);
  for (const body of [null, {}, [], { ids: [] }, { ids: 'latest-release' }, { ids: [null] }, { ids: [''] }, { ids: ['x'.repeat(121)] }, { ids: Array(101).fill('latest-release') }, { ids: ['latest-release'], userId: 2 }]) {
    assert.equal((await request(1, '/acknowledge', body)).status, 400);
  }
  for (const id of ['unknown', 'future-release', 'broker-release']) {
    assert.equal((await request(1, '/acknowledge', { ids: ['latest-release', id] })).status, 404);
  }
  assert.equal(state.writes, 0, 'Um lote inválido não pode confirmar parcialmente.');
  await read(await request(1, '/acknowledge', { ids: ['older-release'] }));
  assert.deepEqual([...receipts.keys()], ['1:older-release']);
  assert.deepEqual((await read(await request(1, '/pending'))).items.map(item => item.id), ['latest-release']);
});

test('API: falhas do armazenamento retornam erro recuperável sem confirmar itens', async t => {
  const { prisma, receipts, state } = fixture();
  const request = await serve(t, prisma);
  state.failReceipts = true;
  assert.equal((await request(1, '/pending')).status, 503);
  assert.equal((await request(1, '/acknowledge', { ids: ['latest-release'] })).status, 503);
  assert.equal(receipts.size, 0);
  state.failReceipts = false;
  assert.equal((await read(await request(1, '/pending'))).total, 2);
});

test('PostgreSQL local: confirmações persistem por conta com chave única e exclusão em cascata', { skip: process.env.TEST_RELEASES_DB !== '1' }, async t => {
  const target = new URL(process.env.DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '::1'].includes(target.hostname), 'O teste exige PostgreSQL local.');
  assert.equal(target.port, '5433');
  assert.equal(target.pathname, '/motive_local');
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const suffix = randomUUID();
  const users = [];
  try {
    for (let index = 0; index < 2; index++) users.push(await prisma.user.create({ data: {
      nome: `Teste novidades ${index}`, email: `qa-releases-${suffix}-${index}@example.test`, passwordHash: 'test-only',
      role: 'ADM', createdAt: new Date('2025-01-01'),
    } }));
    const id = `qa-release-${suffix}`;
    const request = await serve(t, prisma, [announcement(id, '2026-11-09T03:00:00.000Z')]);
    await Promise.all(Array.from({ length: 3 }, () => request(users[0].id, '/acknowledge', { ids: [id] }).then(read)));
    assert.equal(await prisma.userReleaseReceipt.count({ where: { userId: users[0].id } }), 1);
    const receiptKey = { userId_releaseId: { userId: users[0].id, releaseId: id } };
    const receipt = await prisma.userReleaseReceipt.findUnique({ where: receiptKey });
    const acknowledgedAt = receipt.acknowledgedAt.toISOString();
    assert.ok(acknowledgedAt);
    await read(await request(users[0].id, '/acknowledge', { ids: [id] }));
    const repeatedReceipt = await prisma.userReleaseReceipt.findUnique({ where: receiptKey });
    assert.equal(repeatedReceipt.acknowledgedAt.toISOString(), acknowledgedAt);
    assert.equal((await read(await request(users[0].id, '/pending'))).total, 0);
    assert.equal((await read(await request(users[1].id, '/pending'))).total, 1);
    await prisma.user.delete({ where: { id: users[0].id } });
    assert.equal(await prisma.userReleaseReceipt.count({ where: { userId: users[0].id } }), 0);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
    await prisma.$disconnect();
  }
});
