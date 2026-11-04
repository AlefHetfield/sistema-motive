import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { createPropertyRouter } from '../api/propertyRoutes.js';

test('disponibilidade do imóvel só é confirmada por preenchimento manual', async () => {
  const confirmedAt = new Date('2026-09-15T00:00:00.000Z');
  const records = new Map([
    [1, { id: 1, code: 'CA001', title: 'Casa confirmada', address: 'Rua Um, 10', price: 300000, sourceUrl: 'https://www.motiveimoveis.com/imovel/CA001', lastAvailabilityCheck: confirmedAt }],
    [2, { id: 2, code: 'CA002', title: 'Casa sem confirmação', address: 'Rua Dois, 20', price: 200000, sourceUrl: 'https://www.motiveimoveis.com/imovel/CA002', lastAvailabilityCheck: null }],
  ]);
  const writes = [];
  let sequence = 2;
  const prisma = { property: {
    findMany: async ({ where = {}, take } = {}) => [...records.values()]
      .filter(record => !where.id?.gt || record.id > where.id.gt)
      .filter(record => !where.sourceUrl?.contains || record.sourceUrl?.includes(where.sourceUrl.contains))
      .slice(0, take),
    findUnique: async ({ where }) => structuredClone(records.get(where.id) || null),
    create: async ({ data }) => {
      const record = { id: ++sequence, lastAvailabilityCheck: null, ...data };
      records.set(record.id, structuredClone(record));
      return record;
    },
    update: async ({ where, data }) => {
      assert.ok(records.has(where.id));
      writes.push({ id: where.id, data: structuredClone(data) });
      const record = { ...records.get(where.id), ...data };
      records.set(where.id, structuredClone(record));
      return record;
    },
  } };
  const realFetch = globalThis.fetch;
  let listingReads = 0;
  globalThis.fetch = async (url, options) => {
    const target = new URL(String(url));
    if (target.hostname === '127.0.0.1') return realFetch(url, options);
    assert.equal(target.hostname, 'www.motiveimoveis.com', 'Nenhum serviço externo deve ser acessado.');
    listingReads++;
    return {
      ok: true, status: 200, url: target.href, headers: new Headers(),
      text: async () => '<html><meta property="og:image" content="https://example.test/property.jpg"><script>{"sale_price":[415000]}</script></html>',
    };
  };
  const app = express();
  app.use(express.json());
  app.use('/properties', createPropertyRouter(prisma, (req, res, next) => {
    req.user = { id: 1, nome: 'Teste', role: 'ADM' }; next();
  }));
  let server;
  try {
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}/properties`;
    const request = async (path, method, body) => {
      const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { status: response.status, data: await response.json() };
    };

    const refreshed = await request('/refresh-listings', 'POST', { limit: 6 });
    assert.equal(refreshed.status, 200);
    assert.equal(refreshed.data.updated.length, 2);
    assert.equal(listingReads, 2);
    assert.equal(records.get(1).lastAvailabilityCheck.toISOString(), confirmedAt.toISOString(), 'Atualização do site preserva a data manual existente.');
    assert.equal(records.get(2).lastAvailabilityCheck, null, 'Atualização do site não confirma imóvel sem data.');
    for (const write of writes) assert.equal(Object.hasOwn(write.data, 'lastAvailabilityCheck'), false, 'Rotina automática não envia data de confirmação.');
    assert.equal(records.get(1).price, 415000, 'Os dados do anúncio continuam sendo atualizados.');
    assert.equal(records.get(2).photoUrl, 'https://example.test/property.jpg');

    const basic = { code: 'CA003', title: 'Novo imóvel', address: 'Rua Três, 30', latitude: -22.8, longitude: -47.2 };
    const created = await request('', 'POST', basic);
    assert.equal(created.status, 201);
    assert.equal(created.data.lastAvailabilityCheck, null, 'Cadastro sem preenchimento fica sem confirmação.');
    const manual = await request('', 'POST', { ...basic, code: 'CA004', lastAvailabilityCheck: '2026-11-03' });
    assert.equal(manual.status, 201);
    assert.equal(manual.data.lastAvailabilityCheck, '2026-11-03T00:00:00.000Z');

    const unchanged = await request('/1', 'PUT', { ...basic, title: 'Título alterado' });
    assert.equal(unchanged.status, 200);
    assert.equal(unchanged.data.lastAvailabilityCheck, confirmedAt.toISOString(), 'Alterar outros dados sem informar data preserva a confirmação.');
    const changed = await request('/1', 'PUT', { ...basic, lastAvailabilityCheck: '2026-11-04' });
    assert.equal(changed.status, 200);
    assert.equal(changed.data.lastAvailabilityCheck, '2026-11-04T00:00:00.000Z');
    const cleared = await request('/1', 'PUT', { ...basic, lastAvailabilityCheck: '' });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.data.lastAvailabilityCheck, null, 'O usuário pode apagar a confirmação manualmente.');
    const explicitNull = await request('/4', 'PUT', { ...basic, lastAvailabilityCheck: null });
    assert.equal(explicitNull.status, 200);
    assert.equal(explicitNull.data.lastAvailabilityCheck, null);
  } finally {
    globalThis.fetch = realFetch;
    if (server) await new Promise(resolve => server.close(resolve));
  }
});
