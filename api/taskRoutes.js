import express from 'express';

export const managesTasks = user => user.role === 'ADM';
export const taskScope = user => managesTasks(user) ? {} : { assigneeId: user.id };
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const id = value => {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw fail('Identificador inválido.');
  return Number(value);
};
function day(value) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw fail('Data inválida.');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw fail('Data inválida.');
  return parsed;
}
export function taskData(body, creating = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail('Dados da tarefa inválidos.');
  const data = {};
  if (body.category !== undefined) {
    if (!['GENERAL', 'SOCIAL'].includes(body.category)) throw fail('Lista de tarefas inválida.');
    data.category = body.category;
  }
  if (creating || body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 250) throw fail('Informe um título de até 250 caracteres.');
    data.title = body.title.trim();
  }
  if (body.notes !== undefined) {
    if (typeof body.notes !== 'string' || body.notes.length > 10000) throw fail('As observações devem ter até 10.000 caracteres.');
    data.notes = body.notes;
  }
  if (body.status !== undefined) {
    if (!['TODO', 'IN_PROGRESS', 'WAITING', 'DONE'].includes(body.status)) throw fail('Situação inválida.');
    data.status = body.status;
    data.completedAt = body.status === 'DONE' ? new Date() : null;
  }
  if (body.important !== undefined) {
    if (typeof body.important !== 'boolean') throw fail('Importância inválida.');
    data.important = body.important;
  }
  for (const field of ['dueDate', 'myDay']) if (body[field] !== undefined) data[field] = day(body[field]);
  for (const field of ['assigneeId', 'clientId', 'listId', 'propertyId']) if (body[field] !== undefined) data[field] = body[field] === null && field !== 'assigneeId' ? null : id(body[field]);
  if (body.steps !== undefined) {
    if (!Array.isArray(body.steps) || body.steps.length > 100 || body.steps.some(step => !step || typeof step.title !== 'string' || !step.title.trim() || step.title.length > 250 || typeof step.done !== 'boolean')) throw fail('Subtarefas inválidas (máximo de 100).');
    data.steps = body.steps.map(step => ({ title: step.title.trim(), done: step.done }));
  }
  return data;
}
const propertySelect = { id: true, code: true, title: true, address: true, neighborhood: true, city: true, price: true, photoUrl: true, driveCoverFileId: true, status: true };
const include = { property: { select: propertySelect }, assignee: { select: { id: true, nome: true, isActive: true } }, client: { select: { id: true, nome: true } }, list: { select: { id: true, name: true } } };

