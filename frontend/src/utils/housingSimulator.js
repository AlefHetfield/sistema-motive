import { REGION_BY_UF } from '../data/municipalLimits.js';

const SBPE_RATES = {
  none: { nominal: 10.9259, effective: 11.49, label: 'Sem relacionamento' },
  b1: { nominal: 10.7447, effective: 11.29, label: 'Bonificação 1' },
  b2: { nominal: 10.654, effective: 11.19, label: 'Bonificação 2 / Plus' },
};

const MIP_BANDS = {
  SBPE: [[25, .0093], [30, .0096], [35, .0116], [40, .0154], [45, .0252], [50, .0386], [55, .0676], [60, .1533], [65, .2731], [70, .3259], [75, .4894], [80.5, .5312]],
  MCMV: [[25, .0082], [30, .0085], [35, .0108], [40, .0144], [45, .0244], [50, .0359], [55, .0645], [60, .0764], [65, .1296], [70, .2005], [75, .3729], [80.5, .4566]],
  BRADESCO: [[32, .0144], [35, .0157], [38, .0181], [41, .0224], [44, .0317], [47, .0435], [50, .0587], [53, .0759], [56, .0933], [59, .1126], [62, .1372], [65, .176], [68, .219], [71, .296], [74, .397], [77, .8], [80.5, .922]],
};

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const round4 = (value) => Math.round((value + Number.EPSILON) * 10000) / 10000;

function dateFromISO(value) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function ageOn(birthValue, reference = new Date()) {
  const birth = dateFromISO(birthValue);
  if (!birth) return null;
  let age = reference.getFullYear() - birth.getFullYear();
  if (reference.getMonth() < birth.getMonth() || (reference.getMonth() === birth.getMonth() && reference.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function monthsUntil80y6m(birthValue, reference = new Date()) {
  const birth = dateFromISO(birthValue);
  if (!birth) return 0;
  const limit = new Date(birth.getFullYear() + 80, birth.getMonth() + 6, birth.getDate());
  let months = (limit.getFullYear() - reference.getFullYear()) * 12 + limit.getMonth() - reference.getMonth();
  if (limit.getDate() < reference.getDate()) months -= 1;
  return Math.max(0, months);
}

function mipRate(age, table) {
  if (age == null) return null;
  return MIP_BANDS[table].find(([maxAge]) => age <= maxAge)?.[1] ?? null;
}

function mcmvRate(income, region, cotista, previousSubsidy) {
  const southSoutheastOrCenterWest = !['N', 'NE'].includes(region);
  const noDiscount = previousSubsidy === 'yes' || income > 5000;
  let nominal;
  let effective;

  if (noDiscount) {
    if (income <= 2160) [nominal, effective] = [6.13, 6.3052];
    else if (income <= 2850) [nominal, effective] = [6.06, 6.2312];
    else if (income <= 4000) [nominal, effective] = [6.08, 6.2523];
    else if (income <= 5000) [nominal, effective] = [7, 7.229];
    else if (income <= 9600) [nominal, effective] = [8.16, 8.4722];
    else [nominal, effective] = [10, 10.47];
  } else if (income <= 2160) {
    [nominal, effective] = southSoutheastOrCenterWest ? [4.75, 4.8548] : [4.5, 4.594];
  } else if (income <= 2850) {
    [nominal, effective] = southSoutheastOrCenterWest ? [5, 5.1162] : [4.75, 4.8548];
  } else if (income <= 3200) {
    [nominal, effective] = southSoutheastOrCenterWest ? [5.25, 5.3782] : [5, 5.1162];
  } else if (income <= 3500) {
    [nominal, effective] = southSoutheastOrCenterWest ? [5.5, 5.6408] : [5.25, 5.3782];
  } else if (income <= 4000) {
    [nominal, effective] = [6, 6.1678];
  } else {
    [nominal, effective] = [7, 7.229];
  }

  if (cotista && income <= 9600) {
    nominal -= .5;
    effective = (Math.pow(1 + (nominal / 100) / 12, 12) - 1) * 100;
  }

  return { nominal, effective, label: noDiscount ? 'PMCMV sem desconto' : 'PMCMV com desconto' };
}

function classifyMcmv(income, propertyValue, municipalLimit) {
  if (income <= 0 || propertyValue <= 0) return 'Dados incompletos';
  if (income > 13000 || propertyValue > 600000) return 'Não se enquadra';
  if (income > 9600 || propertyValue > 400000) return 'Classe Média';
  if (income > 5000 || (municipalLimit != null && propertyValue > municipalLimit)) return 'Faixa 3';
  if (municipalLimit == null) return 'Município não informado';
  return income <= 3200 ? 'Faixa 1' : 'Faixa 2';
}

function installment(financed, term, monthlyRate, system, mip, propertyValue, dfiRate, adminFee) {
  const base = system === 'SAC'
    ? financed / term + financed * monthlyRate
    : financed * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -term)));
  const mipValue = financed * (mip / 100);
  const dfiValue = propertyValue * (dfiRate / 100);
  return { base, mip: mipValue, dfi: dfiValue, adminFee, total: base + mipValue + dfiValue + adminFee };
}

