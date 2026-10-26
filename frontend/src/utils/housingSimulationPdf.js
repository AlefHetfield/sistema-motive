import { jsPDF } from 'jspdf';
import caixaLogo from '../assets/caixa-logo.png?inline';
import { HOUSING_PDF_FONT, registerHousingSimulationFonts } from './housingSimulationFonts.js';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const percentage = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatMoney = (value) => money.format(value).replace(/\u00a0/g, ' ');
const formatPercentage = (value) => `${percentage.format(value)}%`;
const LEFT = 15;
const RIGHT = 195;
const WIDTH = RIGHT - LEFT;
const COLORS = {
  text: [30, 30, 30],
  muted: [95, 95, 95],
  border: [218, 218, 218],
  section: [231, 231, 231],
  blue: [0, 92, 169],
  orange: [238, 132, 0],
};

function productName(result) {
  return result.bank === 'CAIXA' && result.program !== 'SBPE'
    ? `Programa Minha Casa, Minha Vida - ${result.program}`
    : result.program === 'SBPE' ? 'Crédito Imobiliário - SBPE' : result.program;
}

function text(doc, value, x, y, { size = 9, color = COLORS.text, style = 'normal', align = 'left' } = {}) {
  doc.setFont(HOUSING_PDF_FONT, style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
  doc.text(Array.isArray(value) ? value : String(value), x, y, { align });
}

function rule(doc, y) {
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.2);
  doc.line(LEFT, y, RIGHT, y);
}

function sectionTitle(doc, label, y) {
  doc.setFillColor(...COLORS.section);
  doc.rect(LEFT, y, WIDTH, 9, 'F');
  text(doc, label, LEFT + 3, y + 5.9, { size: 10, style: 'semibold' });
  return y + 9;
}

function fieldsRow(doc, fields, y) {
  const cellWidth = WIDTH / fields.length;
  let height = 17;
  fields.forEach(([label, value], index) => {
    const x = LEFT + 3 + index * cellWidth;
    text(doc, label, x, y + 5.3, { size: 7.7, style: 'semibold' });
    doc.setFont(HOUSING_PDF_FONT, 'normal');
    doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(String(value), cellWidth - 6);
    text(doc, lines, x, y + 11.3, { size: 8.5 });
    height = Math.max(height, 14.5 + (lines.length - 1) * 3.8);
  });
  rule(doc, y + height);
  return y + height;
}

function answerRow(doc, question, answer, y) {
  text(doc, question, LEFT + 3, y + 5.5, { size: 7.8, style: 'semibold' });
  text(doc, answer, LEFT + 3, y + 11, { size: 8.5 });
  rule(doc, y + 16);
  return y + 16;
}

function contextRows(result, input) {
  const fields = [];
  if (input.birthDate) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(input.birthDate)
      ? input.birthDate.split('-').reverse().join('/') : input.birthDate;
    fields.push(['Nascimento', date]);
  }
  const income = typeof input.income === 'number' && Number.isFinite(input.income)
    ? input.income : result.commitment > 0 ? result.maxPayment / result.commitment : null;
  if (income != null) fields.push(['Renda familiar bruta mensal', formatMoney(income)]);
  return fields;
}

