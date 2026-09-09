export function normalizeStreetQuery(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
    .replace(/^(?:r|rua|av|avenida|trav|travessa|al|alameda|rod|rodovia)\s+/, '');
}

export function matchStreetSuggestions(catalog, query, city, limit = 8) {
  const key = normalizeStreetQuery(query);
  if (key.length < 2) return [];
  const tokens = key.split(' ');
  return catalog.filter(street => (!city || street.cities.includes(city)) && tokens.every(token => street.key.includes(token)))
    .sort((a, b) => Number(b.key.startsWith(key)) - Number(a.key.startsWith(key)) || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, limit);
}
