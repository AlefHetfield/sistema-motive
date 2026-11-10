const wholeCurrency = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0,
});

function commissionCents(value) {
  if (value === null || value === undefined || value === '') return null;
  const match = String(value).match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const cents = BigInt(match[2]) * 100n + BigInt((match[3] || '').padEnd(2, '0'));
  return match[1] ? -cents : cents;
}

const decimalAmount = value => {
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
};

export function formatClientCommission(value) {
  const cents = commissionCents(value);
  if (cents === null) return 'A informar';
  const absolute = cents < 0n ? -cents : cents;
  return `${cents < 0n ? '− ' : ''}${wholeCurrency.format(absolute / 100n)},${String(absolute % 100n).padStart(2, '0')}`;
}

export function isVaniaBroker(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR') === 'vania';
}

export function getClientCommissionBreakdown(client) {
  const gross = commissionCents(client.comissaoEstimada);
  const discounts = [];
  if (client.visitaDiego === true) discounts.push({ descricao: 'Visita Diego', valor: '1000.00' });
  if (isVaniaBroker(client.corretor)) discounts.push({ descricao: 'Corretora Vânia', valor: '500.00' });
  for (const item of Array.isArray(client.descontosComissao) ? client.descontosComissao : []) {
    const value = commissionCents(item?.valor);
    if (value === null || value <= 0n) continue;
    discounts.push({ descricao: String(item.descricao || '').trim() || 'Outro desconto', valor: decimalAmount(value) });
  }
  const discountTotal = discounts.reduce((sum, item) => sum + commissionCents(item.valor), 0n);
  const net = gross === null ? null : gross - discountTotal;
  return {
    gross: gross === null ? null : decimalAmount(gross),
    discounts,
    discountTotal: decimalAmount(discountTotal),
    net: net === null ? null : decimalAmount(net),
    excess: net !== null && net < 0n ? decimalAmount(-net) : null,
    requiresReview: client.venda === true && net !== null && net < 0n,
  };
}

export function summarizeClientCommissions(clients) {
  const sales = clients.filter(client => client.venda === true);
  let total = 0n;
  let missingCount = 0;
  let reviewCount = 0;
  for (const client of sales) {
    const breakdown = getClientCommissionBreakdown(client);
    const value = commissionCents(breakdown.net);
    if (value === null) missingCount++;
    else if (breakdown.requiresReview) reviewCount++;
    else total += value;
  }
  return {
    total: decimalAmount(total),
    count: sales.length,
    missingCount,
    reviewCount,
  };
}