export function createHousingSimulationPdf(result, generatedAt = new Date(), input = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  registerHousingSimulationFonts(doc);
  const isCaixa = result.bank === 'CAIXA';
  const isMcmv = isCaixa && result.program !== 'SBPE';
  const accent = isCaixa ? COLORS.orange : [204, 9, 47];
  const dateLabel = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(generatedAt);
  const timeLabel = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'medium', timeZone: 'America/Sao_Paulo' }).format(generatedAt);
  const personal = contextRows(result, input);
  doc.setProperties({ title: `Simulação de Financiamento Habitacional - ${result.bank}`, subject: 'Estimativa de financiamento habitacional', creator: 'Simulador habitacional' });

  const header = () => {
    if (isCaixa) doc.addImage(caixaLogo, 'PNG', LEFT, 18, 25, 25 * 32 / 142);
    else text(doc, 'Bradesco', LEFT, 24, { size: 20, color: accent, style: 'semibold' });
    text(doc, `Data: ${dateLabel}`, RIGHT, 19, { size: 8, align: 'right' });
    text(doc, `Hora: ${timeLabel}`, RIGHT, 24, { size: 8, align: 'right' });
    doc.setFillColor(...accent);
    doc.rect(LEFT, 32, 1.6, 10, 'F');
    text(doc, 'Simulação de Financiamento Habitacional', LEFT + 6, 36, { size: 11.5, style: 'semibold' });
    text(doc, `Crédito Imobiliário ${isCaixa ? 'CAIXA' : 'Bradesco'}`, LEFT + 6, 41.5, { size: 8.5, color: COLORS.muted });
  };
  header();
  let y = 49;

  if (personal.length) {
    y = sectionTitle(doc, 'Dados Pessoais', y);
    y = fieldsRow(doc, personal, y);
    if (isMcmv && typeof input.fgts3y === 'boolean') {
      y = answerRow(doc, 'Possui pelo menos 3 anos de trabalho com depósito de FGTS?', input.fgts3y ? 'Sim, tenho 3 anos ou mais' : 'Não', y);
    }
    y += 5;
  }

  const property = [];
  if (input.propertyCondition) property.push(['Objetivo', `Aquisição de imóvel ${input.propertyCondition.toLocaleLowerCase('pt-BR')}`]);
  property.push(['Valor do imóvel', formatMoney(result.propertyValue)]);
  if (input.municipality && input.uf) property.push(['Localização', `${input.municipality}, ${input.uf}`]);
  y = sectionTitle(doc, 'Dados do Imóvel', y);
  y = fieldsRow(doc, property, y);
  if (isMcmv && ['yes', 'no'].includes(input.previousSubsidy)) {
    y = answerRow(doc, 'Já recebeu subsídio habitacional do governo?', input.previousSubsidy === 'yes' ? 'Sim' : 'Não', y);
  }
  y += 5;

  y = sectionTitle(doc, productName(result), y);
  y = fieldsRow(doc, [
    ['Prazo escolhido', `${result.term} meses`],
    ['Valor de entrada', formatMoney(result.requiredEntry)],
    ['Valor parcela', formatMoney(result.installment.total)],
  ], y);
  y = fieldsRow(doc, [
    ['Valor do imóvel', formatMoney(result.propertyValue)],
    ['Valor do financiamento', formatMoney(result.financed)],
    ['Sistema de amortização', result.system],
  ], y);
  y = fieldsRow(doc, [
    ['Juros nominais', `${formatPercentage(result.rate.nominal)} a.a.`],
    ['Juros efetivos', `${formatPercentage(result.rate.effective)} a.a.`],
    ['Cota máxima de financ.', formatPercentage(result.quotaLimit)],
    ['Cota utilizada', formatPercentage(result.quota)],
  ], y);
  y += 5;

  // Keep the composition together when a long municipality name wraps onto extra lines.
  if (y + 45 > 277) { doc.addPage(); header(); y = 49; }
  y = sectionTitle(doc, 'Composição da parcela', y);
  const composition = [
    ['Amortização + juros', result.installment.base],
    ['Seguro MIP', result.installment.mip],
    ['Seguro DFI', result.installment.dfi],
    ['Taxa de administração', result.installment.adminFee],
    ['Valor parcela', result.installment.total],
  ];
  composition.forEach(([label, value], index) => {
    const total = index === composition.length - 1;
    if (total) rule(doc, y + 1);
    text(doc, label, LEFT + 3, y + 5.5, { size: 8.5, style: total ? 'semibold' : 'normal' });
    text(doc, formatMoney(value), RIGHT - 3, y + 5.5, { size: 8.5, style: 'semibold', align: 'right' });
    y += 6.4;
  });
  y += 6;

  const notes = [
    ...result.alerts.filter((alert) => ['warning', 'error'].includes(alert.type)).map((alert) => alert.message),
    'Valores estimados, sujeitos à análise de crédito, avaliação do imóvel e regras vigentes da instituição financeira.',
  ];
  notes.forEach((note) => {
    doc.setFont(HOUSING_PDF_FONT, 'normal');
    doc.setFontSize(7.5);
    const lines = doc.splitTextToSize(note, WIDTH - 7);
    const height = lines.length * 3.5 + 3;
    if (y + height > 277) { doc.addPage(); header(); y = 49; }
    doc.setFillColor(...(isCaixa ? COLORS.blue : accent));
    doc.rect(LEFT, y - 2, 1.2, height - 1, 'F');
    text(doc, lines, LEFT + 4, y + 1, { size: 7.5, color: COLORS.muted });
    y += height;
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    rule(doc, 283);
    text(doc, `Financiamento Habitacional ${isCaixa ? 'CAIXA' : 'Bradesco'}`, LEFT, 289, { size: 7, color: COLORS.muted });
    text(doc, `${page} / ${pages}`, RIGHT, 289, { size: 7, color: COLORS.muted, align: 'right' });
  }
  return doc;
}

export function downloadHousingSimulationPdf(result, generatedAt = new Date(), input = {}) {
  const doc = createHousingSimulationPdf(result, generatedAt, input);
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(generatedAt);
  doc.save(`simulacao-habitacional-${result.bank.toLowerCase()}-${date}.pdf`);
}
