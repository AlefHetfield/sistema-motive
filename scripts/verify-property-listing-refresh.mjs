import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { createPropertyListingRefresh, retryAfterMilliseconds } from '../api/propertyListingRefresh.js';
import { createPropertyRouter } from '../api/propertyRoutes.js';

const copy = value => structuredClone(value);
const throttle = retryAfter => Object.assign(new Error('Site limitou consultas'), { kind: 'connection', upstreamStatus: 429, retryAfter });
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

export function refreshFixture(count = 3) {
  let rows = new Map();
  let properties = new Map(Array.from({ length: count }, (_, index) => [index + 1, {
    id: index + 1, code: `CA${index + 1}`, title: `Nome manual ${index + 1}`,
    sourceUrl: `https://www.motiveimoveis.com/imovel/CA${index + 1}`, price: 100000,
    lastAvailabilityCheck: index === 0 ? new Date('2026-09-15T00:00:00Z') : null,
  }]));
  let clock = Date.parse('2026-11-17T14:00:00Z');
  let queue = Promise.resolve();
  let failWrite = false;
  const tx = {
    propertyListingRefresh: {
      upsert: async ({ where, create }) => {
        if (!rows.has(where.id)) rows.set(where.id, { id: create.id, runId: null, status: 'idle', total: 0, pendingIds: [], updatedIds: [], failed: [], retryAttempt: 0, nextAttemptAt: null, leaseToken: null, leaseUntil: null, message: '' });
        return copy(rows.get(where.id));
      },
      findUnique: async ({ where }) => copy(rows.get(where.id) || null),
      update: async ({ where, data }) => {
        const row = { ...rows.get(where.id), ...copy(data) };
        rows.set(where.id, row);
        return copy(row);
      },
    },
    $queryRaw: async () => [],
    property: {
      findMany: async () => [...properties.values()].map(property => ({ id: property.id })),
      findUnique: async ({ where }) => copy(properties.get(where.id) || null),
      update: async ({ where, data }) => {
        if (failWrite) { failWrite = false; throw Object.assign(new Error('Database write unavailable'), { code: 'P1001' }); }
        const property = { ...properties.get(where.id), ...copy(data) };
        properties.set(where.id, property);
        return copy(property);
      },
    },
  };
  const prisma = {
    ...tx,
    $transaction: operation => {
      const result = queue.then(async () => {
        const originalRows = copy(rows);
        const originalProperties = copy(properties);
        try { return await operation(tx); }
        catch (error) { rows = originalRows; properties = originalProperties; throw error; }
      });
      queue = result.catch(() => {});
      return result;
    },
  };
  const make = (preview = async () => ({ price: 415000 }), options = {}) => createPropertyListingRefresh(prisma, {
    preview, propertyData: result => result, now: () => clock,
    intervalMs: 2000, backoffMs: 30000, ...options,
  });
  return {
    prisma, make, now: () => clock, advance: ms => { clock += ms; },
    at: date => { clock = new Date(date).getTime(); },
    properties: () => copy([...properties.values()]), row: () => copy(rows.get(1)),
    changeProperty: (id, data) => { properties.set(id, { ...properties.get(id), ...data }); },
    failWrite: () => { failWrite = true; },
  };
}

test('consulta um imóvel por etapa, compartilha execução e respeita o intervalo entre consultas', async () => {
  const fixture = refreshFixture(2);
  const calls = [];
  const service = fixture.make(async url => { calls.push(url); return { price: 415000 }; });
  assert.equal((await service.current()).job, null);
  const start = await service.action('start');
  assert.equal(start.job.total, 2);
  assert.equal(start.job.status, 'running');
  assert.equal(calls.length, 0, 'Iniciar não consulta o site.');
  assert.equal((await fixture.make().action('start')).job.id, start.job.id, 'Outro usuário entra na mesma execução.');
  const first = await service.action('step', start.job.id);
  assert.equal(first.updated.length, 1);
  assert.equal(first.job.processed, 1);
  assert.equal(first.job.pendingCount, 1);
  assert.equal(first.job.status, 'running', 'Intervalo normal não é bloqueio do site.');
  await service.action('step', start.job.id);
  assert.equal(calls.length, 1);
  fixture.advance(2000);
  const last = await service.action('step', start.job.id);
  assert.equal(last.job.status, 'completed');
  assert.equal(last.job.processed, 2);
  assert.equal(last.job.updatedCount, 2);
  assert.equal(last.job.pendingCount, 0);
  assert.equal(calls.length, 2);
  await service.action('step', start.job.id);
  assert.equal(calls.length, 2);
});

