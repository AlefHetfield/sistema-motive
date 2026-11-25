import { normalize } from './matriculaSearch.js';

const streetTypes = new Map([
  ['r', 'rua'], ['rua', 'rua'], ['av', 'avenida'], ['avenida', 'avenida'],
  ['trav', 'travessa'], ['travessa', 'travessa'], ['al', 'alameda'], ['alameda', 'alameda'],
  ['rod', 'rodovia'], ['rodovia', 'rodovia'], ['pca', 'praca'], ['praca', 'praca'],
]);

function streetParts(value) {
  const normalized = normalize(value);
  const firstSpace = normalized.indexOf(' ');
  const type = firstSpace > 0 ? streetTypes.get(normalized.slice(0, firstSpace)) : undefined;
  return { type, name: type ? normalized.slice(firstSpace + 1) : normalized };
}

// ViaCEP describes sides and stretches in the complement. An unknown
// qualifier stays ambiguous because it could apply to the house number.
function matchNumber(complement, houseNumber) {
  const qualifier = normalize(complement);
  if (!qualifier) return true;
  const numberMatch = /^\s*(\d{1,9})(?:\s*[a-z])?\s*$/i.exec(houseNumber);
  if (!numberMatch) return null;
  const number = Number(numberMatch[1]);
  const numberedUnit = /^(\d+)(?: (.*))?$/.exec(qualifier);
  if (numberedUnit) {
    const [, unitNumber, detail] = numberedUnit;
    if (number === Number(unitNumber)) return detail ? null : true;
    // Some unit entries also name a secondary entrance.
    return detail?.split(' ').includes(String(number)) ? null : false;
  }
  const side = /\blado (par|impar)\b/.exec(qualifier);
  if (side && number % 2 !== Number(side[1] === 'impar')) return false;
  const stretch = qualifier.replace(/\blado (?:par|impar)\b/, '').trim();
  if (!stretch && side) return true;

  const between = /^de (\d+(?: \d+)?) (?:a|ate) (\d+(?: \d+)?)$/.exec(stretch);
  const from = /^de (\d+(?: \d+)?) ao fim$/.exec(stretch);
  const upTo = /^ate (\d+(?: \d+)?)$/.exec(stretch);
  if (!between && !from && !upTo) return null;

  const bound = value => {
    const numbers = value.split(' ').map(Number);
    return numbers.find(candidate => candidate % 2 === number % 2) ?? numbers[0];
  };
  const minimum = between?.[1] ?? from?.[1];
  const maximum = between?.[2] ?? upTo?.[1];
  return (!minimum || number >= bound(minimum)) && (!maximum || number <= bound(maximum));
}

export function selectProspectPostalCode(results, address) {
  const candidates = new Map();
  const street = streetParts(address.street);
  const city = normalize(address.city);
  const neighborhood = normalize(address.neighborhood);
  for (const result of results) {
    if (result?.uf !== 'SP' || normalize(result.localidade) !== city) continue;
    const candidate = streetParts(result.logradouro);
    if (candidate.name !== street.name || (street.type && candidate.type !== street.type)) continue;
    if (neighborhood && normalize(result.bairro) !== neighborhood) continue;
    if (!/^\d{5}-?\d{3}$/.test(result.cep || '')) continue;
    const matches = matchNumber(result.complemento, address.number);
    if (matches === false) continue;
    const code = result.cep.replace('-', '');
    candidates.set(code, candidates.get(code) === true || matches === true);
  }
  if (candidates.size === 1) {
    const [postalCode, matches] = candidates.entries().next().value;
    if (matches) return { postalCode, status: 'found' };
  }
  return { postalCode: null, status: candidates.size ? 'ambiguous' : 'not_found' };
}

export async function lookupProspectPostalCode(address) {
  const city = encodeURIComponent(address.city);
  const street = encodeURIComponent(address.street);
  const response = await fetch(`https://viacep.com.br/ws/SP/${city}/${street}/json/`, {
    signal: AbortSignal.timeout(5000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error('Consulta de CEP indisponível.');
  const results = await response.json();
  if (!Array.isArray(results)) throw new Error('Resposta inválida da consulta de CEP.');
  return selectProspectPostalCode(results, address);
}
