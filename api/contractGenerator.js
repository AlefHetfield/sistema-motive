import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.resolve(moduleDir, '../assets/templates/contrato-motive-v1.docx');

const UNITS = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const TEENS = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const TENS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const HUNDREDS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const requiredPersonFields = [
  ['nome', 'nome'],
  ['cpf', 'CPF'],
  ['rg', 'RG'],
  ['estadoCivil', 'estado civil'],
  ['endereco', 'endereço'],
];

const cleanText = (value, maxLength = 500) => String(value ?? '').trim().slice(0, maxLength);
const MAX_CONTRACT_VALUE = 999_999_999.99;
const numberValue = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value ?? '').replace(/R\$/gi, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const isValidIsoDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
};

const underThousand = (number) => {
  if (!number) return '';
  if (number === 100) return 'cem';
  const parts = [];
  const hundreds = Math.floor(number / 100);
  const remainder = number % 100;
  if (hundreds) parts.push(HUNDREDS[hundreds]);
  if (remainder) {
    if (hundreds) parts.push('e');
    if (remainder < 10) parts.push(UNITS[remainder]);
    else if (remainder < 20) parts.push(TEENS[remainder - 10]);
    else {
      parts.push(TENS[Math.floor(remainder / 10)]);
      if (remainder % 10) parts.push('e', UNITS[remainder % 10]);
    }
  }
  return parts.join(' ');
};

const integerToWords = (number) => {
  if (number === 0) return 'zero';
  const scales = [
    { value: 1_000_000_000, singular: 'um bilhão', plural: 'bilhões' },
    { value: 1_000_000, singular: 'um milhão', plural: 'milhões' },
    { value: 1_000, singular: 'mil', plural: 'mil' },
  ];
  let remainder = number;
  const chunks = [];
  for (const scale of scales) {
    const amount = Math.floor(remainder / scale.value);
    remainder %= scale.value;
    if (!amount) continue;
    if (amount === 1) chunks.push(scale.singular);
    else chunks.push(`${underThousand(amount)} ${scale.plural}`);
  }
  if (remainder) chunks.push(underThousand(remainder));
  if (chunks.length === 1) return chunks[0];
  return `${chunks.slice(0, -1).join(', ')} e ${chunks.at(-1)}`;
};

const moneyToWords = (value) => {
  const centsTotal = Math.round(Number(value) * 100);
  const reais = Math.floor(centsTotal / 100);
  const cents = centsTotal % 100;
  const parts = [];
  if (reais || !cents) parts.push(`${integerToWords(reais)} ${reais === 1 ? 'real' : 'reais'}`);
  if (cents) parts.push(`${integerToWords(cents)} ${cents === 1 ? 'centavo' : 'centavos'}`);
  return parts.join(' e ');
};

const currency = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
}).format(value).replace(/\u00a0/g, ' ');

const cpfIsValid = (value) => {
  const cpf = String(value || '').replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const digit = (length) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) sum += Number(cpf[index]) * (length + 1 - index);
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
};

const normalizePerson = (person) => ({
  nome: cleanText(person?.nome, 160),
  cpf: cleanText(person?.cpf, 20),
  rg: cleanText(person?.rg, 30),
  orgaoEmissor: cleanText(person?.orgaoEmissor || 'SSP', 20),
  ufRg: cleanText(person?.ufRg || 'SP', 2).toUpperCase(),
  estadoCivil: cleanText(person?.estadoCivil, 50),
  genero: person?.genero === 'F' ? 'F' : 'M',
  endereco: cleanText(person?.endereco, 350),
});

export function normalizeAndValidateContractData(payload) {
  const vendedores = Array.isArray(payload?.vendedores) ? payload.vendedores.slice(0, 2).map(normalizePerson) : [];
  const compradores = Array.isArray(payload?.compradores) ? payload.compradores.slice(0, 2).map(normalizePerson) : [];
  const imovel = {
    categoria: cleanText(payload?.imovel?.categoria, 50),
    matricula: cleanText(payload?.imovel?.matricula, 80),
    cartorio: cleanText(payload?.imovel?.cartorio, 180),
    endereco: cleanText(payload?.imovel?.endereco, 350),
    descricao: cleanText(payload?.imovel?.descricao, 2500),
  };
  const valores = {
    valorImovel: numberValue(payload?.valores?.valorImovel),
    sinal: numberValue(payload?.valores?.sinal),
    fgts: numberValue(payload?.valores?.fgts),
    recursosProprios: numberValue(payload?.valores?.recursosProprios),
    financiamento: numberValue(payload?.valores?.financiamento),
    reservaDocumentacao: numberValue(payload?.valores?.reservaDocumentacao),
    banco: cleanText(payload?.valores?.banco, 100),
    prazoDias: Number(payload?.valores?.prazoDias),
  };
  const contrato = {
    cidade: cleanText(payload?.contrato?.cidade, 120),
    data: cleanText(payload?.contrato?.data, 10),
  };
  const errors = [];

  if (!vendedores.length || !compradores.length) errors.push('Informe pelo menos um vendedor e um comprador.');
  for (const [groupLabel, people] of [['Vendedor', vendedores], ['Comprador', compradores]]) {
    people.forEach((person, index) => {
      for (const [key, label] of requiredPersonFields) {
        if (!person[key]) errors.push(`${groupLabel} ${index + 1}: informe ${label}.`);
      }
      if (person.cpf && !cpfIsValid(person.cpf)) errors.push(`${groupLabel} ${index + 1}: CPF inválido.`);
    });
  }
  if (!imovel.descricao && (!imovel.categoria || !imovel.matricula || !imovel.cartorio || !imovel.endereco)) {
    errors.push('Informe a descrição completa do imóvel ou todos os dados estruturados do imóvel.');
  }
  if (Object.values(valores).some(value => value === null)) errors.push('Há valores financeiros inválidos.');
  for (const key of ['valorImovel', 'sinal', 'fgts', 'recursosProprios', 'financiamento', 'reservaDocumentacao']) {
    if (valores[key] < 0) errors.push('Os valores financeiros não podem ser negativos.');
    if (valores[key] > MAX_CONTRACT_VALUE) errors.push('Os valores financeiros devem ser inferiores a R$ 1 bilhão.');
  }
  if (!(valores.valorImovel > 0)) errors.push('O valor do imóvel deve ser maior que zero.');
  const composition = valores.sinal + valores.fgts + valores.recursosProprios + valores.financiamento;
  if (Math.abs(composition - valores.valorImovel) > 0.01) errors.push('A composição do pagamento deve ser igual ao valor do imóvel.');
  if (!valores.banco) errors.push('Informe o banco responsável pelo financiamento.');
  if (!Number.isInteger(valores.prazoDias) || valores.prazoDias < 1 || valores.prazoDias > 730) errors.push('Informe um prazo entre 1 e 730 dias.');
  if (!contrato.cidade) errors.push('Informe a cidade do contrato.');
  if (!isValidIsoDate(contrato.data)) errors.push('Informe uma data válida para o contrato.');

  if (errors.length) {
    const error = new Error(errors[0]);
    error.details = errors;
    throw error;
  }
  return { vendedores, compradores, imovel, valores, contrato };
}

