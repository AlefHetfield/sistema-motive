import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { engineeringData, engineeringFilters, createEngineeringRouter } from '../api/engineeringRoutes.js';
import { addEngineeringDays, engineeringToday, engineeringValidity } from '../shared/engineeringValidity.js';

test('engenharias: vencimento soma 180 dias corridos e usa calendário de São Paulo', () => {
  assert.equal(addEngineeringDays('2026-10-28', 180), '2027-04-26');
  assert.equal(addEngineeringDays('2024-01-01', 180), '2024-06-29', 'Ano bissexto conta fevereiro com 29 dias.');
  assert.equal(addEngineeringDays('2026-10-28T00:00:00.000Z', 180), '2027-04-26');
  assert.equal(addEngineeringDays('2026-02-29', 180), null);
  assert.equal(addEngineeringDays(null, 180), null);
  assert.equal(addEngineeringDays(new Date('invalid'), 180), null);
  assert.equal(engineeringToday(new Date('2026-10-29T02:59:59Z')), '2026-10-28');
  assert.equal(engineeringToday(new Date('2026-10-29T03:00:00Z')), '2026-10-29');
  const today = '2026-10-28';
  for (const [remaining, state] of [[-1, 'expired'], [0, 'soon'], [1, 'soon'], [30, 'soon'], [31, 'valid'], [180, 'valid']]) {
    const requested = addEngineeringDays(today, remaining - 180);
    assert.deepEqual(engineeringValidity(requested, today), { expiresOn: addEngineeringDays(today, remaining), daysRemaining: remaining, state });
  }
  assert.deepEqual(engineeringValidity(null, today), { expiresOn: null, daysRemaining: null, state: 'undefined' });
});