test('sucesso seguido de429 preserva os IDs pendentes e retoma sem repetir imóveis já atualizados', async () => {
  const fixture = refreshFixture();
  const calls = [];
  let limited = true;
  const service = fixture.make(async url => {
    calls.push(url);
    if (url.endsWith('CA2') && limited) throw throttle('90');
    return { price: 415000 };
  });
  const { job } = await service.action('start');
  await service.action('step', job.id);
  fixture.advance(2000);
  const waiting = await service.action('step', job.id);
  assert.equal(waiting.job.status, 'waiting');
  assert.equal(waiting.job.delayReason, 'rate_limit');
  assert.equal(waiting.job.updatedCount, 1);
  assert.equal(waiting.job.pendingCount, 2);
  assert.deepEqual(waiting.job.failed, []);
  assert.equal(new Date(waiting.job.nextAttemptAt).getTime(), fixture.now() + 90000);
  const refreshedService = fixture.make(async url => { calls.push(url); return { price: 415000 }; });
  assert.deepEqual((await refreshedService.current()).job, waiting.job, 'Reabrir/reiniciar o serviço conserva progresso e espera.');
  fixture.advance(89999);
  await refreshedService.action('step', job.id);
  assert.equal(calls.length, 2);
  fixture.advance(1);
  limited = false;
  const recovered = await refreshedService.action('step', job.id);
  assert.equal(recovered.job.updatedCount, 2);
  assert.equal(recovered.job.retryAttempt, 0);
  fixture.advance(2000);
  assert.equal((await refreshedService.action('step', job.id)).job.status, 'completed');
  assert.equal(calls.filter(url => url.endsWith('CA1')).length, 1);
});

test('Retry-After aceita segundos e data HTTP; nunca reduz a espera indicada pelo fornecedor', async () => {
  const now = Date.parse('2026-11-17T14:00:00Z');
  assert.equal(retryAfterMilliseconds('90', now), 90000);
  assert.equal(retryAfterMilliseconds('Tue, 17 Nov 2026 15:00:00 GMT', now), 3600000);
  assert.equal(retryAfterMilliseconds('Tue, 17 Nov 2026 13:00:00 GMT', now), 0);
  for (const value of [null, '', 'invalid', '99999999999999999999']) assert.equal(retryAfterMilliseconds(value, now), null);
  const fixture = refreshFixture(1);
  const service = fixture.make(async () => { throw throttle('3600'); });
  const { job } = await service.action('start');
  const waiting = await service.action('step', job.id);
  assert.equal(new Date(waiting.job.nextAttemptAt).getTime(), fixture.now() + 3600000, 'Cabeçalho maior que fallback de5min é respeitado.');
  await service.action('cancel', job.id);
  assert.equal((await service.action('resume', job.id)).job.status, 'cancelled');
  const next = await service.action('start');
  assert.notEqual(next.job.id, job.id);
  assert.equal(next.job.nextAttemptAt, waiting.job.nextAttemptAt, 'Cancelar e iniciar de novo não contorna a pausa global.');
});

test('espera progressiva tem limite de tentativas e retoma manualmente somente após a espera', async () => {
  const fixture = refreshFixture(1);
  let calls = 0;
  const service = fixture.make(async () => { calls++; throw throttle(); });
  const { job } = await service.action('start');
  for (const [attempt, delay] of [[1, 30000], [2, 60000], [3, 120000]]) {
    const result = await service.action('step', job.id);
    assert.equal(result.job.retryAttempt, attempt);
    assert.equal(result.job.status, attempt === 3 ? 'paused' : 'waiting');
    assert.equal(result.job.pendingCount, 1);
    assert.deepEqual(result.job.failed, []);
    assert.equal(new Date(result.job.nextAttemptAt).getTime(), fixture.now() + delay);
    if (attempt < 3) fixture.advance(delay);
  }
  assert.equal((await service.action('start')).job.id, job.id, 'Iniciar não zera tentativas de uma execução pausada.');
  await service.action('step', job.id);
  assert.equal((await service.action('resume', job.id)).job.status, 'paused');
  assert.equal(calls, 3);
  fixture.advance(120000);
  const resumed = await fixture.make().action('resume', job.id);
  assert.equal(resumed.job.status, 'running');
  assert.equal(resumed.job.retryAttempt, 0);
  assert.equal((await fixture.make().action('step', job.id)).job.status, 'completed');
});