const personQualification = (person) => {
  const female = person.genero === 'F';
  const registered = female ? 'inscrita' : 'inscrito';
  const resident = female ? 'residente e domiciliada' : 'residente e domiciliado';
  return `${person.nome.toUpperCase()}, ${person.estadoCivil.toLowerCase()}, ${registered} na cédula de identidade RG nº ${person.rg} ${person.orgaoEmissor}/${person.ufRg}, ${registered} no CPF sob nº ${person.cpf}; ${resident} à ${person.endereco}.`;
};

const peopleQualification = (people) => people.map(personQualification).join(' e ');

const propertyDescription = (property) => {
  if (property.descricao) return property.descricao;
  return `Um(a) ${property.categoria.toLowerCase()} localizado(a) à ${property.endereco}, objeto da matrícula nº ${property.matricula}, do ${property.cartorio}, assim descrito e caracterizado, denominado “imóvel”.`;
};

const longDate = (isoDate, city) => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return `${city}, ${day} de ${MONTHS[month - 1]} de ${year}.`;
};

const templateData = (data) => ({
  PARAGRAFO_VENDEDOR: peopleQualification(data.vendedores),
  PARAGRAFO_COMPRADOR: peopleQualification(data.compradores),
  PARAGRAFO_IMOVEL: propertyDescription(data.imovel),
  NOME_VENDEDOR: data.vendedores[0]?.nome.toUpperCase() || '',
  NOME_SEGUNDO_VENDEDOR: data.vendedores[1]?.nome.toUpperCase() || '',
  NOME_COMPRADOR: data.compradores[0]?.nome.toUpperCase() || '',
  NOME_SEGUNDO_COMPRADOR: data.compradores[1]?.nome.toUpperCase() || '',
  VALOR_DO_IMOVEL: currency(data.valores.valorImovel),
  EXTENSO_VALOR_DO_IMOVEL: moneyToWords(data.valores.valorImovel),
  VALOR_SINAL: currency(data.valores.sinal),
  EXTENSO_SINAL: moneyToWords(data.valores.sinal),
  VALOR_FGTS: currency(data.valores.fgts),
  EXTENSO_FGTS: moneyToWords(data.valores.fgts),
  VALOR_RECURSOS: currency(data.valores.recursosProprios),
  EXTENSO_RECURSOS: moneyToWords(data.valores.recursosProprios),
  VALOR_FINANCIAMENTO: currency(data.valores.financiamento),
  EXTENSO_FINANCIAMENTO: moneyToWords(data.valores.financiamento),
  VALOR_DOCUMENTACAO: currency(data.valores.reservaDocumentacao),
  EXTENSO_DOCUMENTACAO: moneyToWords(data.valores.reservaDocumentacao),
  NOME_BANCO: data.valores.banco,
  PRAZO_DIAS: String(data.valores.prazoDias),
  EXTENSO_PRAZO_DIAS: integerToWords(data.valores.prazoDias),
  DATA_ATUAL: longDate(data.contrato.data, data.contrato.cidade),
});

export function generateContractDocx(contractData) {
  const data = normalizeAndValidateContractData(contractData);
  const zip = new PizZip(fs.readFileSync(TEMPLATE_PATH));
  const document = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  });
  document.render(templateData(data));
  const result = document.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  const renderedZip = new PizZip(result);
  const unresolved = Object.keys(renderedZip.files)
    .filter(name => name.endsWith('.xml'))
    .some(name => /\{[A-Z0-9_]+\}/.test(renderedZip.file(name)?.asText() || ''));
  if (unresolved) throw new Error('O contrato contém campos não preenchidos.');
  return result;
}

export function contractDownloadName(contractData) {
  const buyer = cleanText(contractData?.compradores?.[0]?.nome || 'Cliente', 100)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 _-]/g, '')
    .trim();
  return `Contrato - ${buyer || 'Cliente'}.docx`;
}