test('engenharias: filtros de validade incluem limites antes de paginar e combinam com avaliação', () => {
  const today = '2026-10-28';
  const first = new Date(`${addEngineeringDays(today, -180)}T00:00:00.000Z`);
  const last = new Date(`${addEngineeringDays(today, -150)}T00:00:00.000Z`);
  assert.deepEqual(engineeringFilters({ validade: 'validas' }, today).where, { dataPedido: { gte: first } });
  assert.deepEqual(engineeringFilters({ validade: 'vencidas' }, today).where, { dataPedido: { lt: first } });
  assert.deepEqual(engineeringFilters({ validade: 'proximas', cidade: 'Sumaré', avaliacao: 'avaliada', page: '2', pageSize: '1' }, today), {
    page: 2, pageSize: 1, where: { cidade: { equals: 'Sumaré', mode: 'insensitive' }, valorAvaliado: { not: null }, dataPedido: { gte: first, lte: last } },
    orderBy: [{ dataPedido: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
  });
  for (const validade of ['invalid', ['validas'], { value: 'validas' }]) assert.throws(() => engineeringFilters({ validade }, today));
});

test('engenharias: valores monetários mantêm centavos, zero e limites sem coerção', () => {
  assert.deepEqual(engineeringData({ imovel: ' Casa ', valorImovel: '222000.10', valorAvaliado: 0 }, true), {
    imovel: 'Casa', valorImovel: '222000.10', valorAvaliado: '0.00',
  });
  assert.equal(engineeringData({ valorImovel: '9999999999999.99' }).valorImovel, '9999999999999.99');
  assert.equal(engineeringData({ valorAvaliado: '' }).valorAvaliado, null);
  for (const value of [-1, Infinity, '1e3', '1000,00', '1.234', true, [], {}, '10000000000000.00']) {
    assert.throws(() => engineeringData({ valorImovel: value }), /Valor do imóvel/);
  }
});

test('engenharias: datas reais, campos permitidos e identificadores são validados', () => {
  assert.equal(engineeringData({ dataPedido: '2028-02-29' }).dataPedido.toISOString(), '2028-02-29T00:00:00.000Z');
  assert.deepEqual(engineeringData({ dataPedido: null, propertyId: null, matricula: '  ' }), { dataPedido: null, propertyId: null, matricula: null });
  for (const value of ['2026-02-29', '2026-04-31', '2026-1-01', '2026-01-01T00:00:00Z', true, 12]) {
    assert.throws(() => engineeringData({ dataPedido: value }), /Data/);
  }
  for (const data of [{}, { imovel: '' }, { imovel: null }, { imovel: ' '.repeat(10) }, { imovel: 'x'.repeat(251) }]) {
    assert.throws(() => engineeringData(data, true));
  }
  for (const data of [{ propertyId: 0 }, { propertyId: '2abc' }, { propertyId: '' }, { propertyId: [] }, { propertyId: [1] }, { propertyId: 2147483648 }, { id: 2 }, { createdAt: '2026-01-01' }, { descricao: 'x'.repeat(10001) }, {}]) {
    assert.throws(() => engineeringData(data));
  }
  assert.throws(() => engineeringData([]));
  for (const query of [{ page: '0' }, { page: '1x' }, { pageSize: '101' }, { pageSize: '2.5' }, { sort: 'unknown' }, { avaliacao: 'unknown' }, { q: ['one', 'two'] }]) {
    assert.throws(() => engineeringFilters(query));
  }
});

function fixture() {
  const users = new Map([[1, { id: 1, role: 'ADM', isActive: true }], [2, { id: 2, role: 'ASSISTENTE', isActive: true }], [3, { id: 3, role: 'CORRETOR', isActive: true }], [4, { id: 4, role: 'ADM', isActive: false }]]);
  const properties = new Map([[10, { id: 10, title: 'Casa do mapa', code: 'CA0010', city: 'Sumaré', address: 'Rua Dez', neighborhood: 'Centro', price: 300000, status: 'Disponível', photoUrl: null, driveCoverFileId: null, ownerName: 'Privado' }]]);
  const records = new Map();
  let sequence = 0;
  const matches = (row, where = {}) => Object.entries(where).every(([key, filter]) => {
    if (key === 'OR') return filter.some(item => matches(row, item));
    if (key === 'property') return !!properties.get(row.propertyId) && matches(properties.get(row.propertyId), filter.is);
    const value = row[key];
    if (filter === null) return value === null;
    if (typeof filter === 'object') {
      if ('gte' in filter || 'lte' in filter || 'lt' in filter) return value !== null && value !== undefined
        && (!('gte' in filter) || value >= filter.gte) && (!('lte' in filter) || value <= filter.lte) && (!('lt' in filter) || value < filter.lt);
      if ('not' in filter) return value !== filter.not;
      if ('contains' in filter) return String(value || '').toLowerCase().includes(filter.contains.toLowerCase());
      if ('equals' in filter) return String(value || '').toLowerCase() === filter.equals.toLowerCase();
    }
    return value === filter;
  });
  const missing = () => { throw Object.assign(new Error('missing'), { code: 'P2025' }); };
  const present = (row, include) => {
    if (!row) return null;
    const property = properties.get(row.propertyId);
    return structuredClone({ ...row, ...(include ? { property: property ? Object.fromEntries(Object.keys(include.property.select).map(key => [key, property[key]])) : null } : {}) });
  };
  const prisma = {
    user: { findUnique: async ({ where }) => users.get(where.id) || null },
    property: { findUnique: async ({ where }) => properties.has(where.id) ? { id: where.id } : null },
    engineering: {
      findUnique: async ({ where, include }) => present(records.get(where.id), include),
      findMany: async ({ where, include, orderBy, skip = 0, take, distinct, select }) => {
        let rows = [...records.values()].filter(item => matches(item, where));
        if (distinct) return [...new Set(rows.map(item => item.cidade))].sort().map(cidade => ({ cidade }));
        const direction = orderBy[0].dataPedido.sort === 'desc' ? -1 : 1;
        rows.sort((a, b) => {
          if (a.dataPedido === null && b.dataPedido !== null) return 1;
          if (b.dataPedido === null && a.dataPedido !== null) return -1;
          return ((a.dataPedido?.getTime() || 0) - (b.dataPedido?.getTime() || 0) || a.id - b.id) * direction;
        });
        return rows.slice(skip, take === undefined ? undefined : skip + take).map(item => select ? { cidade: item.cidade } : present(item, include));
      },
      count: async ({ where } = {}) => [...records.values()].filter(item => matches(item, where)).length,
      create: async ({ data, include }) => {
        const row = { id: ++sequence, propertyId: null, cidade: null, matricula: null, dataPedido: null, valorImovel: null, valorAvaliado: null, descricao: null, createdAt: new Date(), updatedAt: new Date(), ...data };
        records.set(row.id, row);
        return present(row, include);
      },
      update: async ({ where, data, include }) => {
        const current = records.get(where.id) || missing();
        records.set(current.id, { ...current, ...data, updatedAt: new Date() });
        return present(records.get(current.id), include);
      },
      delete: async ({ where }) => { if (!records.delete(where.id)) missing(); },
    },
  };
  return { prisma, users, properties, records };
}

test('API: autenticação, perfil atual e usuário ativo protegem todas as operações', async t => {
  const { prisma, users } = fixture();
  const app = express();
  app.use(express.json());
  app.use('/engineerings', createEngineeringRouter(prisma, (req, res, next) => {
    if (!req.headers['x-user']) return res.sendStatus(401);
    req.user = { id: Number(req.headers['x-user']), role: 'ADM' };
    next();
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/engineerings`;
  const request = (user, path = '', method = 'GET') => fetch(`${base}${path}`, { method, headers: { ...(user ? { 'X-User': user } : {}), 'Content-Type': 'application/json' }, ...(method === 'POST' || method === 'PATCH' ? { body: JSON.stringify({ imovel: 'Casa' }) } : {}) });
  assert.equal((await request(null)).status, 401);
  for (const user of [3, 4, 99]) for (const [method, path] of [['GET', ''], ['GET', '/1'], ['POST', ''], ['PATCH', '/1'], ['DELETE', '/1']]) {
    assert.equal((await request(user, path, method)).status, user === 3 ? 403 : 401);
  }
  assert.equal((await request(1)).status, 200);
  assert.equal((await request(2)).status, 200);
  users.get(1).role = 'CORRETOR';
  assert.equal((await request(1)).status, 403, 'O perfil antigo do cookie não pode conceder acesso.');
});

test('API: CRUD independente, vínculo sem alterar mapa, filtros e paginação estável', async t => {
  const { prisma, properties } = fixture();
  const initialProperty = structuredClone(properties.get(10));
  const app = express();
  app.use(express.json());
  app.use('/engineerings', createEngineeringRouter(prisma, (req, res, next) => { req.user = { id: 1 }; next(); }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/engineerings`;
  const request = async (path = '', method = 'GET', body) => {
    const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json().catch(() => null) };
  };
  const independent = await request('', 'POST', { imovel: 'Exclusivo sem mapa', matricula: '12345', cidade: 'Hortolândia', valorImovel: '250000.90', descricao: 'Aguardando avaliação', dataPedido: '2026-10-20' });
  assert.equal(independent.status, 201);
  assert.equal(independent.data.property, null);
  const id = independent.data.id;
  assert.equal((await request(`/${id}`)).data.valorImovel, '250000.90');
  const linked = await request('', 'POST', { imovel: 'Outro imóvel', cidade: 'Sumaré', propertyId: 10, dataPedido: '2026-10-21', valorAvaliado: 0 });
  assert.equal(linked.data.property.code, 'CA0010');
  assert.equal('ownerName' in linked.data.property, false);
  assert.deepEqual(properties.get(10), initialProperty, 'Vincular não muda preço, status ou dados do mapa.');
  const third = await request('', 'POST', { imovel: 'Sem pedido ainda' });
  const page1 = (await request('?pageSize=1')).data;
  assert.equal(page1.items[0].id, linked.data.id);
  assert.equal(page1.total, 3);
  assert.deepEqual(page1.summary, { total: 3, pendentes: 2, avaliadas: 1 });
  assert.deepEqual(page1.cidades, ['Hortolândia', 'Sumaré']);
  assert.equal((await request('?pageSize=1&page=2')).data.items[0].id, id);
  assert.equal((await request('?sort=antigos&pageSize=1&page=3')).data.items[0].id, third.data.id, 'Sem data fica por último nas duas ordens.');
  assert.equal((await request('?q=CA0010')).data.total, 1, 'Busca inclui referência do mapa.');
  assert.equal((await request('?q=aguardando')).data.total, 1, 'Busca inclui descrição.');
  assert.equal((await request('?cidade=sumar%C3%A9&avaliacao=avaliada')).data.total, 1);
  assert.equal((await request('?avaliacao=pendente')).data.total, 2);
  assert.equal((await request('', 'POST', { imovel: 'Inválido', propertyId: 999 })).status, 404);
  assert.equal((await request('?pageSize=0')).status, 400);
  assert.equal((await request(`/${id}`, 'PATCH', { valorAvaliado: '260001.12', propertyId: 10 })).data.valorAvaliado, '260001.12');
  const unlinked = await request(`/${id}`, 'PATCH', { propertyId: null, dataPedido: null, descricao: '' });
  assert.equal(unlinked.data.propertyId, null);
  assert.equal(unlinked.data.property, null);
  assert.equal(unlinked.data.dataPedido, null);
  assert.equal(unlinked.data.descricao, null);
  assert.equal((await request(`/${id}`, 'DELETE')).status, 204);
  assert.equal((await request(`/${id}`)).status, 404);
  assert.equal((await request(`/${id}`, 'PATCH', { imovel: 'Já excluído' })).status, 404);
  assert.equal((await request(`/${id}`, 'DELETE')).status, 404);
  assert.deepEqual(properties.get(10), initialProperty);
});

test('API: validade filtra todas as páginas e distingue vencida, hoje, 30 e 31 dias', async t => {
  const { prisma } = fixture();
  const today = engineeringToday();
  const ids = new Map();
  for (const days of [-1, 0, 30, 31, null]) {
    const record = await prisma.engineering.create({ data: {
      imovel: `Prazo ${days}`, cidade: 'Sumaré', valorAvaliado: days === 30 ? null : '100.00',
      dataPedido: days === null ? null : new Date(`${addEngineeringDays(today, days - 180)}T00:00:00Z`),
    } });
    ids.set(days, record.id);
  }
  const app = express();
  app.use(express.json());
  app.use('/engineerings', createEngineeringRouter(prisma, (req, res, next) => { req.user = { id: 1 }; next(); }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/engineerings`;
  const get = async query => {
    const response = await fetch(`${base}?${query}`);
    assert.equal(response.status, 200);
    return response.json();
  };
  assert.deepEqual((await get('validade=vencidas')).items.map(item => item.id), [ids.get(-1)]);
  assert.deepEqual((await get('validade=validas')).items.map(item => item.id), [ids.get(31), ids.get(30), ids.get(0)]);
  const first = await get('validade=proximas&pageSize=1');
  const second = await get('validade=proximas&pageSize=1&page=2');
  assert.equal(first.total, 2);
  assert.equal(first.items[0].id, ids.get(30));
  assert.equal(second.items[0].id, ids.get(0));
  assert.equal((await get('validade=proximas&avaliacao=avaliada&cidade=Sumar%C3%A9&q=Prazo')).items[0].id, ids.get(0));
  assert.equal((await get('validade=proximas&avaliacao=pendente')).items[0].id, ids.get(30));
  assert.equal((await get('')).total, 5, 'Sem data continua no filtro Todas.');
  assert.equal((await fetch(`${base}?validade=unknown`)).status, 400);
});

test('PostgreSQL local: persistência de centavos/datas e exclusão de imóvel preserva engenharia', async () => {
  const database = new URL(process.env.DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(database.hostname), 'Este teste só pode usar banco local.');
  const prisma = new PrismaClient();
  const prefix = `engineering-test-${randomUUID()}`;
  let userId, propertyId, server;
  try {
    userId = (await prisma.user.create({ data: { nome: prefix, email: `${prefix}@example.test`, passwordHash: 'not-a-login-hash', role: 'ASSISTENTE' } })).id;
    propertyId = (await prisma.property.create({ data: { title: prefix, address: 'Endereço de teste', code: prefix, city: 'Sumaré', price: 350000 } })).id;
    const app = express();
    app.use(express.json());
    app.use('/engineerings', createEngineeringRouter(prisma, (req, res, next) => { req.user = { id: userId, role: 'ADM' }; next(); }));
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/engineerings`;
    const request = async (path = '', method = 'GET', body) => {
      const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json().catch(() => null) };
    };
    const created = await request('', 'POST', { imovel: `${prefix}-linked`, propertyId, matricula: '0000123', cidade: 'Sumaré', dataPedido: '2026-10-28', valorImovel: '350000.91', valorAvaliado: '360000.12' });
    assert.equal(created.status, 201);
    assert.equal(created.data.valorImovel, '350000.91');
    assert.equal(created.data.valorAvaliado, '360000.12');
    assert.equal(created.data.dataPedido.slice(0, 10), '2026-10-28');
    assert.equal(created.data.property.id, propertyId);
    assert.equal(created.data.matricula, '0000123');
    const independent = await request('', 'POST', { imovel: `${prefix}-independent`, dataPedido: '2026-10-27' });
    assert.equal(independent.status, 201);
    assert.equal(independent.data.propertyId, null);
    const firstPage = (await request(`?q=${prefix}&pageSize=1`)).data;
    const secondPage = (await request(`?q=${prefix}&pageSize=1&page=2`)).data;
    assert.equal(firstPage.total, 2);
    assert.equal(firstPage.items[0].id, created.data.id);
    assert.equal(secondPage.items[0].id, independent.data.id);
    assert.equal((await request(`?q=${prefix}&avaliacao=pendente`)).data.total, 1);
    assert.equal((await request(`?q=${prefix}&cidade=Sumar%C3%A9&avaliacao=avaliada`)).data.total, 1);
    const today = engineeringToday();
    const expiryIds = new Map();
    for (const days of [-1, 0, 30, 31, null]) {
      const edge = await request('', 'POST', { imovel: `${prefix}-validity-${days}`, cidade: 'Sumaré',
        dataPedido: days === null ? null : addEngineeringDays(today, days - 180), valorAvaliado: days === 30 ? null : '100.00' });
      assert.equal(edge.status, 201);
      expiryIds.set(days, edge.data.id);
    }
    const expiryQuery = `q=${prefix}-validity`;
    const expiring = (await request(`?${expiryQuery}&validade=proximas&pageSize=1`)).data;
    assert.equal(expiring.total, 2);
    assert.equal(expiring.items[0].id, expiryIds.get(30));
    assert.equal((await request(`?${expiryQuery}&validade=proximas&pageSize=1&page=2`)).data.items[0].id, expiryIds.get(0));
    assert.equal((await request(`?${expiryQuery}&validade=validas`)).data.total, 3);
    assert.deepEqual((await request(`?${expiryQuery}&validade=vencidas`)).data.items.map(item => item.id), [expiryIds.get(-1)]);
    assert.equal((await request(`?${expiryQuery}&validade=proximas&avaliacao=avaliada&cidade=Sumar%C3%A9`)).data.items[0].id, expiryIds.get(0));
    await request(`/${expiryIds.get(-1)}`, 'PATCH', { dataPedido: today });
    assert.equal((await request(`?${expiryQuery}&validade=vencidas`)).data.total, 0, 'Alterar pedido recalcula validade automaticamente.');
    assert.equal((await request(`?${expiryQuery}`)).data.total, 5, 'Registro sem data só participa de Todas.');
    const updated = await request(`/${created.data.id}`, 'PATCH', { valorAvaliado: '370000.02', descricao: 'Laudo recebido' });
    assert.equal(updated.status, 200);
    const saved = await prisma.engineering.findUnique({ where: { id: created.data.id } });
    assert.equal(saved.valorAvaliado.toFixed(2), '370000.02');
    assert.equal(saved.descricao, 'Laudo recebido');
    const originalProperty = await prisma.property.findUnique({ where: { id: propertyId } });
    assert.equal(originalProperty.price, 350000);
    assert.equal(originalProperty.status, 'Disponível');
    await prisma.property.delete({ where: { id: propertyId } });
    propertyId = null;
    const afterPropertyRemoval = (await request(`/${created.data.id}`)).data;
    assert.equal(afterPropertyRemoval.propertyId, null);
    assert.equal(afterPropertyRemoval.property, null);
    assert.equal(afterPropertyRemoval.imovel, `${prefix}-linked`);
    assert.equal(afterPropertyRemoval.valorAvaliado, '370000.02');
    assert.equal((await request(`/${independent.data.id}`, 'DELETE')).status, 204);
    assert.equal((await request(`/${independent.data.id}`)).status, 404);
    await prisma.user.update({ where: { id: userId }, data: { role: 'CORRETOR' } });
    assert.equal((await request()).status, 403, 'Mudança de papel no banco revoga acesso imediatamente.');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await prisma.engineering.deleteMany({ where: { imovel: { startsWith: prefix } } });
    if (propertyId) await prisma.property.deleteMany({ where: { id: propertyId } });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
});
