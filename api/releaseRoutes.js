import express from 'express';
import { releaseAnnouncements } from './releaseAnnouncements.js';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

function userId(value) {
  if (!['string', 'number'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id <= 2147483647 ? id : null;
}

function publishedFor(user, announcements, now) {
  return announcements
    .filter(item => item.audience.includes(user.role) && new Date(item.publishedAt).getTime() <= now.getTime())
    .sort((first, second) => new Date(second.publishedAt) - new Date(first.publishedAt) || second.id.localeCompare(first.id));
}

function acknowledgeIds(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'ids')) {
    throw fail('Confirmação de novidades inválida.');
  }
  if (!Array.isArray(body.ids) || !body.ids.length || body.ids.length > 100
      || body.ids.some(id => typeof id !== 'string' || !id.length || id.length > 120)) {
    throw fail('Selecione até 100 novidades para confirmar.');
  }
  return [...new Set(body.ids)];
}

export function createReleaseRouter(prisma, requireAuth, { announcements = releaseAnnouncements, now = () => new Date() } = {}) {
  const router = express.Router();
  router.use(requireAuth);
  router.use(async (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    const id = userId(req.user?.id);
    if (id === null) return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });
    try {
      const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, isActive: true, createdAt: true } });
      if (!user?.isActive) return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });
      const expectedUser = req.get('X-Release-User');
      if (expectedUser !== undefined && expectedUser !== String(user.id)) {
        return res.status(409).json({ code: 'SESSION_CHANGED', error: 'Sua sessão mudou. Entre novamente.' });
      }
      req.releaseUser = user;
    } catch {
      return res.status(503).json({ error: 'Não foi possível verificar seu acesso.' });
    }
    next();
  });

  const loadReleases = async user => {
    const visible = publishedFor(user, announcements, now());
    if (!visible.length) return [];
    const receipts = await prisma.userReleaseReceipt.findMany({
      where: { userId: user.id, releaseId: { in: visible.map(item => item.id) } },
      select: { releaseId: true, acknowledgedAt: true },
    });
    const acknowledged = new Map(receipts.map(receipt => [receipt.releaseId, receipt.acknowledgedAt]));
    return visible.map(item => ({
      id: item.id,
      title: item.title,
      publishedAt: item.publishedAt,
      highlights: item.highlights,
      acknowledgedAt: acknowledged.get(item.id) || null,
    }));
  };

  router.get('/pending', async (req, res) => {
    const items = await loadReleases(req.releaseUser);
    const accountCreatedAt = new Date(req.releaseUser.createdAt).getTime();
    const latestId = items[0]?.id;
    const pending = items.filter(item => !item.acknowledgedAt
      && (item.id === latestId || new Date(item.publishedAt).getTime() >= accountCreatedAt));
    res.json({ items: pending, total: pending.length });
  });

  router.post('/acknowledge', async (req, res) => {
    const ids = acknowledgeIds(req.body);
    const allowed = new Set(publishedFor(req.releaseUser, announcements, now()).map(item => item.id));
    if (ids.some(id => !allowed.has(id))) throw fail('Novidade indisponível para sua conta.', 404);
    await prisma.userReleaseReceipt.createMany({
      data: ids.map(releaseId => ({ userId: req.releaseUser.id, releaseId })),
      skipDuplicates: true,
    });
    res.json({ acknowledgedIds: ids });
  });

  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.status) return res.status(error.status).json({ error: error.message });
    if (error.code === 'P2003') return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });
    console.error('Erro ao acessar novidades:', error.code || error.name);
    res.status(503).json({ error: 'Não foi possível acessar as novidades. Tente novamente mais tarde.' });
  });
  return router;
}