function financingByPayment(payment, fixedCharges, term, monthlyRate, system, mip) {
  const available = Math.max(0, payment - fixedCharges);
  const paymentFactor = system === 'SAC'
    ? 1 / term + monthlyRate
    : monthlyRate / (1 - Math.pow(1 + monthlyRate, -term));
  return available / (paymentFactor + mip / 100);
}

function commonResult({ bank, program, system, financed, propertyValue, term, commitment, income, rate, riskRate = rate, parts, requestedFinanced, quota, age, ageTerm, mip, maxTerm, alerts, fatal = false }) {
  return {
    bank,
    program,
    system,
    propertyValue: round2(propertyValue),
    financed: round2(financed),
    requestedFinanced: round2(requestedFinanced),
    requiredEntry: round2(Math.max(0, propertyValue - financed)),
    quota: round2(propertyValue > 0 ? financed / propertyValue * 100 : 0),
    quotaLimit: quota,
    term,
    maxTerm,
    commitment,
    maxPayment: round2(income * commitment),
    rate: { ...rate, nominal: round4(rate.nominal), effective: round4(rate.effective) },
    riskRate: { ...riskRate, nominal: round4(riskRate.nominal), effective: round4(riskRate.effective) },
    age,
    ageTerm,
    mipRate: mip,
    installment: {
      base: round2(parts.base), mip: round2(parts.mip), dfi: round2(parts.dfi), adminFee: round2(parts.adminFee), total: round2(parts.total),
    },
    alerts,
    fatal,
  };
}

function calculateBradesco(data, now) {
  const { birthDate, income, propertyValue, downPayment, term: requestedTerm, targetInstallment, system } = data;
  const age = ageOn(birthDate, now);
  const ageTerm = monthsUntil80y6m(birthDate, now);
  const mip = mipRate(age, 'BRADESCO');
  const maxTerm = Math.min(420, ageTerm);
  const term = Math.max(1, Math.min(requestedTerm || maxTerm, maxTerm));
  const quota = 80;
  const commitment = system === 'SAC' ? .3 : .15;
  const dfiRate = .0055;
  const adminFee = 25;
  const effective = 11.7;
  const monthlyRate = Math.pow(1 + effective / 100, 1 / 12) - 1;
  const rate = { nominal: monthlyRate * 12 * 100, effective, label: 'Taxa Bradesco' };
  const requestedFinanced = Math.max(0, propertyValue - downPayment);
  let financed = Math.min(requestedFinanced, propertyValue * quota / 100);
  const fixedCharges = propertyValue * dfiRate / 100 + adminFee;
  const paymentLimit = income * commitment;
  const firstParts = installment(financed, term, monthlyRate, system, mip || 0, propertyValue, dfiRate, adminFee);
  const incomeConditioned = firstParts.total > paymentLimit;
  if (incomeConditioned) financed = Math.min(financed, financingByPayment(paymentLimit, fixedCharges, term, monthlyRate, system, mip || 0));
  let parts = installment(financed, term, monthlyRate, system, mip || 0, propertyValue, dfiRate, adminFee);
  const targetConditioned = targetInstallment > 0 && parts.total > targetInstallment;
  if (targetConditioned) {
    financed = Math.min(financed, financingByPayment(targetInstallment, fixedCharges, term, monthlyRate, system, mip || 0));
    parts = installment(financed, term, monthlyRate, system, mip || 0, propertyValue, dfiRate, adminFee);
  }
  const alerts = [];
  if (!requestedTerm) alerts.push({ type: 'info', message: `Prazo máximo disponível aplicado: ${term} meses.` });
  else if (requestedTerm > term) {
    const reason = ageTerm < 420 ? 'pela idade' : 'pelo limite de 420 meses do Bradesco';
    alerts.push({ type: 'warning', message: `Prazo ajustado de ${requestedTerm} para ${term} meses ${reason}.` });
  }
  if (requestedFinanced > propertyValue * quota / 100) alerts.push({ type: 'warning', message: 'A entrada foi ajustada ao limite de 80% de financiamento.' });
  if (incomeConditioned) alerts.push({ type: 'warning', message: 'O valor financiado foi limitado pela renda informada.' });
  if (targetConditioned) alerts.push({ type: 'info', message: 'O valor financiado foi ajustado à parcela desejada.' });
  if (mip == null || maxTerm < 1) alerts.push({ type: 'error', message: 'A idade não permite contratação dentro do limite de 80 anos e 6 meses.' });
  if (!alerts.some((alert) => alert.type === 'error' || alert.type === 'warning')) alerts.push({ type: 'success', message: 'Simulação compatível com os parâmetros informados.' });
  return commonResult({ bank: 'BRADESCO', program: `Bradesco ${system}`, system, financed, propertyValue, term, commitment, income, rate, parts, requestedFinanced, quota, age, ageTerm, mip, maxTerm, alerts, fatal: mip == null || maxTerm < 1 });
}

