const lookupError = (status, message) => Object.assign(new Error(message), { status });
const text = value => ['string', 'number'].includes(typeof value) ? String(value).trim() : '';
const normalizeCnpj = value => text(value).toUpperCase().replace(/[.\/\s-]/g, '');

const sources = [
  {
    url: 'https://minhareceita.org/',
    read: data => ({
      ...data,
      cidade: data.municipio,
    }),
  },
  {
    url: 'https://publica.cnpj.ws/cnpj/',
    read: data => ({
      ...data.estabelecimento,
      razao_social: data.razao_social,
      cidade: data.estabelecimento?.cidade?.nome,
      uf: data.estabelecimento?.estado?.sigla,
    }),
  },
];

function companyFields(record, cnpj) {
  const nome = text(record.razao_social) || text(record.nome_fantasia);
  if (!nome || normalizeCnpj(record.cnpj) !== cnpj) return null;

  const street = [text(record.logradouro), text(record.numero)].filter(Boolean).join(', ');
  const cepDigits = text(record.cep).replace(/\D/g, '');
  const cep = typeof record.cep === 'number' && cepDigits ? cepDigits.padStart(8, '0') : cepDigits;
  return {
    nome,
    endereco: [street, text(record.bairro)].filter(Boolean).join(' - '),
    cidade: [text(record.cidade), text(record.uf)].filter(Boolean).join(' / '),
    cep: /^\d{8}$/.test(cep) && cep !== '00000000' ? cep.replace(/^(\d{5})(\d{3})$/, '$1-$2') : '',
  };
}

export async function lookupReceiptCompany(value, request = fetch) {
  const cnpj = normalizeCnpj(value);
  if (typeof value !== 'string' || value.length > 32 || !/^[A-Z0-9]{12}\d{2}$/.test(cnpj)) {
    throw lookupError(400, 'Informe um CNPJ com 14 caracteres. Os dois últimos devem ser números.');
  }

  let notFound = 0;
  for (const source of sources) {
    try {
      const response = await request(source.url + cnpj, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(4500),
        redirect: 'error',
      });
      if (response.status === 404) {
        notFound++;
        continue;
      }
      if (!response.ok) continue;
      const data = await response.json();
      const company = companyFields(source.read(data), cnpj);
      if (company) return company;
    } catch {
      // An unavailable source or invalid response still allows a second lookup.
    }
  }

  if (notFound === sources.length) {
    throw lookupError(404, 'CNPJ não encontrado. Confira o número ou preencha os dados manualmente.');
  }
  throw lookupError(503, 'Consulta de CNPJ indisponível. Tente novamente ou preencha os dados manualmente.');
}
