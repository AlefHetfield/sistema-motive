import express from 'express';
import { addEngineeringDays, engineeringToday } from '../frontend/src/utils/engineeringValidity.js';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const positiveId = value => {
  if (!['string', 'number'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) > 2147483647) throw fail('Identificador inválido.');
  return Number(value);
};

function text(value, label, max, required = false) {
  if (value === null || value === '') {
    if (required) throw fail(`Informe ${label}.`);
    return null;
  }
  if (typeof value !== 'string' || value.length > max || value.includes('\u0000')) throw fail(`${label} deve ter até ${max} caracteres.`);
  const trimmed = value.trim();
  if (required && !trimmed) throw fail(`Informe ${label}.`);
  return trimmed || null;
}

function date(value) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '9999-12-31') throw fail('Data do pedido de engenharia inválida.');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw fail('Data do pedido de engenharia inválida.');
  return parsed;
}

function money(value, label) {
  if (value === null || value === '') return null;
  if (!['string', 'number'].includes(typeof value)) throw fail(`${label} inválido.`);
  // Decimal strings preserve cents and avoid rounding or coercing malformed input.
  const raw = String(value).trim();
  if (!/^\d{1,13}(?:\.\d{1,2})?$/.test(raw)) throw fail(`${label} deve ser um valor não negativo, com até 2 casas decimais.`);
  const [whole, cents = ''] = raw.split('.');
  return `${whole.replace(/^0+(?=\d)/, '')}.${cents.padEnd(2, '0')}`;
}

export function engineeringData(body, creating = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail('Dados da engenharia inválidos.');
  const allowed = new Set(['imovel', 'matricula', 'cidade', 'dataPedido', 'valorImovel', 'valorAvaliado', 'descricao', 'propertyId']);
  if (Object.keys(body).some(key => !allowed.has(key))) throw fail('Campo de engenharia inválido.');
  const data = {};
  if (creating || body.imovel !== undefined) data.imovel = text(body.imovel, 'o imóvel', 250, true);
  for (const [key, label, max] of [['matricula', 'Matrícula', 100], ['cidade', 'Cidade', 150], ['descricao', 'Descrição', 10000]]) {
    if (body[key] !== undefined) data[key] = text(body[key], label, max);
  }
  if (body.dataPedido !== undefined) data.dataPedido = date(body.dataPedido);
  for (const [key, label] of [['valorImovel', 'Valor do imóvel'], ['valorAvaliado', 'Valor avaliado']]) {
    if (body[key] !== undefined) data[key] = money(body[key], label);
  }
  if (body.propertyId !== undefined) data.propertyId = body.propertyId === null ? null : positiveId(body.propertyId);
  if (!creating && !Object.keys(data).length) throw fail('Informe os dados para atualizar a engenharia.');
  return data;
}

const propertySelect = { id: true, code: true, title: true, address: true, neighborhood: true, city: true, price: true, photoUrl: true, driveCoverFileId: true, status: true };
const include = { property: { select: propertySelect } };