test('anúncio404 vai para revisão e não impede os próximos; falha de conexão continua pendente', async () => {
  const fixture = refreshFixture(2);
  const service = fixture.make(async url => {
    if (url.endsWith('CA1')) throw Object.assign(new Error('Anúncio não encontrado'), { status: 404, kind: 'listing' });
    throw Object.assign(new Error('Timeout'), { kind: 'connection' });
  });
  const { job } = await service.action('start');
  const first = await service.action('step', job.id);
  assert.equal(first.job.failed.length, 1);
  assert.equal(first.job.processed, 1);
  fixture.advance(2000);
  const waiting = await service.action('step', job.id);
  assert.equal(waiting.job.status, 'waiting');
  assert.equal(waiting.job.failed.length, 1);
  assert.equal(waiting.job.pendingCount, 1);
});

test('dois usuários/instâncias não consultam simultaneamente; cancelamento invalida resultados em voo', async () => {
  const fixture = refreshFixture(1);
  const gate = deferred();
  let calls = 0;
  const preview = async () => { calls++; await gate.promise; return { price: 999999 }; };
  const firstService = fixture.make(preview);
  const secondService = fixture.make(preview);
  const { job } = await firstService.action('start');
  const inflight = firstService.action('step', job.id);
  while (!calls) await new Promise(resolve => setImmediate(resolve));
  assert.equal((await secondService.action('step', job.id)).job.updatedCount, 0);
  assert.equal(calls, 1);
  const cancelled = await secondService.action('cancel', job.id);
  assert.equal(cancelled.job.status, 'cancelled');
  const next = await secondService.action('start');
  assert.notEqual(next.job.id, job.id);
  await secondService.action('step', next.job.id);
  assert.equal(calls, 1, 'Nova execução aguarda o lease anterior.');
  gate.resolve();
  const stale = await inflight;
  assert.equal(stale.job.id, next.job.id);
  assert.equal(stale.job.updatedCount, 0);
  assert.equal(fixture.properties()[0].price, 100000);
  fixture.advance(30000);
  assert.equal((await secondService.action('step', next.job.id)).job.status, 'completed');
  assert.equal(calls, 2);
});

test('429 de requisição cancelada estende a pausa global sem aceitar o resultado antigo', async () => {
  const fixture = refreshFixture(1);
  const gate = deferred();
  let calls = 0;
  const service = fixture.make(async () => { calls++; await gate.promise; throw throttle('3600'); });
  const { job } = await service.action('start');
  const inflight = service.action('step', job.id);
  while (!calls) await new Promise(resolve => setImmediate(resolve));
  await service.action('cancel', job.id);
  const next = await service.action('start');
  gate.resolve();
  const delayed = await inflight;
  assert.equal(delayed.job.id, next.job.id);
  assert.equal(delayed.job.status, 'waiting');
  assert.equal(delayed.job.updatedCount, 0);
  assert.equal(delayed.job.processed, 0);
  assert.equal(delayed.job.pendingCount, 1);
  assert.equal(new Date(delayed.job.nextAttemptAt).getTime(), fixture.now() + 3600000);
  fixture.advance(30000);
  await service.action('step', next.job.id);
  assert.equal(calls, 1);
});

test('lease expirado não pode gravar imóvel ou progresso, e etapas antigas nunca reiniciam uma execução', async () => {
  const fixture = refreshFixture(1);
  const gate = deferred();
  let calls = 0;
  const service = fixture.make(async () => { calls++; await gate.promise; return { price: 999999 }; });
  const { job } = await service.action('start');
  const inflight = service.action('step', job.id);
  while (!calls) await new Promise(resolve => setImmediate(resolve));
  fixture.advance(30001);
  gate.resolve();
  const stale = await inflight;
  assert.equal(stale.updated.length, 0);
  assert.equal(stale.job.updatedCount, 0);
  assert.equal(fixture.properties()[0].price, 100000);
  await service.action('cancel', job.id);
  const next = await service.action('start');
  assert.equal((await service.action('step', job.id)).job.id, next.job.id);
  assert.equal(calls, 1);
});

