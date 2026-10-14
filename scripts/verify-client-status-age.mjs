import assert from 'node:assert/strict';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { test } from 'node:test';
import { attachStatusSince, withClientStatusSince } from '../api/clientStatusAge.js';
import { daysInClientStatus, isStalledClient } from '../frontend/src/utils/clientStatusAge.js';

const now = new Date('2026-10-14T15:00:00Z');
const client = { id: 1, status: 'Aprovado', createdAt: '2026-09-01T12:00:00Z', ultimaAtualizacao: now.toISOString() };

test('tempo de status usa histórico, sem reiniciar por edição de outros campos', () => {
  const [result] = attachStatusSince([client], [{ clientId: 1, action: 'status_changed', statusDepois: 'Aprovado', createdAt: '2026-10-07T12:00:00Z' }]);
  assert.equal(daysInClientStatus(result, now), 7);
  assert.equal(isStalledClient(result, now), true);
  assert.equal(isStalledClient({ ...result, emEspera: true }, now), false);
  for (const status of ['Assinado-Movido', 'Assinado', 'Arquivado']) {
    assert.equal(isStalledClient({ ...result, status }, now), false);
  }
  assert.equal(isStalledClient({ ...result, statusSince: '2026-10-08T12:00:00Z' }, now), false);
});

test('cadastro inicia a primeira etapa; histórico ausente ou incompatível não inventa uma data', () => {
  const [created] = attachStatusSince([client], [{ clientId: 1, action: 'created', statusDepois: 'Aprovado', createdAt: '2026-09-01T12:00:01Z' }]);
  assert.equal(created.statusSince, client.createdAt);
  const [unknown] = attachStatusSince([client], []);
  assert.equal(daysInClientStatus(unknown, now), null);
  assert.equal(isStalledClient(unknown, now), false);
  const [mismatch] = attachStatusSince([client], [{ clientId: 1, statusDepois: 'Inconforme', createdAt: '2026-10-01T12:00:00Z' }]);
  assert.equal(mismatch.statusSince, null);
});

test('contagem acompanha o calendário de São Paulo e rejeita datas inválidas e futuras', () => {
  const current = { ...client, statusSince: '2026-10-14T02:59:00Z' };
  assert.equal(daysInClientStatus(current, new Date('2026-10-14T03:01:00Z')), 1);
  assert.equal(daysInClientStatus(current, new Date('2026-10-14T02:59:30Z')), 0);
  assert.equal(daysInClientStatus({ ...client, statusSince: 'invalid' }, now), null);
  assert.equal(daysInClientStatus({ ...client, statusSince: '2026-10-15T12:00:00Z' }, now), null);
});

test('lista vazia não consulta o banco', async () => {
  assert.deepEqual(await withClientStatusSince({}, []), []);
});

test('PostgreSQL local: última transição prevalece sobre edição, pausa e histórico anterior', async t => {
  const url = process.env.DATABASE_URL;
  if (!url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) {
    t.skip('Integração permitida apenas no banco local.');
    return;
  }
  const prisma = new PrismaClient();
  let record;
  try {
    record = await prisma.client.create({ data: { nome: 'Teste temporário de idade de status', status: 'Aprovado' } });
    const transitionAt = new Date('2026-10-07T12:00:00Z');
    const common = { clientId: record.id, clientNome: record.nome, userName: 'Teste automatizado' };
    await prisma.activityLog.createMany({ data: [
      { ...common, action: 'created', statusDepois: 'Aprovado', createdAt: new Date('2026-09-01T12:00:00Z') },
      { ...common, action: 'status_changed', statusAntes: 'Aprovado', statusDepois: 'Inconforme', createdAt: new Date('2026-10-01T12:00:00Z') },
      { ...common, action: 'status_changed', statusAntes: 'Inconforme', statusDepois: 'Aprovado', createdAt: transitionAt },
      { ...common, action: 'updated', statusAntes: 'Aprovado', statusDepois: 'Aprovado', createdAt: new Date('2026-10-10T12:00:00Z') },
      { ...common, action: 'paused', statusAntes: 'Aprovado', statusDepois: 'Aprovado', createdAt: new Date('2026-10-11T12:00:00Z') },
    ] });
    const [result] = await withClientStatusSince(prisma, [record]);
    assert.equal(result.statusSince.toISOString(), transitionAt.toISOString());
    assert.equal(daysInClientStatus(result, now), 7);
    const latest = await prisma.activityLog.create({ data: { ...common, action: 'resumed', statusAntes: 'Aprovado', statusDepois: 'Inconforme', createdAt: now } });
    const [changed] = await withClientStatusSince(prisma, [{ ...record, status: 'Inconforme' }]);
    assert.equal(changed.statusSince.toISOString(), latest.createdAt.toISOString());
    assert.equal(daysInClientStatus(changed, now), 0);
  } finally {
    if (record) {
      await prisma.activityLog.deleteMany({ where: { clientId: record.id } });
      await prisma.client.delete({ where: { id: record.id } });
    }
    await prisma.$disconnect();
  }
});