export function engineeringFilters(query, today = engineeringToday()) {
  const value = key => {
    if (query[key] === undefined) return '';
    if (typeof query[key] !== 'string') throw fail('Filtro inválido.');
    return query[key].trim();
  };
  const page = value('page') ? positiveId(value('page')) : 1;
  const pageSize = value('pageSize') ? positiveId(value('pageSize')) : 20;
  if (pageSize > 100 || page > 1000000) throw fail('Paginação inválida.');
  const q = value('q');
  const cidade = value('cidade');
  const avaliacao = value('avaliacao');
  const validade = value('validade');
  const sort = value('sort') || 'recentes';
  if (q.length > 200 || cidade.length > 150 || !['', 'pendente', 'avaliada'].includes(avaliacao) || !['', 'validas', 'proximas', 'vencidas'].includes(validade) || !['recentes', 'antigos'].includes(sort)) throw fail('Filtro inválido.');
  const where = {};
  if (q) where.OR = [
    ...['imovel', 'matricula', 'cidade', 'descricao'].map(field => ({ [field]: { contains: q, mode: 'insensitive' } })),
    ...['title', 'code', 'address'].map(field => ({ property: { is: { [field]: { contains: q, mode: 'insensitive' } } } })),
  ];
  if (cidade) where.cidade = { equals: cidade, mode: 'insensitive' };
  if (avaliacao) where.valorAvaliado = avaliacao === 'pendente' ? null : { not: null };
  if (validade) {
    const firstValidRequest = date(addEngineeringDays(today, -180));
    where.dataPedido = validade === 'vencidas' ? { lt: firstValidRequest }
      : validade === 'proximas' ? { gte: firstValidRequest, lte: date(addEngineeringDays(today, -150)) }
        : { gte: firstValidRequest };
  }
  const direction = sort === 'recentes' ? 'desc' : 'asc';
  return { page, pageSize, where, orderBy: [{ dataPedido: { sort: direction, nulls: 'last' } }, { id: direction }] };
}

export function createEngineeringRouter(prisma, requireAuth) {
  const router = express.Router();
  router.use(requireAuth);
  router.use(async (req, res, next) => {
    let user;
    try {
      user = await prisma.user.findUnique({ where: { id: positiveId(req.user?.id) }, select: { id: true, role: true, isActive: true } });
    } catch { return res.status(503).json({ error: 'Não foi possível verificar seu acesso.' }); }
    if (!user?.isActive) return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });
    if (!['ADM', 'ASSISTENTE'].includes(user.role)) return res.status(403).json({ error: 'Acesso negado.' });
    res.set('Cache-Control', 'private, no-store');
    next();
  });
  const checkProperty = async data => {
    if (data.propertyId && !await prisma.property.findUnique({ where: { id: data.propertyId }, select: { id: true } })) throw fail('O imóvel vinculado não foi encontrado.', 404);
  };

  router.get('/', async (req, res) => {
    const { page, pageSize, where, orderBy } = engineeringFilters(req.query);
    const [items, total, cities, all, pendentes] = await Promise.all([
      prisma.engineering.findMany({ where, include, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.engineering.count({ where }),
      prisma.engineering.findMany({ where: { cidade: { not: null } }, select: { cidade: true }, distinct: ['cidade'], orderBy: { cidade: 'asc' } }),
      prisma.engineering.count(),
      prisma.engineering.count({ where: { valorAvaliado: null } }),
    ]);
    res.json({ items, total, page, pageSize, cidades: cities.map(item => item.cidade), summary: { total: all, pendentes, avaliadas: all - pendentes } });
  });
  router.get('/:id', async (req, res) => {
    const item = await prisma.engineering.findUnique({ where: { id: positiveId(req.params.id) }, include });
    if (!item) throw fail('Engenharia não encontrada.', 404);
    res.json(item);
  });
  router.post('/', async (req, res) => {
    const data = engineeringData(req.body, true);
    await checkProperty(data);
    res.status(201).json(await prisma.engineering.create({ data, include }));
  });
  router.patch('/:id', async (req, res) => {
    const id = positiveId(req.params.id);
    const data = engineeringData(req.body);
    await checkProperty(data);
    res.json(await prisma.engineering.update({ where: { id }, data, include }));
  });
  router.delete('/:id', async (req, res) => {
    await prisma.engineering.delete({ where: { id: positiveId(req.params.id) } });
    res.sendStatus(204);
  });
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.code === 'P2025') return res.status(404).json({ error: 'Engenharia não encontrada.' });
    if (error.code === 'P2003') return res.status(409).json({ error: 'O imóvel vinculado foi removido. Atualize o cadastro e tente novamente.' });
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Erro ao acessar engenharias:', error);
    res.status(500).json({ error: 'Não foi possível acessar as engenharias.' });
  });
  return router;
}
