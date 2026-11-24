import express from 'express';
import { prepareProspectPhoto } from './prospectPhoto.js';
import { getMatriculaSearch } from './matriculaSearch.js';
import { lookupProspectRegistration } from './prospectRegistration.js';

export const PROSPECT_STAGES = ['SEARCHING', 'CONTACT_FOUND', 'IN_CONTACT', 'CAPTURED', 'DISCARDED'];
const states = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const positiveId = value => {
  if (!['number', 'string'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) > 2147483647) throw fail('Identificador inválido.');
  return Number(value);
};
function text(value, label, max, required = false) {
  if (value === null || value === '') { if (required) throw fail(`Informe ${label}.`); return null; }
  if (typeof value !== 'string' || value.length > max || value.includes('\u0000')) throw fail(`${label}: informe até ${max} caracteres.`);
  const result = value.trim();
  if (!result && required) throw fail(`Informe ${label}.`);
  return result || null;
}
export function prospectData(body, creating = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail('Dados da captação inválidos.');
  const fields = { street: ['a rua ou avenida', 180], number: ['o número ou s/n', 40], complement: ['Complemento', 120], neighborhood: ['Bairro', 160], city: ['a cidade', 120], registration: ['Matrícula', 100], ownerName: ['Nome do proprietário', 160], ownerPhone: ['Telefone', 30], notes: ['Observações', 4000] };
  const allowed = new Set([...Object.keys(fields), 'state', 'stage', 'photoDataUrl', 'version']);
  if (Object.keys(body).some(key => !allowed.has(key))) throw fail('Campo de captação inválido.');
  const data = {};
  for (const [key, [label, max]] of Object.entries(fields)) {
    const required = ['street', 'number', 'city'].includes(key);
    if (body[key] !== undefined || (creating && required)) data[key] = text(body[key], label, max, required);
  }
  if (body.state !== undefined || creating) {
    const state = text(body.state ?? 'SP', 'UF', 2, true).toUpperCase();
    if (!states.has(state)) throw fail('Selecione uma UF válida.');
    data.state = state;
  }
  if (body.stage !== undefined) { if (!PROSPECT_STAGES.includes(body.stage)) throw fail('Etapa de captação inválida.'); data.stage = body.stage; }
  if (body.ownerPhone) {
    const digits = body.ownerPhone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15 || !/^[\d\s()+.\-]+$/.test(body.ownerPhone)) throw fail('Informe um telefone com DDD válido.');
    data.ownerPhone = digits;
  }
  if (!creating && body.version === undefined) throw fail('Reabra a captação antes de salvar.', 409);
  if (!creating && !Object.keys(data).length && body.photoDataUrl === undefined) throw fail('Informe os dados para atualizar.');
  return data;
}

const select = { id: true, street: true, number: true, complement: true, neighborhood: true, city: true, state: true, stage: true, registration: true, ownerName: true, ownerPhone: true, notes: true, photoUpdatedAt: true, createdById: true, createdByName: true, version: true, createdAt: true, updatedAt: true };
const present = item => ({ ...item, hasPhoto: Boolean(item.photoUpdatedAt) });

