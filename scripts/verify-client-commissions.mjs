import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import express from 'express';
import { buildCommissionReport, clientWriteData, commissionReportInput, createCommissionReportHandler, currentClientUser, presentClient } from '../api/clientCommission.js';
import { getClientCommissionBreakdown, isVaniaBroker, summarizeClientCommissions } from '../frontend/src/utils/clientCommission.js';

const now = new Date('2026-11-10T18:00:00.000Z');
const admin = { id: 1, nome: 'Administrador', role: 'ADM', isActive: true };
const assistant = { id: 2, nome: 'Assistente', role: 'ASSISTENTE', isActive: true };
const broker = { id: 3, nome: 'Corretor', role: 'CORRETOR', isActive: true };
const client = (id, amount, data = {}) => ({ id, nome: `Cliente ${id}`, imovel: `Imóvel ${id}`, status: 'Aprovado', observacoes: '', venda: true, corretor: 'Outro corretor', comissaoEstimada: amount, visitaDiego: false, descontosComissao: [], ...data });

async function serve(t, prisma) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    if (!req.get('X-User')) return res.status(401).json({ error: 'Não autenticado.' });
    req.user = { id: Number(req.get('X-User')), role: 'ADM' };
    next();
  });
  app.use(currentClientUser(prisma));
  app.post('/commission-report', createCommissionReportHandler(prisma, () => now));
  app.get('/clients', async (req, res) => res.json((await prisma.client.findMany({})).map(item => presentClient(item, req.user))));
  app.put('/clients/:id', async (req, res) => {
    const id = Number(req.params.id);
    const update = async tx => {
      if (tx.$queryRaw) await tx.$queryRaw`SELECT /* qa-commission-fixture-lock */ "id" FROM "clients" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.client.findUnique({ where: { id } });
      if (!current) throw Object.assign(new Error('Cliente não encontrado.'), { status: 404 });
      return tx.client.update({ where: { id }, data: clientWriteData(req.body, req.user, current) });
    };
    const updated = prisma.$transaction ? await prisma.$transaction(update) : await update(prisma);
    res.json(presentClient(updated, req.user));
  });
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(error.status || 500).json({ error: error.message, ...(error.code ? { code: error.code } : {}) });
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  return (user, path, body, method = body === undefined ? 'GET' : 'POST') => fetch(`${base}${path}`, {
    method,
    headers: { ...(user === null ? {} : { 'X-User': String(user) }), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function fixture() {
  const users = new Map([admin, assistant, broker, { ...admin, id: 4, isActive: false }].map(user => [user.id, { ...user }]));
  const records = new Map([client(1, '8500.00'), client(2, '12000.00', { status: 'Assinando Contrato', observacoes: 'Aguardando assinatura.\nContato realizado hoje.' }), client(3, null), client(4, '999.00', { venda: false })].map(item => [item.id, item]));
  const state = { failUsers: false, failClients: false };
  const prisma = {
    user: { findUnique: async ({ where }) => {
      if (state.failUsers) throw new Error('Banco indisponível.');
      return users.get(where.id) || null;
    } },
    client: {
      findUnique: async ({ where }) => records.get(where.id) || null,
      findMany: async ({ where } = {}) => {
        if (state.failClients) throw new Error('Consulta indisponível.');
        return [...records.values()].filter(item => !where || where.id.in.includes(item.id) && item.venda === where.venda);
      },
      update: async ({ where, data }) => {
        const updated = { ...records.get(where.id), ...data };
        records.set(where.id, updated);
        return updated;
      },
    },
  };
  return { prisma, users, records, state };
}

test('comissão estimada aceita centavos, zero e ausência com limite decimal do banco', () => {
  assert.deepEqual(clientWriteData({ comissaoEstimada: '8500.2' }, admin), { comissaoEstimada: '8500.20' });
  assert.equal(clientWriteData({ comissaoEstimada: 0 }, admin).comissaoEstimada, '0.00');
  assert.equal(clientWriteData({ comissaoEstimada: '9999999999999.99' }, admin).comissaoEstimada, '9999999999999.99');
  for (const value of [null, '']) assert.equal(clientWriteData({ comissaoEstimada: value }, admin).comissaoEstimada, null);
  for (const value of [-1, '-0.01', '10000000000000.00', '1.001', '8.500,00', '1e5', Infinity, NaN, true, {}, { set: 1 }]) {
    assert.throws(() => clientWriteData({ comissaoEstimada: value }, admin), error => error.status === 400);
  }
  assert.deepEqual(clientWriteData({ venda: false }, assistant), { venda: false });
});

test('somente ADM pode escrever ou receber comissão, inclusive zero e null', () => {
  for (const user of [assistant, broker]) {
    for (const value of [null, '0.00', '8500.00']) assert.throws(() => clientWriteData({ comissaoEstimada: value }, user), error => error.status === 403);
    for (const body of [{ visitaDiego: false }, { visitaDiego: true }, { descontosComissao: [] }, { descontosComissao: [{ descricao: 'Ajuste', valor: '1.00' }] }]) {
      assert.throws(() => clientWriteData(body, user), error => error.status === 403);
    }
    const redacted = presentClient(client(1, '8500.00', { visitaDiego: true, descontosComissao: [{ descricao: 'Ajuste', valor: '250.00' }] }), user);
    for (const field of ['comissaoEstimada', 'visitaDiego', 'descontosComissao']) assert.equal(Object.hasOwn(redacted, field), false);
    assert.equal(redacted.nome, 'Cliente 1');
    for (const relation of ['property', 'simulacoes', 'contratos', 'tasks']) assert.throws(() => clientWriteData({ [relation]: { update: {} } }, user));
  }
  assert.equal(presentClient(client(1, '8500.00'), admin).comissaoEstimada, '8500.00');
});

test('relatório soma valores exatos, distingue zero e pendência e inclui status e observações', () => {
  const report = buildCommissionReport([
    client(1, '0.10', { status: 'Engenharia Solicitada', emEspera: true, observacoes: 'Conferir matrícula.\nAguardando retorno.' }),
    client(2, '0.20'), client(3, '0.00'), client(4, null), client(5, '999.00', { venda: false }),
  ], { scope: 'Ativos · Sumaré', generatedAt: now });
  assert.equal(report.total, '0.30');
  assert.equal(report.count, 4);
  assert.equal(report.missingCount, 1);
  assert.equal(report.items[2].comissaoEstimada, '0.00');
  assert.match(report.text, /Status — Engenharia Solicitada · Em espera/);
  assert.match(report.text, /Observações — Conferir matrícula\.\nAguardando retorno\./);
  assert.match(report.text, /TOTAL LÍQUIDO ESTIMADO — R\$\s0,30/);
  assert.match(report.text, /Ativos · Sumaré/);
  assert.match(report.text, /10\/11\/2026/);
  assert.equal((report.text.match(/Observações —/g) || []).length, 1);
  const large = buildCommissionReport(Array.from({ length: 5000 }, (_, index) => client(index + 1, '9999999999999.99')), { scope: 'Todas', generatedAt: now });
  assert.equal(large.total, '49999999999999950.00');
  assert.match(large.text, /R\$\s49\.999\.999\.999\.999\.950,00/);
});

test('descontos validam descrição, valor positivo, quantidade e tipos escalares antes de gravar', () => {
  assert.deepEqual(clientWriteData({ descontosComissao: [{ descricao: '  Ajuste comercial  ', valor: '250.5' }] }, admin), {
    descontosComissao: [{ descricao: 'Ajuste comercial', valor: '250.50' }],
  });
  assert.equal(clientWriteData({ visitaDiego: true }, admin).visitaDiego, true);
  assert.equal(clientWriteData({ descontosComissao: Array.from({ length: 100 }, () => ({ descricao: 'Ajuste', valor: '0.01' })) }, admin).descontosComissao.length, 100);
  for (const value of [null, {}, 'Ajuste', [{ descricao: '', valor: '1.00' }], [{ descricao: '  ', valor: '1.00' }], [{ descricao: 'a'.repeat(101), valor: '1.00' }], [{ descricao: 'Ajuste', valor: '0.00' }], [{ descricao: 'Ajuste', valor: '-1.00' }], [{ descricao: 'Ajuste', valor: null }], [{ descricao: 'Ajuste', valor: '1.001' }], [{ descricao: 'Ajuste', valor: { set: 1 } }], [{ descricao: 'Ajuste', valor: '1.00', id: 1 }], Array.from({ length: 101 }, () => ({ descricao: 'Ajuste', valor: '1.00' }))]) {
    assert.throws(() => clientWriteData({ descontosComissao: value }, admin), error => error.status === 400);
  }
  for (const body of [{ visitaDiego: 'true' }, { visitaDiego: 1 }, { visitaDiego: { set: true } }, { venda: { set: true } }, { venda: 'true' }, { corretor: { set: 'Vânia' } }, { corretor: ['Vânia'] }, { comissaoEstimada: { set: 8500 } }]) {
    assert.throws(() => clientWriteData(body, admin), error => error.status === 400, JSON.stringify(body));
  }
});

test('Vânia usa nome completo exato normalizado e os descontos são cumulativos sem alterar o bruto', () => {
  for (const name of ['Vânia', 'Vania', '  VÂNIA  ', 'vAnIa', 'Va\u0302nia']) assert.equal(isVaniaBroker(name), true, name);
  for (const name of ['Vânia Silva', 'Silvania', 'Ivânia', 'Ana Vânia', 'Vania e Diego', '', null]) assert.equal(isVaniaBroker(name), false, name);
  const record = client(1, '8500.00', { corretor: 'Vânia', visitaDiego: true, descontosComissao: [{ descricao: 'Ajuste comercial', valor: '250.00' }] });
  const before = structuredClone(record);
  const breakdown = getClientCommissionBreakdown(record);
  assert.equal(breakdown.gross, '8500.00');
  assert.equal(breakdown.discountTotal, '1750.00');
  assert.equal(breakdown.net, '6750.00');
  assert.equal(breakdown.requiresReview, false);
  assert.deepEqual(breakdown.discounts, [
    { descricao: 'Visita Diego', valor: '1000.00' },
    { descricao: 'Corretora Vânia', valor: '500.00' },
    { descricao: 'Ajuste comercial', valor: '250.00' },
  ]);
  const updated = { ...record, ...clientWriteData({ visitaDiego: true }, admin, record) };
  assert.equal(getClientCommissionBreakdown(updated).net, '6750.00');
  assert.equal(getClientCommissionBreakdown(updated).net, '6750.00', 'Reabrir e recalcular não aplica a dedução novamente.');
  assert.deepEqual(record, before);
  assert.equal(getClientCommissionBreakdown(client(2, '8500.00', { visitaDiego: true })).net, '7500.00');
  assert.equal(getClientCommissionBreakdown(client(3, '8500.00', { corretor: 'Vânia' })).net, '8000.00');
});

test('líquido negativo exige revisão do estado completo e preserva a privacidade dos outros perfis', () => {
  const record = client(1, '1000.00', { visitaDiego: true });
  assert.equal(clientWriteData({ status: 'Assinando Contrato' }, assistant, record).status, 'Assinando Contrato');
  assert.throws(() => clientWriteData({ corretor: 'Vânia' }, admin, record), error => error.status === 422 && error.code === 'COMMISSION_REVIEW_REQUIRED' && /500,00/.test(error.message));
  for (const user of [assistant, broker]) {
    assert.throws(() => clientWriteData({ corretor: 'Vânia' }, user, record), error => error.status === 422 && error.code === 'COMMISSION_REVIEW_REQUIRED' && !/500|R\$|Visita Diego/.test(error.message));
  }
  assert.throws(() => clientWriteData({ venda: true, corretor: 'Vânia', comissaoEstimada: '1000.00', visitaDiego: true }, admin), error => error.status === 422);
  const zero = clientWriteData({ venda: true, corretor: 'Vânia', comissaoEstimada: '1500.00', visitaDiego: true }, admin);
  assert.equal(getClientCommissionBreakdown(zero).net, '0.00');
  assert.equal(getClientCommissionBreakdown(clientWriteData({ venda: true, corretor: 'Vânia', comissaoEstimada: null, visitaDiego: true }, admin)).net, null);
  assert.equal(clientWriteData({ venda: false }, assistant, { ...record, corretor: 'Vânia' }).venda, false);
});

test('relatório discrimina descontos, soma líquidos válidos e identifica valores legados para revisar', () => {
  const records = [
    client(1, '8500.00', { corretor: 'Vânia', visitaDiego: true, descontosComissao: [{ descricao: 'Ajuste comercial', valor: '250.00' }], observacoes: 'Observação atual', status: 'Assinando Contrato' }),
    client(2, '1000.00', { corretor: 'Vânia', visitaDiego: true }),
    client(3, '0.00'), client(4, null, { visitaDiego: true }), client(5, '999.00', { venda: false }),
  ];
  const report = buildCommissionReport(records, { scope: 'Ativos', generatedAt: now });
  assert.equal(report.total, '6750.00');
  assert.equal(report.count, 4);
  assert.equal(report.missingCount, 1);
  assert.equal(report.reviewCount, 1);
  assert.equal(report.items[0].comissaoEstimada, '8500.00');
  assert.equal(report.items[0].net, '6750.00');
  assert.equal(report.items[1].requiresReview, true);
  assert.match(report.text, /Desconto — Visita Diego — R\$\s1\.000,00/);
  assert.match(report.text, /Desconto — Corretora Vânia — R\$\s500,00/);
  assert.match(report.text, /Desconto — Ajuste comercial — R\$\s250,00/);
  assert.match(report.text, /Status — Assinando Contrato/);
  assert.match(report.text, /Observações — Observação atual/);
  assert.match(report.text, /TOTAL LÍQUIDO ESTIMADO — R\$\s6\.750,00/);
  assert.match(report.text, /1 comissão requer revisão/);
  assert.deepEqual(summarizeClientCommissions(records), { total: '6750.00', count: 4, missingCount: 1, reviewCount: 1 });
});

test('seleção do relatório valida IDs e ignora duplicados sem aceitar valores enviados pelo navegador', () => {
  assert.deepEqual(commissionReportInput({ ids: [3, 1, 3], scope: ' Ativos\n· Sumaré ' }), { ids: [3, 1], scope: 'Ativos · Sumaré' });
  assert.deepEqual(commissionReportInput({ ids: [] }), { ids: [], scope: 'Seleção atual' });
  for (const body of [null, [], {}, { ids: ['1'] }, { ids: [0] }, { ids: [1.5] }, { ids: [2147483648] }, { ids: Array(5001).fill(1) }, { ids: [1], total: '999' }, { ids: [1], comissaoEstimada: '2' }, { ids: [1], scope: {} }, { ids: [1], scope: 'a'.repeat(501) }]) {
    assert.throws(() => commissionReportInput(body), error => error.status === 400);
  }
});

test('API valida conta ativa e papel atual, preserva comissão em edições de assistente e bloqueia relatório', async t => {
  const { prisma, users, records, state } = fixture();
  const request = await serve(t, prisma);
  assert.equal((await request(null, '/clients')).status, 401);
  assert.equal((await request(4, '/clients')).status, 401);
  assert.equal((await request(999, '/clients')).status, 401);
  for (const user of [2, 3]) {
    const listed = await (await request(user, '/clients')).json();
    assert.ok(listed.every(item => ['comissaoEstimada', 'visitaDiego', 'descontosComissao'].every(field => !Object.hasOwn(item, field))));
    assert.equal((await request(user, '/commission-report', { ids: [1], scope: 'Ativos' })).status, 403);
    assert.equal((await request(user, '/clients/1', { comissaoEstimada: null }, 'PUT')).status, 403);
  }
  const updated = await (await request(2, '/clients/1', { status: 'Engenharia Solicitada', venda: false }, 'PUT')).json();
  assert.equal(Object.hasOwn(updated, 'comissaoEstimada'), false);
  assert.equal(records.get(1).comissaoEstimada, '8500.00');
  users.get(1).role = 'ASSISTENTE';
  assert.equal((await request(1, '/commission-report', { ids: [1] })).status, 403, 'Cookie antigo de ADM não concede acesso.');
  users.get(1).role = 'ADM';
  const report = await (await request(1, '/commission-report', { ids: [3, 2, 2, 1, 4, 999], scope: 'Ativos' })).json();
  assert.deepEqual(report.items.map(item => item.id), [3, 2]);
  assert.equal(report.total, '12000.00');
  assert.equal(report.missingCount, 1);
  assert.match(report.text, /Status — Assinando Contrato/);
  assert.match(report.text, /Observações — Aguardando assinatura/);
  state.failClients = true;
  assert.equal((await request(1, '/commission-report', { ids: [2] })).status, 503);
  state.failUsers = true;
  assert.equal((await request(1, '/clients')).status, 503);
});

test('API rejeita operações Prisma, recalcula troca de corretor e preserva os descontos privados', async t => {
  const { prisma, records } = fixture();
  records.set(1, client(1, '1000.00', { visitaDiego: true, descontosComissao: [] }));
  const request = await serve(t, prisma);
  for (const body of [{ corretor: { set: 'Vânia' } }, { venda: { set: true } }, { comissaoEstimada: { set: '1.00' } }, { visitaDiego: { set: true } }, { descontosComissao: { set: [] } }]) {
    assert.equal((await request(1, '/clients/1', body, 'PUT')).status, 400, JSON.stringify(body));
  }
  for (const user of [2, 3]) {
    for (const body of [{ visitaDiego: false }, { descontosComissao: [] }, { descontosComissao: [{ descricao: 'Ajuste', valor: '1.00' }] }]) {
      assert.equal((await request(user, '/clients/1', body, 'PUT')).status, 403);
    }
    const response = await request(user, '/clients/1', { corretor: 'Vânia' }, 'PUT');
    assert.equal(response.status, 422);
    const error = await response.json();
    assert.equal(error.code, 'COMMISSION_REVIEW_REQUIRED');
    assert.doesNotMatch(error.error, /500|R\$|Visita Diego/);
    assert.equal(records.get(1).corretor, 'Outro corretor');
  }
  const changed = await request(1, '/clients/1', { comissaoEstimada: '2000.00', corretor: 'Vânia', descontosComissao: [{ descricao: 'Ajuste', valor: '250.00' }] }, 'PUT');
  assert.equal(changed.status, 200);
  assert.equal(getClientCommissionBreakdown(await changed.json()).net, '250.00');
  const operational = await request(2, '/clients/1', { status: 'Assinando Contrato' }, 'PUT');
  assert.equal(operational.status, 200);
  const publicResult = await operational.json();
  for (const field of ['comissaoEstimada', 'visitaDiego', 'descontosComissao']) assert.equal(Object.hasOwn(publicResult, field), false);
  assert.equal(records.get(1).visitaDiego, true);
  assert.deepEqual(records.get(1).descontosComissao, [{ descricao: 'Ajuste', valor: '250.00' }]);
  const report = await (await request(1, '/commission-report', { ids: [1], scope: 'Atualizados' })).json();
  assert.equal(report.total, '250.00');
  assert.match(report.text, /Status — Assinando Contrato/);
});

test('rotas normais protegem respostas de clientes e cadastro pelo gerador de contratos', async () => {
  const server = await readFile(new URL('../api/server.js', import.meta.url), 'utf8');
  assert.match(server, /app\.use\('\/api\/clients', requireAuth, resolveClientUser\)/);
  assert.match(server, /app\.post\('\/api\/clients\/commission-report', createCommissionReportHandler\(prisma\)\)/);
  assert.match(server, /app\.post\('\/api\/contracts\/from-new-client', requireAuth, resolveClientUser/);
  assert.match(server, /client: presentClient\(result\.client, req\.user\)/);
  assert.match(server, /\.\.\.clientWriteData\(req\.body, req\.user\)/);
  const updateRoute = server.slice(server.indexOf("app.put('/api/clients/:id'"), server.indexOf('// [DELETE] Deletar um cliente'));
  assert.match(updateRoute, /prisma\.\$transaction\(async tx =>/);
  assert.match(updateRoute, /SELECT "id" FROM "clients" WHERE "id" = \$\{parseInt\(id\)\} FOR UPDATE/);
  assert.match(updateRoute, /clientWriteData\(req\.body, req\.user, clienteAntes\)/);
  assert.ok(updateRoute.indexOf('FOR UPDATE') < updateRoute.indexOf('tx.client.findUnique'));
  assert.ok(updateRoute.indexOf('tx.client.findUnique') < updateRoute.indexOf('clientWriteData'));
  assert.ok(updateRoute.indexOf('clientWriteData') < updateRoute.indexOf('tx.client.update'));
  assert.doesNotMatch(server, /app\.(?:post|put)\('\/api\/clients(?:\/:id)?', requireAuth/);
});

test('PostgreSQL local mantém legado null, centavos, privacidade e valor após edição operacional', { skip: process.env.TEST_CLIENT_COMMISSIONS_DB !== '1' }, async t => {
  const target = new URL(process.env.DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname));
  assert.equal(target.port, '5433');
  assert.equal(target.pathname, '/motive_local');
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const suffix = randomUUID();
  const userIds = [];
  const clientIds = [];
  try {
    for (const role of ['ADM', 'ASSISTENTE']) {
      const user = await prisma.user.create({ data: { nome: `QA comissão ${suffix}`, email: `qa-commission-${role}-${suffix}@example.test`, passwordHash: 'test-only', role } });
      userIds.push(user.id);
    }
    for (const amount of ['0.10', '0.20', null]) {
      const created = await prisma.client.create({ data: { nome: `QA comissão ${suffix}`, venda: true, status: 'Aprovado', observacoes: 'Observação atual', ...(amount === null ? {} : { comissaoEstimada: amount }) } });
      clientIds.push(created.id);
    }
    assert.equal((await prisma.client.findUnique({ where: { id: clientIds[2] } })).comissaoEstimada, null);
    const legacy = await prisma.client.findUnique({ where: { id: clientIds[2] } });
    assert.equal(legacy.visitaDiego, false);
    assert.deepEqual(legacy.descontosComissao, []);
    const request = await serve(t, prisma);
    const response = await request(userIds[0], '/commission-report', { ids: clientIds, scope: 'QA local' });
    assert.equal(response.status, 200);
    const report = await response.json();
    assert.equal(report.total, '0.30');
    assert.equal(report.missingCount, 1);
    assert.match(report.text, /Observações — Observação atual/);
    const updated = await request(userIds[1], `/clients/${clientIds[0]}`, { status: 'Solicitando Engenharia' }, 'PUT');
    assert.equal(updated.status, 200);
    assert.equal(Object.hasOwn(await updated.json(), 'comissaoEstimada'), false);
    assert.equal(String((await prisma.client.findUnique({ where: { id: clientIds[0] } })).comissaoEstimada), '0.1');
    await assert.rejects(prisma.client.update({ where: { id: clientIds[0] }, data: { comissaoEstimada: '-0.01' } }));
    await assert.rejects(prisma.client.update({ where: { id: clientIds[0] }, data: { descontosComissao: { descricao: 'Não é uma lista' } } }));

    const sale = await prisma.client.create({ data: {
      nome: `QA comissão ${suffix}`, venda: true, corretor: 'Vânia', comissaoEstimada: '8500.00', visitaDiego: true,
      descontosComissao: [{ descricao: 'Ajuste comercial', valor: '250.00' }],
    } });
    clientIds.push(sale.id);
    const saleReport = await (await request(userIds[0], '/commission-report', { ids: [sale.id] })).json();
    assert.equal(saleReport.total, '6750.00');
    assert.equal(saleReport.items[0].gross, '8500.00');
    const changed = await request(userIds[1], `/clients/${sale.id}`, { status: 'Assinando Contrato' }, 'PUT');
    assert.equal(changed.status, 200);
    const changedResult = await changed.json();
    for (const field of ['comissaoEstimada', 'visitaDiego', 'descontosComissao']) assert.equal(Object.hasOwn(changedResult, field), false);
    const afterOperationalEdit = await prisma.client.findUnique({ where: { id: sale.id } });
    assert.equal(afterOperationalEdit.visitaDiego, true);
    assert.deepEqual(afterOperationalEdit.descontosComissao, [{ descricao: 'Ajuste comercial', valor: '250.00' }]);
    assert.equal(getClientCommissionBreakdown(afterOperationalEdit).net, '6750.00');
    const rejected = await request(userIds[0], `/clients/${sale.id}`, { comissaoEstimada: '1000.00' }, 'PUT');
    assert.equal(rejected.status, 422);
    assert.equal(String((await prisma.client.findUnique({ where: { id: sale.id } })).comissaoEstimada), '8500');

    const concurrentSale = await prisma.client.create({ data: { nome: `QA comissão ${suffix}`, venda: true, corretor: 'Outro corretor', comissaoEstimada: '2000.00' } });
    clientIds.push(concurrentSale.id);
    let releaseFirst;
    const firstGate = new Promise(resolve => { releaseFirst = resolve; });
    let firstLocked;
    const firstReady = new Promise(resolve => { firstLocked = resolve; });
    const firstChange = prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "clients" WHERE "id" = ${concurrentSale.id} FOR UPDATE`;
      const current = await tx.client.findUnique({ where: { id: concurrentSale.id } });
      await tx.client.update({ where: { id: concurrentSale.id }, data: clientWriteData({ visitaDiego: true, descontosComissao: [{ descricao: 'Ajuste combinado', valor: '800.00' }] }, admin, current) });
      firstLocked();
      await firstGate;
    }, { timeout: 10000 });
    let secondChange;
    try {
      await Promise.race([firstReady, firstChange]);
      secondChange = request(userIds[1], `/clients/${concurrentSale.id}`, { corretor: 'Vânia' }, 'PUT');
      let waiting = false;
      const deadline = Date.now() + 3000;
      while (!waiting && Date.now() < deadline) {
        const rows = await prisma.$queryRaw`SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity
          WHERE datname = current_database() AND usename = current_user
            AND pid <> pg_backend_pid() AND wait_event_type = 'Lock'
            AND query LIKE ${'%qa-commission-fixture-lock%'}
        ) AS waiting`;
        waiting = rows[0].waiting;
        if (!waiting) await new Promise(resolve => setTimeout(resolve, 15));
      }
      assert.equal(waiting, true, 'A alteração concorrente precisa aguardar o bloqueio da linha antes de ler a comissão.');
    } finally {
      releaseFirst();
      await firstChange;
    }
    const secondResponse = await secondChange;
    assert.equal(secondResponse.status, 422, 'Após esperar a transação anterior, a troca para Vânia revalida os descontos atualizados.');
    assert.equal((await secondResponse.json()).code, 'COMMISSION_REVIEW_REQUIRED');
    const final = await prisma.client.findUnique({ where: { id: concurrentSale.id } });
    assert.equal(final.corretor, 'Outro corretor');
    assert.equal(getClientCommissionBreakdown(final).net, '200.00');
  } finally {
    await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
});
