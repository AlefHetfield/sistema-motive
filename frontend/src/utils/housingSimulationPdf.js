import { jsPDF } from 'jspdf';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const percentage = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatMoney = (value) => money.format(value).replace(/\u00a0/g, ' ');

const COLORS = {
  primary: [91, 124, 153],
  secondary: [52, 62, 72],
  muted: [108, 117, 125],
  border: [222, 226, 230],
  surface: [247, 249, 251],
  success: [5, 150, 105],
  white: [255, 255, 255],
};

function productName(result) {
  return result.bank === 'CAIXA' && result.program !== 'SBPE'
    ? `MCMV - ${result.program}`
    : result.program;
}

function text(doc, value, x, y, { size = 9, color = COLORS.secondary, style = 'normal', align = 'left' } = {}) {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
  doc.text(String(value), x, y, { align });
}

function metricCard(doc, x, y, width, label, value) {
  doc.setFillColor(...COLORS.surface);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(x, y, width, 24, 3, 3, 'FD');
  text(doc, label.toUpperCase(), x + 5, y + 8, { size: 7, color: COLORS.muted, style: 'bold' });
  text(doc, value, x + 5, y + 17, { size: 13, color: COLORS.secondary, style: 'bold' });
}

function sectionTitle(doc, label, y) {
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(16, y - 4, 3, 7, 1, 1, 'F');
  text(doc, label, 23, y + 1, { size: 10, style: 'bold' });
}

function detailRow(doc, label, value, y, shade = false) {
  if (shade) {
    doc.setFillColor(...COLORS.surface);
    doc.rect(16, y - 5, 178, 9, 'F');
  }
  text(doc, label, 20, y + 1, { size: 8.5, color: COLORS.muted });
  text(doc, value, 190, y + 1, { size: 8.5, style: 'bold', align: 'right' });
}

export function createHousingSimulationPdf(result, generatedAt = new Date()) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const generatedLabel = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(generatedAt);

  doc.setFillColor(...COLORS.secondary);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 31, 210, 3, 'F');
  text(doc, 'MOTIVE', 16, 14, { size: 18, color: COLORS.white, style: 'bold' });
  text(doc, 'Consultoria Imobiliária', 16, 21, { size: 8, color: [220, 226, 232] });
  text(doc, 'SIMULAÇÃO HABITACIONAL', 194, 14, { size: 11, color: COLORS.white, style: 'bold', align: 'right' });
  text(doc, `Gerada em ${generatedLabel}`, 194, 21, { size: 7.5, color: [220, 226, 232], align: 'right' });

  doc.setFillColor(...COLORS.surface);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(16, 42, 178, 15, 3, 3, 'FD');
  text(doc, result.bank, 22, 51.5, { size: 10, color: result.bank === 'CAIXA' ? COLORS.primary : [190, 35, 50], style: 'bold' });
  text(doc, productName(result), 105, 51.5, { size: 9, style: 'bold', align: 'center' });
  text(doc, result.system, 188, 51.5, { size: 9, style: 'bold', align: 'right' });

  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(16, 64, 178, 30, 4, 4, 'F');
  text(doc, 'VALOR ESTIMADO DO FINANCIAMENTO', 24, 75, { size: 8, color: [226, 235, 242], style: 'bold' });
  text(doc, formatMoney(result.financed), 24, 87, { size: 22, color: COLORS.white, style: 'bold' });

  metricCard(doc, 16, 101, 86, 'Entrada necessária', formatMoney(result.requiredEntry));
  metricCard(doc, 108, 101, 86, 'Primeira parcela', formatMoney(result.installment.total));

  sectionTitle(doc, 'CONDIÇÕES DA SIMULAÇÃO', 137);
  const conditions = [
    ['Valor do imóvel', formatMoney(result.propertyValue)],
    ['Prazo utilizado', `${result.term} meses`],
    ['Taxa efetiva', `${percentage.format(result.rate.effective)}% a.a.`],
    ['Cota utilizada', `${percentage.format(result.quota)}%`],
    ['Sistema de amortização', result.system],
  ];
  conditions.forEach(([label, value], index) => detailRow(doc, label, value, 147 + index * 9, index % 2 === 0));

  sectionTitle(doc, 'COMPOSIÇÃO DA PRIMEIRA PARCELA', 198);
  const composition = [
    ['Amortização + juros', formatMoney(result.installment.base)],
    ['Seguro MIP', formatMoney(result.installment.mip)],
    ['Seguro DFI', formatMoney(result.installment.dfi)],
    ['Tarifa administrativa', formatMoney(result.installment.adminFee)],
    ['Total estimado', formatMoney(result.installment.total)],
  ];
  composition.forEach(([label, value], index) => detailRow(doc, label, value, 208 + index * 9, index % 2 === 0));

  doc.setFillColor(255, 248, 230);
  doc.setDrawColor(245, 205, 120);
  doc.roundedRect(16, 255, 178, 18, 3, 3, 'FD');
  text(doc, 'IMPORTANTE', 21, 263, { size: 7.5, color: [146, 94, 20], style: 'bold' });
  const disclaimer = 'Valores estimados, sujeitos à análise de crédito, avaliação do imóvel e regras vigentes da instituição financeira.';
  text(doc, disclaimer, 21, 268.5, { size: 7.2, color: [120, 82, 28] });

  doc.setDrawColor(...COLORS.border);
  doc.line(16, 283, 194, 283);
  text(doc, 'Motive Consultoria Imobiliária', 16, 289, { size: 7.5, color: COLORS.muted, style: 'bold' });
  text(doc, 'Documento de simulação comercial', 194, 289, { size: 7.5, color: COLORS.muted, align: 'right' });

  return doc;
}

export function downloadHousingSimulationPdf(result, generatedAt = new Date()) {
  const doc = createHousingSimulationPdf(result, generatedAt);
  const date = generatedAt.toISOString().slice(0, 10);
  doc.save(`simulacao-habitacional-${result.bank.toLowerCase()}-${date}.pdf`);
}
