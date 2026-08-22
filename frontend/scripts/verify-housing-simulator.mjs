import assert from 'node:assert/strict';
import { MUNICIPAL_LIMITS } from '../src/data/municipalLimits.js';
import { calculateHousingSimulation } from '../src/utils/housingSimulator.js';

const referenceDate = new Date(2026, 7, 22);
const campinas = MUNICIPAL_LIMITS.SP.find(([name]) => name === 'Campinas');

const scenarios = [
  {
    name: 'CAIXA SBPE SAC',
    input: { bank: 'CAIXA', modality: 'SBPE', birthDate: '1990-05-20', income: 8000, propertyValue: 350000, downPayment: 70000, term: 360, targetInstallment: 0, system: 'SAC', relationship: 'b1', propertyCondition: 'Usado', fgts3y: false, previousSubsidy: 'no', uf: '' },
    municipality: null,
    expected: { program: 'SBPE', financed: 195394.18, installment: 2370.50, term: 360, effectiveRate: 11.29, requiredEntry: 154605.82, quota: 55.83 },
  },
  {
    name: 'CAIXA MCMV Faixa 2',
    input: { bank: 'CAIXA', modality: 'MCMV', birthDate: '1992-11-10', income: 4500, propertyValue: 250000, downPayment: 50000, term: 360, targetInstallment: 0, system: 'SAC', relationship: 'none', propertyCondition: 'Usado', fgts3y: true, previousSubsidy: 'no', uf: 'SP' },
    municipality: { uf: 'SP', name: 'Campinas', limit: campinas[1] },
    expected: { program: 'Faixa 2', financed: 157453.63, installment: 1350, term: 360, effectiveRate: 6.6972, requiredEntry: 92546.37, quota: 62.98 },
  },
  {
    name: 'Bradesco PRICE',
    input: { bank: 'BRADESCO', birthDate: '1985-02-15', income: 12000, propertyValue: 500000, downPayment: 100000, term: 360, targetInstallment: 0, system: 'PRICE', propertyCondition: 'Usado' },
    municipality: null,
    expected: { program: 'Bradesco PRICE', financed: 177684.40, installment: 1800, term: 360, effectiveRate: 11.7, requiredEntry: 322315.60, quota: 35.54 },
  },
];

const closeTo = (actual, expected, message, tolerance = .01) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: esperado ${expected}, recebido ${actual}`);
};

for (const scenario of scenarios) {
  const result = calculateHousingSimulation(scenario.input, scenario.municipality, referenceDate);
  assert.equal(result.program, scenario.expected.program, `${scenario.name}: enquadramento`);
  assert.equal(result.term, scenario.expected.term, `${scenario.name}: prazo`);
  closeTo(result.financed, scenario.expected.financed, `${scenario.name}: financiamento`);
  closeTo(result.installment.total, scenario.expected.installment, `${scenario.name}: parcela`);
  closeTo(result.rate.effective, scenario.expected.effectiveRate, `${scenario.name}: taxa efetiva`, .0001);
  closeTo(result.requiredEntry, scenario.expected.requiredEntry, `${scenario.name}: entrada`);
  closeTo(result.quota, scenario.expected.quota, `${scenario.name}: cota`);
}

const sbpePriceTermLimit = calculateHousingSimulation({
  bank: 'CAIXA', modality: 'SBPE', birthDate: '1990-05-20', income: 15000,
  propertyValue: 500000, downPayment: 100000, term: 420, targetInstallment: 0,
  system: 'PRICE', relationship: 'none', propertyCondition: 'Usado',
  fgts3y: false, previousSubsidy: 'no', uf: '',
}, null, referenceDate);
const termAlert = sbpePriceTermLimit.alerts.find((alert) => alert.message.startsWith('Prazo ajustado'));
assert.equal(sbpePriceTermLimit.maxTerm, 360, 'SBPE PRICE: prazo máximo');
assert.match(termAlert.message, /limite de 360 meses do SBPE PRICE/, 'SBPE PRICE: motivo do ajuste de prazo');
assert.doesNotMatch(termAlert.message, /idade/, 'SBPE PRICE: não atribuir limite do produto à idade');

console.log(`Simulador validado em ${scenarios.length} cenários de referência e no limite de prazo do SBPE PRICE.`);
