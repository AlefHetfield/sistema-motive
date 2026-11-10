import { formatClientCommission, getClientCommissionBreakdown, summarizeClientCommissions } from '../frontend/src/utils/clientCommission.js';

const fail = (message, status = 400, code) => Object.assign(new Error(message), { status, code });

function commissionCents(value) {
  if (!['string', 'number'].includes(typeof value)) throw fail('Informe uma comissão estimada válida.');
  const match = String(value).match(/^(\d{1,13})(?:\.(\d{1,2}))?$/);
  if (!match) throw fail('A comissão estimada deve ser um valor positivo ou zero, com até duas casas decimais.');
  return BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'));
}

const decimalAmount = cents => `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
const privateFields = ['comissaoEstimada', 'visitaDiego', 'descontosComissao'];

export function clientWriteData(body, user, current = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail('Dados do cliente inválidos.');
  // Client updates use scalar fields. Nested relations could bypass the commission permission.
  if (['property', 'simulacoes', 'contratos', 'tasks'].some(key => Object.hasOwn(body, key))) {
    throw fail('Atualize os vínculos pelos campos de identificação.');
  }
  const data = { ...body };
  if (Object.hasOwn(data, 'venda') && typeof data.venda !== 'boolean') throw fail('Informe se o processo é uma venda.');
  if (Object.hasOwn(data, 'corretor') && data.corretor !== null && typeof data.corretor !== 'string') throw fail('Informe um nome de corretor válido.');
  if (user.role !== 'ADM' && privateFields.some(key => Object.hasOwn(data, key))) {
    throw fail('Os dados da comissão são exclusivos para administradores.', 403);
  }
  if (Object.hasOwn(data, 'comissaoEstimada')) {
    data.comissaoEstimada = data.comissaoEstimada === null || data.comissaoEstimada === ''
      ? null : decimalAmount(commissionCents(data.comissaoEstimada));
  }
  if (Object.hasOwn(data, 'visitaDiego') && typeof data.visitaDiego !== 'boolean') throw fail('Informe se houve Visita Diego.');
  if (Object.hasOwn(data, 'descontosComissao')) {
    if (!Array.isArray(data.descontosComissao) || data.descontosComissao.length > 100) throw fail('Informe até 100 descontos adicionais.');
    data.descontosComissao = data.descontosComissao.map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some(key => !['descricao', 'valor'].includes(key))
          || typeof item.descricao !== 'string' || !item.descricao.trim() || item.descricao.trim().length > 100) {
        throw fail('Cada desconto deve ter uma descrição de até 100 caracteres e um valor maior que zero.');
      }
      const value = commissionCents(item.valor);
      if (value <= 0n) throw fail('Cada desconto adicional deve ter valor maior que zero.');
      return { descricao: item.descricao.trim(), valor: decimalAmount(value) };
    });
  }
  const breakdown = getClientCommissionBreakdown({ ...current, ...data });
  if (breakdown.requiresReview) {
    const message = user.role === 'ADM'
      ? `Os descontos superam a comissão bruta em ${formatClientCommission(breakdown.excess)}. Revise os valores antes de salvar.`
      : 'Este cadastro precisa de revisão administrativa antes de salvar a alteração. Solicite a um administrador.';
    throw fail(message, 422, 'COMMISSION_REVIEW_REQUIRED');
  }
  return data;
}

export function presentClient(client, user) {
  if (user.role === 'ADM') return client;
  const result = { ...client };
  privateFields.forEach(key => { delete result[key]; });
  return result;
}

export function currentClientUser(prisma) {
  return async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, nome: true, role: true, isActive: true } });
      if (!user?.isActive) return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });
      req.user = user;
      next();
    } catch {
      res.status(503).json({ error: 'Não foi possível verificar seu acesso.' });
    }
  };
}

export function commissionReportInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['ids', 'scope'].includes(key))) {
    throw fail('Seleção de comissões inválida.');
  }
  if (!Array.isArray(body.ids) || body.ids.length > 5000 || body.ids.some(id => !Number.isInteger(id) || id < 1 || id > 2147483647)) {
    throw fail('Selecione até 5.000 processos válidos para o relatório.');
  }
  if (body.scope !== undefined && (typeof body.scope !== 'string' || body.scope.length > 500)) {
    throw fail('Descrição dos filtros inválida.');
  }
  return { ids: [...new Set(body.ids)], scope: String(body.scope || '').replace(/\s+/g, ' ').trim() || 'Seleção atual' };
}

export function buildCommissionReport(clients, { scope, generatedAt = new Date() }) {
  const sales = clients.filter(client => client.venda === true);
  const items = sales.map(client => ({
    id: client.id,
    nome: client.nome || 'Cliente sem nome',
    imovel: client.imovel || [client.property?.code, client.property?.title].filter(Boolean).join(' · ') || 'Imóvel não informado',
    status: [client.status || 'Status não informado', client.emEspera ? 'Em espera' : null].filter(Boolean).join(' · '),
    observacoes: String(client.observacoes || '').trim(),
    comissaoEstimada: client.comissaoEstimada === null || client.comissaoEstimada === undefined ? null : decimalAmount(commissionCents(String(client.comissaoEstimada))),
    ...getClientCommissionBreakdown(client),
  }));
  const summary = summarizeClientCommissions(sales);
  const formattedDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(generatedAt);
  const lines = ['COMISSÕES ESTIMADAS', formattedDate, `Seleção — ${scope}`, ''];
  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.nome}`, `Imóvel — ${item.imovel}`, `Status — ${item.status}`,
      `Comissão bruta — ${formatClientCommission(item.gross)}`);
    item.discounts.forEach(discount => lines.push(`Desconto — ${discount.descricao} — ${formatClientCommission(discount.valor)}`));
    lines.push(`Total de descontos — ${formatClientCommission(item.discountTotal)}`,
      `Comissão líquida estimada — ${item.requiresReview ? 'Requer revisão' : formatClientCommission(item.net)}`);
    if (item.requiresReview) lines.push(`Revisar comissão — descontos excedem o valor bruto em ${formatClientCommission(item.excess)}.`);
    if (item.observacoes) lines.push(`Observações — ${item.observacoes}`);
    lines.push('');
  });
  lines.push(`TOTAL LÍQUIDO ESTIMADO — ${formatClientCommission(summary.total)}`, `${items.length} ${items.length === 1 ? 'venda' : 'vendas'} · ${summary.missingCount} ${summary.missingCount === 1 ? 'comissão a informar' : 'comissões a informar'}`);
  if (summary.reviewCount) lines.push(`${summary.reviewCount} ${summary.reviewCount === 1 ? 'comissão requer revisão' : 'comissões requerem revisão'} antes de compor o total.`);
  return { items, ...summary, text: lines.join('\n'), generatedAt: generatedAt.toISOString(), scope };
}

export function createCommissionReportHandler(prisma, now = () => new Date()) {
  return async (req, res) => {
    if (req.user.role !== 'ADM') return res.status(403).json({ error: 'O relatório de comissões é exclusivo para administradores.' });
    try {
      const selection = commissionReportInput(req.body);
      const clients = selection.ids.length ? await prisma.client.findMany({
        where: { id: { in: selection.ids }, venda: true },
        select: { id: true, nome: true, imovel: true, status: true, emEspera: true, observacoes: true, venda: true, corretor: true, comissaoEstimada: true, visitaDiego: true, descontosComissao: true, property: { select: { code: true, title: true } } },
      }) : [];
      const byId = new Map(clients.map(client => [client.id, client]));
      const ordered = selection.ids.map(id => byId.get(id)).filter(Boolean);
      res.json(buildCommissionReport(ordered, { scope: selection.scope, generatedAt: now() }));
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.message });
      console.error('Erro ao gerar relatório de comissões:', error.code || error.name);
      res.status(503).json({ error: 'Não foi possível gerar o relatório de comissões. Tente novamente.' });
    }
  };
}
