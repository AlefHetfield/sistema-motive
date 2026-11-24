import { normalize } from './matriculaSearch.js';

const streetKey = value => normalize(value).replace(/^(?:r|rua|av|avenida|trav|travessa|al|alameda|rod|rodovia)\s+/, '');
const identifier = value => normalize(value).replace(/\s/g, '').replace(/^0+(?=\d)/, '');

export function lookupProspectRegistration(searchIndex, address, page = 1) {
  if (address.state !== 'SP') return { results: [], total: 0, page: 1, pages: 0, automatic: null, unsupported: true };
  const result = searchIndex.search({ street: address.street, number: address.number, city: address.city, page: String(page) });
  const results = result.results.map(item => ({
    id: item.id, registration: item.matriculaDisponivel ? item.matricula : null,
    street: item.endereco, number: item.numero, neighborhood: item.bairro, city: item.cidade,
    lot: item.lote, block: item.quadra, fiscal: item.indicadorFiscal,
  }));
  const one = results[0];
  const exact = one && streetKey(one.street) === streetKey(address.street) && identifier(one.number) === identifier(address.number)
    && normalize(one.city) === normalize(address.city);
  // Units/condominiums and partial street names always require a deliberate choice.
  return { results, total: result.total, page: result.page, pages: result.pages, unsupported: false,
    automatic: result.total === 1 && exact && one.registration && !address.complement ? one.registration : null };
}
