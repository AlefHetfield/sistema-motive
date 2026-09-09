import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';

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
  const indexed = dataset.records.map((row, index) => ({
    row, id: index + 2, street: streetKey(row[3]), city: normalize(row[8]),
    neighborhood: normalize(row[7]), number: identifier(row[4]), lot: identifier(row[5]), block: identifier(row[6]),
    text: normalize(row.join(' ')), registration: identifier(row[0]), fiscal: identifier(row[1]),
  }));
  const cities = [...new Set(indexed.map(item => item.city).filter(city => city && city !== '0'))]
    .map(key => ({ value: key, label: indexed.find(item => item.city === key).row[8] }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  const metadata = {
    total: indexed.length, source: dataset.source, sheet: dataset.sheet, importedAt: dataset.importedAt,
    cities, unavailable: indexed.filter(item => !item.registration || item.registration === '0').length,
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
      const tokens = q.split(' ').filter(Boolean);
      const streetTokens = street.split(' ').filter(Boolean);
      const matches = indexed.filter(item =>
        (!city || item.city === city) &&
        (!street || streetTokens.every(token => item.street.includes(token))) &&
        (!neighborhood || item.neighborhood.includes(neighborhood)) &&
        (!number || item.number === number) && (!lot || item.lot === lot) && (!block || item.block === block) &&
        (!registration || item.registration === registration) && (!fiscal || item.fiscal === fiscal) &&
        (!q || tokens.every(token => item.text.includes(token)))
      );
      const pages = Math.ceil(matches.length / pageSize);
      const currentPage = Math.min(page, pages || 1);
      const suggestions = [...new Set(matches.map(item => item.row[3]).filter(Boolean))].slice(0, 6);
      return {
        total: matches.length, page: currentPage, pages, pageSize, suggestions, needsQuery: false,
        results: matches.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(item => ({
          id: item.id, sourceRow: item.id,
          ...Object.fromEntries(dataset.columns.map((column, index) => [column, item.row[index]])),
          matriculaDisponivel: Boolean(item.registration && item.registration !== '0'),
        })),
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
