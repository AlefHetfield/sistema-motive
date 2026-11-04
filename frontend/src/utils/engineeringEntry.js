const cents = value => {
  if (value === null || value === undefined || value === '') return null;
  const match = String(value).match(/^(\d{1,13})(?:\.(\d{1,2}))?$/);
  return match ? BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0')) : null;
};

const amount = value => {
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
};

const financingCents = appraisedValue => {
  const appraisal = cents(appraisedValue);
  return appraisal === null ? null : (appraisal * 80n + 50n) / 100n;
};

// Keep the same cent rounding on the form, list and API without floating-point drift.
export function calculateEngineeringFinancing(appraisedValue) {
  const financed = financingCents(appraisedValue);
  return financed === null ? null : amount(financed);
}

export function calculateEngineeringEntry(propertyValue, appraisedValue) {
  const price = cents(propertyValue);
  const financed = financingCents(appraisedValue);
  if (price === null || financed === null) return null;
  const entry = price - financed;
  return amount(entry > 0n ? entry : 0n);
}

export function getEngineeringEntry(item) {
  if (item.valorEntradaManual === null || item.valorEntradaManual === undefined) return calculateEngineeringEntry(item.valorImovel, item.valorAvaliado);
  const manual = cents(item.valorEntradaManual);
  return manual === null ? null : amount(manual);
}