function calculateCaixa(data, municipality, now) {
  const { birthDate, income, propertyValue, downPayment, term: requestedTerm, targetInstallment, system, modality, uf, fgts3y, previousSubsidy, relationship, propertyCondition } = data;
  const age = ageOn(birthDate, now);
  const ageTerm = monthsUntil80y6m(birthDate, now);
  const municipalLimit = municipality?.limit ?? null;
  const region = REGION_BY_UF[uf] || 'SE';
  const program = modality === 'MCMV' ? classifyMcmv(income, propertyValue, municipalLimit) : 'SBPE';
  const isClassMedia = program === 'Classe Média';
  const mcmvRateIncome = isClassMedia ? 9600.01 : (program === 'Faixa 3' && income <= 5000 ? 5000.01 : income);
  const rate = modality === 'SBPE' ? SBPE_RATES[relationship] || SBPE_RATES.none : mcmvRate(mcmvRateIncome, region, fgts3y, previousSubsidy);
  const riskRate = modality === 'SBPE' ? SBPE_RATES.none : rate;
  const quota = modality === 'SBPE'
    ? (system === 'SAC' ? 80 : 70)
    : (isClassMedia && propertyCondition === 'Usado' && ['S', 'SE'].includes(region) ? 60 : 80);
  const maxProgramTerm = modality === 'SBPE' && system === 'PRICE' ? 360 : 420;
  const maxTerm = Math.min(maxProgramTerm, ageTerm);
  const term = Math.max(1, Math.min(requestedTerm || maxTerm, maxTerm));
  const commitment = modality === 'SBPE' ? (system === 'SAC' ? .3 : .25) : .3;
  const minimumFinancing = modality === 'SBPE' || isClassMedia ? 100000 : 50000;
  const dfiRate = modality === 'SBPE' ? .0066 : .0071;
  const adminFee = modality === 'MCMV' && income <= 2850 ? 0 : 25;
  const mip = mipRate(age, modality === 'SBPE' ? 'SBPE' : 'MCMV');
  const requestedFinanced = Math.max(0, propertyValue - downPayment);
  const fatalProgram = modality === 'MCMV' && (!municipality || income > 13000 || propertyValue > 600000 || ['Dados incompletos', 'Não se enquadra', 'Município não informado'].includes(program));
  const alerts = [];

  if (fatalProgram) {
    if (!municipality) alerts.push({ type: 'error', message: 'Informe o estado e o município para simular o MCMV.' });
    if (income > 13000) alerts.push({ type: 'error', message: 'A renda ultrapassa o limite de R$ 13.000 do programa.' });
    if (propertyValue > 600000) alerts.push({ type: 'error', message: 'O imóvel ultrapassa o limite de R$ 600.000 do programa.' });
    const emptyParts = { base: 0, mip: 0, dfi: 0, adminFee: 0, total: 0 };
    return commonResult({ bank: 'CAIXA', program, system, financed: 0, propertyValue, term, commitment, income, rate, riskRate, parts: emptyParts, requestedFinanced, quota, age, ageTerm, mip, maxTerm, alerts, fatal: true });
  }

  let financed = Math.min(requestedFinanced, propertyValue * quota / 100);
  const selectedMonthly = rate.nominal / 100 / 12;
  const riskMonthly = riskRate.nominal / 100 / 12;
  const fixedCharges = propertyValue * dfiRate / 100 + adminFee;
  const riskParts = installment(financed, term, riskMonthly, system, mip || 0, propertyValue, dfiRate, adminFee);
  const incomeConditioned = riskParts.total > income * commitment;
  if (incomeConditioned) financed = Math.min(financed, financingByPayment(income * commitment, fixedCharges, term, riskMonthly, system, mip || 0));
  let parts = installment(financed, term, selectedMonthly, system, mip || 0, propertyValue, dfiRate, adminFee);
  const targetConditioned = targetInstallment > 0 && parts.total > targetInstallment;
  if (targetConditioned) {
    const targetRate = modality === 'SBPE' ? riskMonthly : selectedMonthly;
    financed = Math.min(financed, financingByPayment(targetInstallment, fixedCharges, term, targetRate, system, mip || 0));
    parts = installment(financed, term, selectedMonthly, system, mip || 0, propertyValue, dfiRate, adminFee);
  }

  if (!requestedTerm) alerts.push({ type: 'info', message: `Prazo máximo disponível aplicado: ${term} meses.` });
  else if (requestedTerm > term) {
    const productLabel = modality === 'SBPE' && system === 'PRICE' ? 'do SBPE PRICE' : `da modalidade ${modality}`;
    const reason = ageTerm < maxProgramTerm ? 'pela idade' : `pelo limite de ${maxProgramTerm} meses ${productLabel}`;
    alerts.push({ type: 'warning', message: `Prazo ajustado de ${requestedTerm} para ${term} meses ${reason}.` });
  }
  if (requestedFinanced > propertyValue * quota / 100) alerts.push({ type: 'warning', message: `A entrada foi ajustada ao limite de ${quota}% de financiamento.` });
  if (financed < minimumFinancing) alerts.push({ type: 'warning', message: `O financiamento mínimo desta modalidade é de R$ ${minimumFinancing.toLocaleString('pt-BR')}.` });
  if (modality === 'SBPE' && relationship !== 'none' && financed < 150000) alerts.push({ type: 'warning', message: 'A bonificação selecionada exige financiamento mínimo de R$ 150.000.' });
  if (incomeConditioned) alerts.push({ type: 'warning', message: 'O valor financiado foi limitado pela renda informada.' });
  if (targetConditioned) alerts.push({ type: 'info', message: 'O valor financiado foi ajustado à parcela desejada.' });
  if (mip == null || maxTerm < 1) alerts.push({ type: 'error', message: 'A idade não permite contratação dentro do limite de 80 anos e 6 meses.' });
  if (modality === 'MCMV' && municipality && municipalLimit != null) {
    alerts.push({ type: propertyValue > municipalLimit ? 'info' : 'success', message: propertyValue > municipalLimit ? `O imóvel ultrapassa o teto municipal de R$ ${municipalLimit.toLocaleString('pt-BR')} e foi enquadrado na Faixa 3.` : `Teto municipal aplicado: R$ ${municipalLimit.toLocaleString('pt-BR')}.` });
  }
  if (!alerts.some((alert) => alert.type === 'error' || alert.type === 'warning')) alerts.unshift({ type: 'success', message: 'Simulação compatível com os parâmetros informados.' });

  return commonResult({ bank: 'CAIXA', program, system, financed, propertyValue, term, commitment, income, rate, riskRate, parts, requestedFinanced, quota, age, ageTerm, mip, maxTerm, alerts, fatal: mip == null || maxTerm < 1 });
}

export function calculateHousingSimulation(input, municipality = null, now = new Date()) {
  const data = {
    ...input,
    income: Number(input.income) || 0,
    propertyValue: Number(input.propertyValue) || 0,
    downPayment: Number(input.downPayment) || 0,
    term: Number(input.term) || 0,
    targetInstallment: Number(input.targetInstallment) || 0,
  };
  return data.bank === 'BRADESCO' ? calculateBradesco(data, now) : calculateCaixa(data, municipality, now);
}

export { SBPE_RATES };
