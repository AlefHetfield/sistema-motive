import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeMatriculaData, encodeMatriculaData } from './matriculaData.js';

export function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function streetKey(value) {
  return normalize(value).replace(/^(?:r|rua|av|avenida|trav|travessa|al|alameda|rod|rodovia)\s+/, '');
}

function identifier(value) {
  return normalize(value).replace(/\s/g, '').replace(/^0+(?=\d)/, '');
}

export function createMatriculaSearch(dataset) {
  const { rows, dictionaries, columns, rowCount } = decodeMatriculaData(dataset.version === 2 ? dataset : encodeMatriculaData(dataset));
  const normalized = dictionaries.map(values => values.map(normalize));
  const keys = dictionaries.map((values, column) =>
    [0, 1, 4, 5, 6].includes(column) ? values.map(identifier) : column === 3 ? values.map(streetKey) : normalized[column]);
  const cityLabels = new Map();
  const streetCatalog = new Map();
  let unavailable = 0;
  for (let row = 0; row < rowCount; row++) {
    const offset = row * 10;
    const cityId = rows[offset + 8];
    const city = keys[8][cityId];
    const streetId = rows[offset + 3];
    const streetName = dictionaries[3][streetId];
    const streetIdentity = normalized[3][streetId];
    if (streetIdentity) {
      let street = streetCatalog.get(streetIdentity);
      if (!street) {
        street = { name: streetName, cities: new Set() };
        streetCatalog.set(streetIdentity, street);
      }
      street.cities.add(city);
    }
    if (city && city !== '0' && !cityLabels.has(city)) cityLabels.set(city, dictionaries[8][cityId]);
    const registration = keys[0][rows[offset]];
    if (!registration || registration === '0') unavailable++;
  }
  const cities = [...cityLabels].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  const metadata = {
    total: rowCount, source: dataset.source, sheet: dataset.sheet, importedAt: dataset.importedAt,
    cities, unavailable,
    streets: [...streetCatalog.values()].map(street => ({ name: street.name, cities: [...street.cities] }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  };

  return {
    metadata,
    search(params = {}) {
      const get = key => typeof params[key] === 'string' ? params[key].trim().slice(0, 180) : '';
      const q = normalize(get('q'));
      const street = streetKey(get('street'));
      const neighborhood = normalize(get('neighborhood'));
      const city = normalize(get('city'));
      const number = identifier(get('number'));
      const lot = identifier(get('lot'));
      const block = identifier(get('block'));
      const registration = identifier(get('registration'));
      const fiscal = identifier(get('fiscal'));
      const page = Math.min(100000, Math.max(1, Number.parseInt(get('page'), 10) || 1));
      const pageSize = 24;
      const active = Boolean(q || street || neighborhood || number || lot || block || registration || fiscal);
      if (!active) return { results: [], total: 0, page: 1, pages: 0, pageSize, suggestions: [], needsQuery: true };
      const tokens = [...new Set(q.split(' ').filter(Boolean))];
      const streetTokens = street.split(' ').filter(Boolean);
      // Evaluate filters once per distinct field, then scan integer references.
      // Free-text tokens may match different columns, just as in the original search.
      const filters = [[8, city], [4, number], [5, lot], [6, block], [0, registration], [1, fiscal]]
        .filter(([, value]) => value)
        .map(([column, value]) => [column, Uint8Array.from(keys[column], key => key === value)]);
      if (street) filters.push([3, Uint8Array.from(keys[3], key => streetTokens.every(token => key.includes(token)))]);
      if (neighborhood) filters.push([7, Uint8Array.from(keys[7], key => key.includes(neighborhood))]);
      const textMatches = tokens.map(token => normalized.map(values => Uint8Array.from(values, value => value.includes(token))));
      const matches = [];
      const suggestedStreets = new Set();
      scan: for (let row = 0; row < rowCount; row++) {
        const offset = row * 10;
        for (let filter = 0; filter < filters.length; filter++) {
          const [column, accepted] = filters[filter];
          if (!accepted[rows[offset + column]]) continue scan;
        }
        for (let token = 0; token < textMatches.length; token++) {
          let found = false;
          for (let column = 0; column < 10; column++) {
            if (textMatches[token][column][rows[offset + column]]) { found = true; break; }
          }
          if (!found) continue scan;
        }
        matches.push(row);
        const address = dictionaries[3][rows[offset + 3]];
        if (suggestedStreets.size < 6 && address) suggestedStreets.add(address);
      }
      const pages = Math.ceil(matches.length / pageSize);
      const currentPage = Math.min(page, pages || 1);
      const suggestions = [...suggestedStreets];
      return {
        total: matches.length, page: currentPage, pages, pageSize, suggestions, needsQuery: false,
        results: matches.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(row => {
          const offset = row * 10;
          const registration = keys[0][rows[offset]];
          return {
            id: row + 2, sourceRow: row + 2,
            ...Object.fromEntries(columns.map((column, index) => [column, dictionaries[index][rows[offset + index]]])),
            matriculaDisponivel: Boolean(registration && registration !== '0'),
          };
        }),
      };
    },
  };
}

let searchIndex;
export function getMatriculaSearch() {
  if (!searchIndex) {
    const bytes = fs.readFileSync(new URL('./data/matriculas.json.gz', import.meta.url));
    searchIndex = createMatriculaSearch(JSON.parse(gunzipSync(bytes).toString('utf8')));
  }
  return searchIndex;
}
