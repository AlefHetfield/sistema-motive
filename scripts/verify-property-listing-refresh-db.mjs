import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createPropertyListingRefresh } from '../api/propertyListingRefresh.js';

test('PostgreSQL local coordena retomada, concorrência e gravação atômica da atualização', {
  skip: process.env.TEST_PROPERTY_REFRESH_DB !== '1',
}, async t => {
  const target = new URL(process.env.DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname));
  assert.equal(target.port, '5433');
  assert.equal(target.pathname, '/motive_local');
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const suffix = randomUUID();
  const propertyIds = [];
  const coordinatorIds = [];
  const confirmedAt = new Date('2026-11-01T00:00:00.000Z');
  let clock = Date.now();
  const intervalMs = 2000;
  const leaseMs = 30000;
  const listingFailure = (status, retryAfter) => Object.assign(new Error('Falha simulada do anúncio'), {
    status, kind: status === 429 ? 'connection' : 'listing', upstreamStatus: status, retryAfter,
  });
  // Every candidate and every write is restricted to records created by this test.
  const scoped = {
    propertyListingRefresh: prisma.propertyListingRefresh,
    $transaction: operation => prisma.$transaction(async tx => operation({
      propertyListingRefresh: tx.propertyListingRefresh,
      $queryRaw: tx.$queryRaw.bind(tx),
      property: {
        findMany: args => tx.property.findMany({ ...args, where: { AND: [args.where || {}, { id: { in: propertyIds } }] } }),
        findUnique: args => { assert.ok(propertyIds.includes(args.where.id)); return tx.property.findUnique(args); },
        update: args => { assert.ok(propertyIds.includes(args.where.id)); return tx.property.update(args); },
      },
    })),
  };
  const coordinator = () => {
    const id = -randomInt(1000000, 2000000000);
    coordinatorIds.push(id);
    return id;
  };
  const engine = (coordinatorId, preview, propertyData = result => ({ price: result.price })) => createPropertyListingRefresh(scoped, {
    coordinatorId, preview, propertyData, now: () => clock, intervalMs, leaseMs,
    backoffMs: 30000, maxBackoffMs: 300000, maxAttempts: 3,
  });
  const moveToDue = job => { clock = Math.max(clock, Date.parse(job.nextAttemptAt || '') || clock); };

  try {
    for (let index = 1; index <= 3; index++) {
      const property = await prisma.property.create({ data: {
        title: `QA retomada ${suffix} ${index}`, address: 'Registro temporário de teste local',
        sourceUrl: `https://www.motiveimoveis.com/imovel/qa-${suffix}-${index}`,
        price: 100000, lastAvailabilityCheck: confirmedAt,
      } });
      propertyIds.push(property.id);
    }

    await t.test('sucessos e pendências sobrevivem à troca de instância e ao HTTP 429', async () => {
      const id = coordinator();
      let reads = 0;
      let limited = true;
      const preview = async sourceUrl => {
        reads++;
        if (sourceUrl.endsWith('-2') && limited) throw listingFailure(429, '120');
        if (sourceUrl.endsWith('-3')) throw listingFailure(404);
        return { price: 215000 };
      };
      const first = engine(id, preview);
      const starts = await Promise.all([first.action('start'), engine(id, preview).action('start')]);
      assert.equal(starts[0].job.id, starts[1].job.id, 'Inícios simultâneos criam uma única execução, mesmo sem a linha coordenadora existir.');
      let result = starts[0];
      const runId = result.job.id;
      assert.equal(result.job.total, 3);
      result = await first.action('step', runId);
      assert.equal(result.job.updatedCount, 1);
      moveToDue(result.job);
      result = await first.action('step', runId);
      assert.equal(result.job.status, 'waiting');
      assert.equal(result.job.processed, 1);
      assert.equal(result.job.pendingCount, 2);
      assert.deepEqual(result.job.failed, []);
      assert.ok(Date.parse(result.job.nextAttemptAt) >= clock + 120000);

      const restored = engine(id, preview);
      assert.equal((await restored.current()).job.id, runId);
      assert.equal((await restored.action('start')).job.id, runId, 'Outro usuário acompanha a mesma execução.');
      await restored.action('step', runId);
      assert.equal(reads, 2, 'Nenhuma consulta é feita antes do Retry-After.');
      moveToDue(result.job);
      limited = false;
      result = await restored.action('step', runId);
      assert.equal(result.job.updatedCount, 2);
      moveToDue(result.job);
      result = await restored.action('step', runId);
      assert.equal(result.job.status, 'completed');
      assert.equal(result.job.processed, 3);
      assert.equal(result.job.pendingCount, 0);
      assert.equal(result.job.failed[0].id, propertyIds[2]);
      assert.equal(reads, 4, 'Os imóveis já salvos não são consultados novamente.');
      const property = await prisma.property.findUnique({ where: { id: propertyIds[0] } });
      assert.equal(property.lastAvailabilityCheck.toISOString(), confirmedAt.toISOString());
      assert.equal(property.title, `QA retomada ${suffix} 1`);
    });

    await t.test('duas instâncias compartilham a lease e cancelamento impede gravação atrasada', async () => {
      const id = coordinator();
      let release;
      let entered;
      const ready = new Promise(resolve => { entered = resolve; });
      const gate = new Promise(resolve => { release = resolve; });
      let reads = 0;
      const preview = async () => { reads++; entered(); await gate; return { price: 999999 }; };
      const first = engine(id, preview);
      const second = engine(id, preview);
      const { job } = await first.action('start');
      const inFlight = first.action('step', job.id);
      await ready;
      try {
        await second.action('step', job.id);
        assert.equal(reads, 1, 'Somente uma instância pode consultar o site por vez.');
        await second.action('cancel', job.id);
        const replacement = await second.action('start');
        assert.notEqual(replacement.job.id, job.id);
        await second.action('step', replacement.job.id);
        assert.equal(reads, 1, 'Uma nova execução respeita a consulta anterior em andamento.');
      } finally { release(); }
      const stale = await inFlight;
      assert.equal(stale.updated.length, 0);
      assert.notEqual((await prisma.property.findUnique({ where: { id: propertyIds[0] } })).price, 999999);
    });

    await t.test('um HTTP 429 atrasado ainda protege a próxima execução', async () => {
      const id = coordinator();
      let release;
      let entered;
      const ready = new Promise(resolve => { entered = resolve; });
      const gate = new Promise(resolve => { release = resolve; });
      const first = engine(id, async () => { entered(); await gate; throw listingFailure(429, '180'); });
      const second = engine(id, async () => ({ price: 230000 }));
      const { job } = await first.action('start');
      const inFlight = first.action('step', job.id);
      await ready;
      try {
        await second.action('cancel', job.id);
        await second.action('start');
      } finally { release(); }
      await inFlight;
      const restored = await second.current();
      assert.ok(Date.parse(restored.job.nextAttemptAt) >= clock + 180000, 'O cooldown do site é global, mesmo se a execução original foi cancelada.');
      assert.equal(restored.job.updatedCount, 0);
      assert.equal(restored.job.pendingCount, 3);
    });

    await t.test('edição manual do link durante a consulta impede aplicar dados do anúncio antigo', async () => {
      const id = coordinator();
      let release;
      let entered;
      const ready = new Promise(resolve => { entered = resolve; });
      const gate = new Promise(resolve => { release = resolve; });
      const visited = [];
      const first = engine(id, async sourceUrl => {
        visited.push(sourceUrl);
        if (visited.length === 1) { entered(); await gate; }
        return { price: visited.length === 1 ? 999998 : 241000 };
      });
      const { job } = await first.action('start');
      const inFlight = first.action('step', job.id);
      await ready;
      const changedUrl = `https://www.motiveimoveis.com/imovel/qa-${suffix}-novo-link`;
      const manualTitle = `QA retomada ${suffix} título manual`;
      const manualDate = new Date('2026-11-17T00:00:00.000Z');
      try {
        await prisma.property.update({ where: { id: propertyIds[0] }, data: { sourceUrl: changedUrl, title: manualTitle, lastAvailabilityCheck: manualDate } });
      } finally { release(); }
      let result = await inFlight;
      assert.equal(result.updated.length, 0);
      assert.equal(result.job.pendingCount, 3);
      assert.deepEqual(result.job.failed, []);
      assert.notEqual((await prisma.property.findUnique({ where: { id: propertyIds[0] } })).price, 999998);
      moveToDue(result.job);
      result = await first.action('step', job.id);
      assert.equal(visited.at(-1), changedUrl);
      assert.equal(result.updated[0].price, 241000);
      assert.equal(result.updated[0].title, manualTitle);
      assert.equal(result.updated[0].lastAvailabilityCheck.toISOString(), manualDate.toISOString());
    });

    await t.test('falha de gravação mantém o imóvel pendente e permite retomar', async () => {
      const id = coordinator();
      let invalid = true;
      const first = engine(id, async () => ({ price: 240000 }), result => invalid ? { invalidQaField: true } : { price: result.price });
      let result = await first.action('start');
      result = await first.action('step', result.job.id);
      assert.equal(result.job.status, 'paused');
      assert.equal(result.job.updatedCount, 0);
      assert.equal(result.job.pendingCount, 3);
      assert.deepEqual(result.job.failed, []);
      assert.notEqual((await prisma.property.findUnique({ where: { id: propertyIds[0] } })).price, 240000);
      invalid = false;
      moveToDue(result.job);
      result = await first.action('resume', result.job.id);
      result = await first.action('step', result.job.id);
      assert.equal(result.job.updatedCount, 1);
      assert.equal(result.updated[0].price, 240000);
    });
  } finally {
    await prisma.propertyListingRefresh.deleteMany({ where: { id: { in: coordinatorIds } } });
    await prisma.property.deleteMany({ where: { id: { in: propertyIds }, title: { startsWith: `QA retomada ${suffix}` } } });
    await prisma.$disconnect();
  }
});