export function createProspectRouter(prisma, requireAuth, { registrationIndex = getMatriculaSearch } = {}) {
  const router = express.Router();
  router.use(requireAuth);
  router.use(async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: positiveId(req.user?.id) }, select: { id: true, nome: true, role: true, isActive: true } });
      if (!user?.isActive) return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });
      if (!['ADM', 'ASSISTENTE', 'CORRETOR'].includes(user.role)) return res.status(403).json({ error: 'Acesso negado.' });
      req.user = user; res.set('Cache-Control', 'private, no-store'); next();
    } catch { res.status(503).json({ error: 'Não foi possível verificar seu acesso.' }); }
  });
  router.get('/', async (req, res, next) => {
    try {
      const query = key => { if (req.query[key] === undefined) return ''; if (typeof req.query[key] !== 'string' || req.query[key].length > 200) throw fail('Filtro inválido.'); return req.query[key].trim(); };
      const q = query('q'), stage = query('stage') || 'active', city = query('city');
      const page = query('page') ? positiveId(query('page')) : 1;
      if (page > 100000 || !['active', 'all', ...PROSPECT_STAGES].includes(stage)) throw fail('Filtro inválido.');
      const terms = q ? (/^[\d\s()+.\-]+$/.test(q) ? [q.replace(/\D/g, '')].filter(Boolean) : q.replace(/[,;·/]+/g, ' ').split(/\s+/).filter(Boolean).slice(0, 12)) : [];
      const where = { ...(stage === 'active' ? { stage: { not: 'DISCARDED' } } : stage === 'all' ? {} : { stage }),
        ...(city ? { city: { equals: city, mode: 'insensitive' } } : {}),
        ...(terms.length ? { AND: terms.map(term => ({ OR: ['street', 'number', 'neighborhood', 'city', 'state', 'registration', 'ownerName', 'ownerPhone', 'notes'].map(key => ({ [key]: { contains: term, mode: 'insensitive' } })) })) } : {}) };
      const [items, total, groups, cities] = await Promise.all([
        prisma.propertyProspect.findMany({ where, select, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 24, take: 24 }),
        prisma.propertyProspect.count({ where }),
        prisma.propertyProspect.groupBy({ by: ['stage'], _count: { _all: true } }),
        prisma.propertyProspect.findMany({ select: { city: true }, distinct: ['city'], orderBy: { city: 'asc' } }),
      ]);
      res.json({ items: items.map(present), total, page, pageSize: 24, cities: cities.map(item => item.city), summary: Object.fromEntries(groups.map(item => [item.stage, item._count._all])) });
    } catch (error) { next(error); }
  });
  router.post('/lookup-registration', (req, res, next) => {
    try {
      const body = req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail('Informe o endereço.');
      const address = prospectData({ street: body.street, number: body.number, city: body.city, state: body.state, complement: body.complement ?? null }, true);
      const page = body.page === undefined ? 1 : positiveId(body.page);
      res.json(lookupProspectRegistration(address.state === 'SP' ? registrationIndex() : null, address, page));
    } catch (error) { if (!error.status) error = fail('A base de matrículas está indisponível. Você pode preencher a matrícula manualmente.', 503); next(error); }
  });
  router.get('/:id/photo', async (req, res, next) => {
    try {
      const item = await prisma.propertyProspect.findUnique({ where: { id: positiveId(req.params.id) }, select: { photo: true } });
      if (!item?.photo) throw fail('Foto não encontrada.', 404);
      res.set({ 'Content-Type': 'image/webp', 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
      res.send(Buffer.from(item.photo));
    } catch (error) { next(error); }
  });
  router.get('/:id', async (req, res, next) => {
    try { const item = await prisma.propertyProspect.findUnique({ where: { id: positiveId(req.params.id) }, select }); if (!item) throw fail('Captação não encontrada.', 404); res.json(present(item)); }
    catch (error) { next(error); }
  });
  router.post('/', async (req, res, next) => {
    try {
      const data = prospectData(req.body, true);
      if (req.body.photoDataUrl !== undefined) { data.photo = await prepareProspectPhoto(req.body.photoDataUrl); data.photoUpdatedAt = data.photo ? new Date() : null; }
      const item = await prisma.propertyProspect.create({ data: { ...data, createdById: req.user.id, createdByName: req.user.nome.slice(0, 160) }, select });
      res.status(201).json(present(item));
    } catch (error) { next(error); }
  });
  router.patch('/:id', async (req, res, next) => {
    try {
      const id = positiveId(req.params.id), data = prospectData(req.body);
      const version = positiveId(req.body.version);
      if (req.body.photoDataUrl !== undefined) { data.photo = await prepareProspectPhoto(req.body.photoDataUrl); data.photoUpdatedAt = data.photo ? new Date() : null; }
      const item = await prisma.$transaction(async tx => {
        const updated = await tx.propertyProspect.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
        if (!updated.count) { if (!await tx.propertyProspect.findUnique({ where: { id }, select: { id: true } })) throw fail('Captação não encontrada.', 404); throw fail('Esta captação foi atualizada por outra pessoa. Feche e reabra para conferir os dados antes de salvar.', 409); }
        return tx.propertyProspect.findUnique({ where: { id }, select });
      });
      res.json(present(item));
    } catch (error) { next(error); }
  });
  router.delete('/:id', async (req, res, next) => {
    try {
      const id = positiveId(req.params.id);
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).some(key => key !== 'version')) throw fail('Dados da exclusão inválidos.');
      const version = positiveId(req.body.version);
      await prisma.$transaction(async tx => {
        const item = await tx.propertyProspect.findUnique({ where: { id }, select: { createdById: true } });
        if (!item) throw fail('Captação não encontrada.', 404);
        if (req.user.role !== 'ADM' && item.createdById !== req.user.id) throw fail('Você só pode excluir captações cadastradas por você.', 403);
        const deleted = await tx.propertyProspect.deleteMany({ where: { id, version, ...(req.user.role === 'ADM' ? {} : { createdById: req.user.id }) } });
        if (!deleted.count) {
          if (!await tx.propertyProspect.findUnique({ where: { id }, select: { id: true } })) throw fail('Captação não encontrada.', 404);
          throw fail('Esta captação foi atualizada por outra pessoa. Atualize a lista e confira os dados antes de excluir.', 409);
        }
      });
      res.status(204).end();
    } catch (error) { next(error); }
  });
  router.use((error, _req, res, _next) => {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Erro em captações:', error.code || error.name);
    res.status(500).json({ error: 'Não foi possível salvar ou consultar as captações. Tente novamente.' });
  });
  return router;
}
