export const fieldKeys = {
  'Nome completo': 'nome', CPF: 'cpf', RG: 'rg', 'Órgão emissor': 'orgaoEmissor', 'UF do RG': 'ufRg',
  'Estado civil': 'estadoCivil', 'Endereço completo': 'endereco',
  Categoria: 'imovel.categoria', 'Número da matrícula': 'imovel.matricula',
  'Cartório responsável': 'imovel.cartorio', 'Endereço do imóvel': 'imovel.endereco',
  'Valor do imóvel': 'valores.valorImovel', Sinal: 'valores.sinal', FGTS: 'valores.fgts',
  'Recursos próprios': 'valores.recursosProprios', Financiamento: 'valores.financiamento',
  'Reserva para documentação': 'valores.reservaDocumentacao', Banco: 'valores.banco',
  'Prazo do financiamento (dias)': 'valores.prazoDias', 'Cidade do contrato': 'contrato.cidade', 'Data do contrato': 'contrato.data',
};

export function validCpf(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  const digit = length => {
    const sum = [...digits.slice(0, length)].reduce((total, n, i) => total + Number(n) * (length + 1 - i), 0);
    const result = sum * 10 % 11;
    return result === 10 ? 0 : result;
  };
  return digit(9) === Number(digits[9]) && digit(10) === Number(digits[10]);
}

export function validateContractStep(data, step, mode, clientId) {
  const errors = {};
  const required = (key, value, message = 'Preencha este campo.') => { if (!String(value || '').trim()) errors[key] = message; };
  if (step === 0 && mode === 'client' && !clientId) errors.client = 'Selecione um cliente.';
  if (step === 1 || step === 2) {
    const group = step === 1 ? 'vendedores' : 'compradores';
    data[group].forEach((person, index) => {
      for (const key of ['nome', 'cpf', 'rg', 'orgaoEmissor', 'ufRg', 'estadoCivil', 'endereco']) required(`${group}.${index}.${key}`, person[key]);
      if (person.cpf && !validCpf(person.cpf)) errors[`${group}.${index}.cpf`] = 'Informe um CPF válido.';
      if (person.ufRg && !/^[A-Z]{2}$/.test(person.ufRg)) errors[`${group}.${index}.ufRg`] = 'Use duas letras, como SP.';
    });
  }
  if (step === 3 && !data.imovel.descricao.trim()) {
    for (const key of ['categoria', 'matricula', 'cartorio', 'endereco']) required(`imovel.${key}`, data.imovel[key], 'Preencha este campo ou informe a descrição jurídica completa.');
  }
  if (step === 4) {
    for (const key of ['valorImovel', 'sinal', 'fgts', 'recursosProprios', 'financiamento', 'reservaDocumentacao']) {
      const value = Number(data.valores[key]);
      if (!Number.isFinite(value) || value < 0 || value > 999999999.99) errors[`valores.${key}`] = 'Informe um valor entre zero e R$ 999.999.999,99.';
    }
    if (!(data.valores.valorImovel > 0)) errors['valores.valorImovel'] = 'O valor deve ser maior que zero.';
    const composition = ['sinal', 'fgts', 'recursosProprios', 'financiamento'].reduce((sum, key) => sum + Number(data.valores[key]), 0);
    if (Math.abs(data.valores.valorImovel - composition) > 0.01) errors.composition = 'A soma do pagamento precisa ser igual ao valor do imóvel.';
    required('valores.banco', data.valores.banco);
    if (!Number.isInteger(data.valores.prazoDias) || data.valores.prazoDias < 1 || data.valores.prazoDias > 730) errors['valores.prazoDias'] = 'Informe de 1 a 730 dias.';
  }
  if (step === 5) {
    required('contrato.cidade', data.contrato.cidade);
    const date = data.contrato.data;
    const parsed = new Date(`${date}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) errors['contrato.data'] = 'Informe uma data válida.';
  }
  return errors;
}

export const previewSectionPatterns = {
  1: /VENDEDOR\s*\(?S?\)?/,
  2: /COMPRADOR\s*\(?A?\)?/,
  3: /(?:OBJETO|DESCRICAO DO IMOVEL|DA PROPRIEDADE)/,
  4: /(?:PRECO|VALOR TOTAL|FORMA DE PAGAMENTO)/,
};

export function normalizePdfText(items) {
  return items.map(item => item.str).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

export function isContractDraft(draft) {
  const data = draft?.data;
  if (draft?.version !== 1 || !data?.imovel || !data?.valores || !data?.contrato) return false;
  for (const group of ['vendedores', 'compradores']) {
    if (!Array.isArray(data[group]) || data[group].length < 1 || data[group].length > 2) return false;
    if (data[group].some(person => !person || ['nome', 'cpf', 'rg', 'orgaoEmissor', 'ufRg', 'estadoCivil', 'genero', 'endereco'].some(key => typeof person[key] !== 'string'))) return false;
  }
  if (['categoria', 'matricula', 'cartorio', 'endereco', 'descricao'].some(key => typeof data.imovel[key] !== 'string')) return false;
  if (['valorImovel', 'sinal', 'fgts', 'recursosProprios', 'financiamento', 'reservaDocumentacao', 'prazoDias'].some(key => !Number.isFinite(data.valores[key]))) return false;
  return typeof data.valores.banco === 'string' && typeof data.contrato.cidade === 'string' && typeof data.contrato.data === 'string';
}

export function contractPropertyLabel(property) {
  const clean = String(property.title || '').replace(/^\s*\d+\s*[-–]\s*/, '').replace(/\s*[-–]\s*\d+\s*(?:dorm|quartos).*$/i, '').replace(/\s*,?\s*R\$.*$/, '').trim();
  const condo = /apartamento|condom/i.test(property.propertyType || '') || /condom[ií]nio/i.test([property.title, property.address, property.additionalInformation].join(' '));
  return [property.code, condo ? clean || property.neighborhood : property.neighborhood || clean, property.ownerName,
    property.price != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(property.price) : ''].filter(Boolean).join(' - ');
}
