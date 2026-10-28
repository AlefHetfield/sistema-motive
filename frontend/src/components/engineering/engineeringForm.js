const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const engineeringMoney = value => value === null || value === undefined || value === '' ? 'Não informado' : currency.format(Number(value));
export const engineeringDate = value => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : 'Não informada';
};
export const moneyInput = value => value === null || value === undefined || value === '' ? '' : decimal.format(Number(value));

// Digit entry follows the same cents-first convention used by the client form.
export function maskEngineeringMoney(value) {
  const digits = String(value ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digits) return '';
  if (digits.length > 15) return null;
  const padded = digits.padStart(3, '0');
  const whole = padded.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${whole},${padded.slice(-2)}`;
}

// Inputs use the Brazilian decimal separator; grouping separators are optional.
export function parseEngineeringMoney(value) {
  const text = String(value ?? '').trim().replace(/^R\$\s*/, '');
  if (!text) return null;
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text)) throw new Error('Use um valor em reais, por exemplo 250.000,00.');
  const normalized = text.replaceAll('.', '').replace(',', '.');
  const [whole, fraction = ''] = normalized.split('.');
  if (whole.replace(/^0+/, '').length > 13) throw new Error('O valor deve ter até 13 dígitos antes dos centavos.');
  return `${whole.replace(/^0+(?=\d)/, '')}.${fraction.padEnd(2, '0')}`;
}

export const emptyEngineeringForm = item => ({
  imovel: item?.imovel || '', matricula: item?.matricula || '', cidade: item?.cidade || '',
  dataPedido: item?.dataPedido?.slice(0, 10) || '', valorImovel: moneyInput(item?.valorImovel),
  valorAvaliado: moneyInput(item?.valorAvaliado), descricao: item?.descricao || '', propertyId: item?.propertyId || null,
});