test('falha de banco não consome imóvel pendente nem vira revisão do anúncio', async () => {
  const fixture = refreshFixture(1);
  const service = fixture.make();
  const { job } = await service.action('start');
  fixture.failWrite();
  const paused = await service.action('step', job.id);
  assert.equal(paused.job.status, 'paused');
  assert.equal(paused.job.delayReason, 'storage');
  assert.equal(paused.job.updatedCount, 0);
  assert.equal(paused.job.pendingCount, 1);
  assert.equal(paused.job.failed.length, 0);
  assert.equal(fixture.properties()[0].price, 100000);
  fixture.advance(2000);
  await service.action('resume', job.id);
  assert.equal((await service.action('step', job.id)).job.status, 'completed');
});

test('cancelamento pode retomar os pendentes sem repetir sucessos; ações inválidas são recusadas', async () => {
  const fixture = refreshFixture(2);
  const service = fixture.make();
  const { job } = await service.action('start');
  await service.action('step', job.id);
  const cancelled = await service.action('cancel', job.id);
  assert.equal(cancelled.job.pendingCount, 1);
  fixture.advance(2000);
  assert.equal((await service.action('resume', job.id)).job.status, 'running');
  assert.equal((await service.action('step', job.id)).job.updatedCount, 2);
  await assert.rejects(service.action('unknown'), error => error.status === 400);
  await assert.rejects(service.action('step'), error => error.status === 400);
});

test('troca manual de link durante a consulta preserva a edição e reconsulta o imóvel pendente', async () => {
  for (const obsolete404 of [false, true]) {
    const fixture = refreshFixture(1);
    const gate = deferred();
    const calls = [];
    const service = fixture.make(async url => {
      calls.push(url);
      if (calls.length === 1) {
        await gate.promise;
        if (obsolete404) throw Object.assign(new Error('Anúncio antigo removido'), { kind: 'listing', status: 404 });
      }
      return { price: 415000 };
    });
    const { job } = await service.action('start');
    const inflight = service.action('step', job.id);
    while (!calls.length) await new Promise(resolve => setImmediate(resolve));
    const newUrl = 'https://www.motiveimoveis.com/imovel/NEW123';
    fixture.changeProperty(1, { sourceUrl: newUrl, title: 'Novo título manual' });
    gate.resolve();
    const stale = await inflight;
    assert.equal(stale.job.pendingCount, 1);
    assert.equal(stale.job.processed, 0);
    assert.deepEqual(stale.job.failed, []);
    assert.equal(fixture.properties()[0].sourceUrl, newUrl);
    assert.equal(fixture.properties()[0].price, 100000);
    fixture.advance(2000);
    assert.equal((await service.action('step', job.id)).job.status, 'completed');
    assert.equal(calls[1], newUrl);
    assert.equal(fixture.properties()[0].title, 'Novo título manual');
  }
});

test('rota HTTP transforma429 real do transporte em pausa e respeita Retry-After sem consultar novamente cedo', async () => {
  const fixture = refreshFixture(1);
  const realFetch = globalThis.fetch;
  let listingReads = 0;
  globalThis.fetch = async (url, options) => {
    const target = new URL(String(url));
    if (target.hostname === '127.0.0.1') return realFetch(url, options);
    assert.equal(target.hostname, 'www.motiveimoveis.com', 'Nenhum serviço externo deve ser acessado.');
    listingReads++;
    return { ok: false, status: 429, headers: new Headers({ 'Retry-After': '90' }) };
  };
  let server;
  try {
    const app = express();
    app.use(express.json());
    app.use('/properties', createPropertyRouter(fixture.prisma, (req, res, next) => {
      req.user = { id: 1, nome: 'Teste', role: 'ADM' }; next();
    }, { listingRefreshOptions: { now: fixture.now, intervalMs: 2000, backoffMs: 30000 } }));
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}/properties/refresh-listings`;
    const request = async body => {
      const response = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(response.status, 200);
      return response.json();
    };
    const { job } = await request({ action: 'start' });
    const waiting = await request({ action: 'step', jobId: job.id });
    assert.equal(waiting.job.status, 'waiting');
    assert.equal(waiting.job.delayReason, 'rate_limit');
    assert.deepEqual(waiting.job.failed, []);
    assert.equal(waiting.job.pendingCount, 1);
    assert.equal(new Date(waiting.job.nextAttemptAt).getTime(), fixture.now() + 90000);
    await request({ action: 'step', jobId: job.id });
    assert.equal(listingReads, 1);
    const current = await (await fetch(`${base}/current`)).json();
    assert.deepEqual(current.job, waiting.job);
  } finally {
    globalThis.fetch = realFetch;
    if (server) await new Promise(resolve => server.close(resolve));
  }
});