export function createTaskRouter(prisma, requireAuth) {
  const router = express.Router();
  router.use(requireAuth);
  router.use(async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: id(req.user.id) }, select: { id: true, nome: true, role: true, isActive: true } });
      if (!user?.isActive) return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });
      req.taskUser = user;
      res.set('Cache-Control', 'private, no-store');
      next();
    } catch (error) { next(error); }
  });
  const listScope = user => managesTasks(user) ? {} : { OR: [{ ownerId: user.id }, { shared: true }] };
  const canReadClients = user => ['ADM', 'ASSISTENTE'].includes(user.role);
  const present = (task, user) => canReadClients(user) ? task : { ...task, client: null, clientId: null };
  const notificationScope = user => ({ recipientId: user.id, OR: [
    { kind: 'ASSIGNED', task: { assigneeId: user.id, deletedAt: null } },
    ...(managesTasks(user) ? [{ kind: 'COMPLETED', task: { delegatedById: user.id, deletedAt: null, status: 'DONE' } }] : []),
  ] });
  async function notifyAssignment(tx, task, user) {
    if (task.assigneeId !== user.id && task.status !== 'DONE' && !task.deletedAt) {
      await tx.taskNotification.create({ data: { recipientId: task.assigneeId, taskId: task.id, actorName: user.nome } });
    }
  }
  async function notifyCompletion(tx, task, user) {
    if (!task.delegatedById || task.delegatedById === user.id || task.deletedAt) return;
    const recipient = await tx.user.findUnique({ where: { id: task.delegatedById } });
    if (recipient?.isActive && managesTasks(recipient)) {
      await tx.taskNotification.create({ data: { recipientId: recipient.id, taskId: task.id, actorName: user.nome, kind: 'COMPLETED' } });
    }
  }
  router.get('/notifications', async (req, res) => {
    const scope = notificationScope(req.taskUser);
    const before = req.query.before ? id(req.query.before) : null;
    const [items, unreadCount] = await prisma.$transaction([
      prisma.taskNotification.findMany({ where: { ...scope, ...(before ? { id: { lt: before } } : {}) }, orderBy: { id: 'desc' }, take: 31,
        include: { task: { select: { id: true, title: true, dueDate: true, client: { select: { id: true, nome: true } } } } } }),
      prisma.taskNotification.count({ where: { ...scope, readAt: null } }),
    ]);
    const page = items.slice(0, 30).map(item => ({ ...item, task: { ...item.task, client: canReadClients(req.taskUser) ? item.task.client : null } }));
    res.json({ items: page, unreadCount, nextCursor: items.length > 30 ? page.at(-1).id : null });
  });
  router.patch('/notifications/read-all', async (req, res) => {
    // Only acknowledge notifications the browser has already received.
    const through = id(req.body?.through);
    await prisma.taskNotification.updateMany({ where: { ...notificationScope(req.taskUser), id: { lte: through }, readAt: null }, data: { readAt: new Date() } });
    res.json({ ok: true });
  });
  router.patch('/notifications/:id/read', async (req, res) => {
    const result = await prisma.taskNotification.updateMany({ where: { id: id(req.params.id), ...notificationScope(req.taskUser) }, data: { readAt: new Date() } });
    if (!result.count) throw fail('Notificação não encontrada.', 404);
    res.json({ ok: true });
  });
  async function validateRelations(data, user, previous) {
    if (data.propertyId && !await prisma.property.findUnique({ where: { id: data.propertyId }, select: { id: true } })) throw fail('Imóvel não encontrado.');
    const assigneeId = data.assigneeId ?? previous?.assigneeId ?? user.id;
    if (!managesTasks(user) && assigneeId !== user.id) throw fail('Você só pode atribuir tarefas a si mesmo.', 403);
    const assignee = await prisma.user.findUnique({ where: { id: assigneeId }, select: { isActive: true } });
    if (!assignee || (!assignee.isActive && (!previous || assigneeId !== previous.assigneeId))) throw fail('Selecione um responsável ativo.');
    if (data.clientId !== undefined) {
      if (!canReadClients(user)) throw fail('Seu perfil não permite vincular clientes.', 403);
      if (data.clientId && !await prisma.client.findUnique({ where: { id: data.clientId }, select: { id: true } })) throw fail('Cliente não encontrado.');
    }
    const listId = data.listId === undefined ? previous?.listId : data.listId;
    if (listId) {
      const list = await prisma.taskList.findFirst({ where: { id: listId, ...listScope(user) } });
      if (!list || (!list.shared && list.ownerId !== assigneeId)) throw fail('Use uma lista compartilhada ou pertencente ao responsável.');
    }
    return assigneeId;
  }
  router.get('/options', async (req, res) => {
    const user = req.taskUser;
    const [users, lists] = await Promise.all([
      prisma.user.findMany({ where: managesTasks(user) ? {} : { id: user.id }, select: { id: true, nome: true, isActive: true }, orderBy: { nome: 'asc' } }),
      prisma.taskList.findMany({ where: listScope(user), orderBy: { name: 'asc' } }),
    ]);
    res.json({ userId: user.id, canManageAll: managesTasks(user), canReadClients: canReadClients(user), users, lists });
  });
  router.get('/clients', async (req, res) => {
    if (!canReadClients(req.taskUser)) throw fail('Acesso negado.', 403);
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    res.json(await prisma.client.findMany({ where: req.query.id ? { id: id(req.query.id) } : q ? { nome: { contains: q, mode: 'insensitive' } } : {}, select: { id: true, nome: true }, orderBy: { nome: 'asc' }, take: 30 }));
  });
  router.get('/properties', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    if (!req.query.id && q.length < 2) return res.json([]);
    res.json(await prisma.property.findMany({ where: req.query.id ? { id: id(req.query.id) } : { OR: ['title', 'code', 'address'].map(field => ({ [field]: { contains: q, mode: 'insensitive' } })) }, select: propertySelect, orderBy: [{ title: 'asc' }, { id: 'asc' }], take: 20 }));
  });
  router.get('/properties/:id/publication-check', async (req, res) => {
    const propertyId = id(req.params.id);
    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: propertySelect });
    if (!property) throw fail('Imóvel não encontrado.', 404);
    const tasks = await prisma.task.findMany({ where: { ...taskScope(req.taskUser), propertyId, category: 'SOCIAL', deletedAt: null, status: { not: 'DONE' }, ...(req.query.exclude ? { id: { not: id(req.query.exclude) } } : {}) },
      select: { id: true, title: true, dueDate: true, version: true, assignee: { select: { id: true, nome: true } } }, orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }], take: 20 });
    res.json({ property, tasks });
  });
  router.patch('/:id/social-order', async (req, res) => {
    if (!managesTasks(req.taskUser)) throw fail('Somente administradores podem ordenar a fila da equipe.', 403);
    const taskId = id(req.params.id), version = id(req.body?.version);
    const direction = req.body?.direction;
    if (!['up', 'down'].includes(direction)) throw fail('Direção inválida.');
    const scope = { category: 'SOCIAL', deletedAt: null, status: { not: 'DONE' } };
    await prisma.$transaction(async tx => {
      const task = await tx.task.findFirst({ where: { ...scope, id: taskId } });
      if (!task) throw fail('Publicação não encontrada.', 404);
      if (task.version !== version) throw fail('A fila mudou. Atualize antes de ordenar novamente.', 409);
      const comparison = direction === 'up' ? 'lt' : 'gt';
      const neighbor = await tx.task.findFirst({ where: { ...scope, socialOrder: { [comparison]: task.socialOrder } }, orderBy: { socialOrder: direction === 'up' ? 'desc' : 'asc' } });
      if (!neighbor) return;
      const first = await tx.task.updateMany({ where: { ...scope, id: task.id, version }, data: { socialOrder: neighbor.socialOrder, version: { increment: 1 } } });
      const second = await tx.task.updateMany({ where: { ...scope, id: neighbor.id, version: neighbor.version }, data: { socialOrder: task.socialOrder, version: { increment: 1 } } });
      if (!first.count || !second.count) throw fail('A fila mudou. Atualize antes de ordenar novamente.', 409);
    });
    res.json({ ok: true });
  });
  router.post('/lists', async (req, res) => {
    const { name, shared = false } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || name.length > 80 || typeof shared !== 'boolean') throw fail('Informe um nome de lista de até 80 caracteres.');
    if (shared && !managesTasks(req.taskUser)) throw fail('Somente administradores podem criar listas compartilhadas.', 403);
    res.status(201).json(await prisma.taskList.create({ data: { name: name.trim(), shared, ownerId: req.taskUser.id } }));
  });
  router.delete('/lists/:id', async (req, res) => {
    const list = await prisma.taskList.findFirst({ where: { id: id(req.params.id), ...listScope(req.taskUser) } });
    if (!list || (!managesTasks(req.taskUser) && (list.ownerId !== req.taskUser.id || list.shared))) throw fail('Lista não encontrada ou sem permissão.', 404);
    await prisma.taskList.delete({ where: { id: list.id } });
    res.sendStatus(204);
  });
  router.get('/', async (req, res) => {
    const user = req.taskUser;
    const where = { ...taskScope(user), deletedAt: null };
    if (req.query.assigneeId) {
      const assigneeId = id(req.query.assigneeId);
      if (!managesTasks(user) && assigneeId !== user.id) throw fail('Acesso negado.', 403);
      where.assigneeId = assigneeId;
    }
    if (req.query.clientId) {
      if (!canReadClients(user)) throw fail('Acesso negado.', 403);
      where.clientId = id(req.query.clientId);
    }
    if (req.query.listId) where.listId = id(req.query.listId);
    const today = day(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
    const view = req.query.view || 'all';
    if (view === 'social') where.category = 'SOCIAL';
    if (view === 'day') { where.myDay = today; where.assigneeId = user.id; }
    if (view === 'important') where.important = true;
    if (view === 'overdue') where.dueDate = { lt: today };
    if (view === 'planned') where.dueDate = { not: null };
    if (view === 'waiting') where.status = 'WAITING';
    else where.status = view === 'done' ? 'DONE' : { not: 'DONE' };
    if (view === 'social' && req.query.status === 'done') where.status = 'DONE';
    if (view === 'delegated') {
      if (!managesTasks(user)) throw fail('Acesso negado.', 403);
      where.delegatedById = user.id;
      where.AND = [{ assigneeId: { not: user.id } }];
      const status = req.query.status || 'pending';
      if (!['pending', 'done', 'all'].includes(status)) throw fail('Filtro de situação inválido.');
      if (status === 'all') delete where.status;
      else where.status = status === 'done' ? 'DONE' : { not: 'DONE' };
    }
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    if (q) where.title = { contains: q, mode: 'insensitive' };
    const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
    const total = await prisma.task.count({ where });
    const currentPage = Math.min(page, Math.ceil(total / 50) || 1);
    const orderBy = view === 'social' ? (req.query.order === 'manual' ? [{ socialOrder: 'asc' }, { id: 'asc' }] : [{ dueDate: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }]) : [{ important: 'desc' }, { dueDate: { sort: 'asc', nulls: 'last' } }, { id: 'desc' }];
    const tasks = await prisma.task.findMany({ where, include, orderBy, skip: (currentPage - 1) * 50, take: 50 });
    res.json({ tasks: tasks.map(task => present(task, user)), total, page: currentPage, pages: Math.ceil(total / 50) });
  });
  router.get('/:id', async (req, res) => {
    const task = await prisma.task.findFirst({ where: { id: id(req.params.id), ...taskScope(req.taskUser), deletedAt: null }, include });
    if (!task) throw fail('Tarefa não encontrada.', 404);
    res.json(present(task, req.taskUser));
  });
  router.post('/', async (req, res) => {
    const data = taskData(req.body, true);
    data.assigneeId = await validateRelations(data, req.taskUser);
    data.createdById = req.taskUser.id;
    data.delegatedById = data.assigneeId !== req.taskUser.id ? req.taskUser.id : null;
    const created = await prisma.$transaction(async tx => {
      let task = await tx.task.create({ data, include });
      if (task.category === 'SOCIAL') task = await tx.task.update({ where: { id: task.id }, data: { socialOrder: task.id }, include });
      await notifyAssignment(tx, task, req.taskUser);
      return task;
    });
    res.status(201).json(present(created, req.taskUser));
  });
  router.patch('/:id', async (req, res) => {
    const taskId = id(req.params.id);
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw fail('Dados da tarefa inválidos.');
    const previous = await prisma.task.findFirst({ where: { id: taskId, ...taskScope(req.taskUser), deletedAt: req.body.restore === true ? { not: null } : null } });
    if (!previous) throw fail('Tarefa não encontrada.', 404);
    const data = taskData(req.body);
    if (data.category && data.category !== previous.category) throw fail('A lista de origem da tarefa não pode ser alterada.');
    await validateRelations(data, req.taskUser, previous);
    if (data.assigneeId !== undefined && data.assigneeId !== previous.assigneeId) {
      data.delegatedById = data.assigneeId !== req.taskUser.id ? req.taskUser.id : null;
    }
    if (req.body.restore === true) data.deletedAt = null;
    if (req.body.remove === true) data.deletedAt = new Date();
    const version = id(req.body.version);
    if (previous.version !== version) throw fail('Esta tarefa mudou. Atualize a lista antes de salvar novamente.', 409);
    const updated = await prisma.$transaction(async tx => {
      const result = await tx.task.updateMany({ where: { id: taskId, version, ...taskScope(req.taskUser) }, data: { ...data, version: { increment: 1 } } });
      if (!result.count) throw fail('Esta tarefa mudou. Atualize a lista antes de salvar novamente.', 409);
      const task = await tx.task.findUnique({ where: { id: taskId }, include });
      if (task.assigneeId !== previous.assigneeId) {
        await tx.taskNotification.deleteMany({ where: { taskId } });
        await notifyAssignment(tx, task, req.taskUser);
      }
      if (previous.status === 'DONE' && task.status !== 'DONE') {
        await tx.taskNotification.deleteMany({ where: { taskId, kind: 'COMPLETED' } });
      }
      if (previous.status !== 'DONE' && task.status === 'DONE') await notifyCompletion(tx, task, req.taskUser);
      return task;
    });
    res.json(present(updated, req.taskUser));
  });
  router.use((error, _req, res, _next) => {
    console.error('[TASKS]', error.status ? error.message : error.code || 'Falha interna');
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Não foi possível acessar as tarefas. Tente novamente.' });
  });
  return router;
}
