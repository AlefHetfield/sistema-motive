import * as XLSX from 'xlsx';
import { DOMParser } from '@xmldom/xmldom';

const MAX_IMPORT_ITEMS = 2000;

const clean = (value, max = 3000) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const cleanMultiline = (value, max = 5000) => String(value ?? '')
  .replace(/\r\n?/g, '\n')
  .replace(/\u0000/g, '')
  .trim()
  .slice(0, max);
const normalizeKey = (value) => clean(value, 100)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const numberValue = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = clean(value, 80).replace(/R\$/gi, '').replace(/\s/g, '');
  if (!text) return null;
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  const result = match ? Number(match[0]) : NaN;
  return Number.isFinite(result) ? result : null;
};

const integerValue = (value) => {
  const parsed = numberValue(value);
  return parsed === null ? null : Math.max(0, Math.round(parsed));
};

const booleanValue = value => ['1', 'sim', 's', 'true', 'yes'].includes(normalizeKey(value));

const priceValue = (value) => {
  const parsed = numberValue(value);
  if (parsed === null) return null;
  return parsed > 0 && parsed < 10000 ? parsed * 1000 : parsed;
};

const propertyTypeValue = value => ({
  casa: 'Casa', apartamento: 'Apartamento', lote: 'Lote', terreno: 'Terreno', sobrado: 'Sobrado', chacara: 'Chácara', comercial: 'Comercial',
})[normalizeKey(value)] || clean(value, 80) || null;

const conditionValue = value => ({
  novo: 'Novo', nova: 'Novo', usado: 'Usado', usada: 'Usado', 'emconstrucao': 'Em construção', reformado: 'Reformado', reformada: 'Reformado',
})[normalizeKey(value)] || clean(value, 80) || null;

const landConfigurationValue = value => ({
  meio: 'Meio', intermediario: 'Intermediário', inteiro: 'Inteiro',
})[normalizeKey(value)] || null;

const floorValue = value => {
  if (['terreo', 'térreo'].includes(clean(value, 40).toLocaleLowerCase('pt-BR'))) return 0;
  return integerValue(value);
};

const valueFrom = (record, aliases) => {
  const normalized = Object.fromEntries(Object.entries(record).map(([key, value]) => [normalizeKey(key), value]));
  for (const alias of aliases) {
    const value = normalized[normalizeKey(alias)];
    if (value !== undefined && clean(value)) return value;
  }
  return '';
};

const inferStatus = (record, description) => {
  const explicit = clean(valueFrom(record, ['status', 'situação', 'situacao', 'disponibilidade']), 60);
  if (explicit) return explicit;
  const text = description.toLocaleLowerCase('pt-BR');
  if (text.includes('vendido')) return 'Vendido';
  if (text.includes('reservado')) return 'Reservado';
  if (text.includes('indisponível') || text.includes('indisponivel')) return 'Indisponível';
  return 'Disponível';
};

const extractCoordinates = (record) => {
  const latitude = numberValue(valueFrom(record, ['latitude', 'lat']));
  const longitude = numberValue(valueFrom(record, ['longitude', 'lng', 'lon', 'long']));
  if (latitude !== null && longitude !== null) return { latitude, longitude };
  const wkt = clean(valueFrom(record, ['wkt', 'geometry', 'coordenadas', 'coordinates']), 300);
  const match = wkt.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i)
    || wkt.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(?:\s*,\s*-?\d+(?:\.\d+)?)?\s*$/);
  if (!match) return { latitude: null, longitude: null };
  const first = Number(match[1]);
  const second = Number(match[2]);
  return wkt.toUpperCase().includes('POINT')
    ? { latitude: second, longitude: first }
    : Math.abs(first) <= 90 && Math.abs(second) > 90
      ? { latitude: first, longitude: second }
      : { latitude: second, longitude: first };
};

const extractUrl = (text, imageOnly = false) => {
  const matches = String(text || '').match(/https?:\/\/[^\s<>"']+/gi) || [];
  const cleaned = matches.map(url => url.replace(/&amp;/g, '&').replace(/[),.;]+$/, ''));
  if (!imageOnly) return cleaned[0] || null;
  return cleaned.find(url => /\.(?:jpe?g|png|webp)(?:\?|$)/i.test(url) || /googleusercontent|usercontent\.google|drive\.google|imgs?\.kenlo/i.test(url)) || null;
};

const extractMotiveUrl = (...values) => {
  const text = values.flatMap(value => Array.isArray(value) ? value : [value]).filter(Boolean).join('\n');
  const match = text.match(/https?:\/\/(?:www\.)?motiveimoveis\.com[^\s<>"']*/i)?.[0];
  return match ? match.replace(/&amp;/gi, '&').replace(/[),.;]+$/, '') : null;
};

const motiveReferenceFromUrl = (value) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!['motiveimoveis.com', 'www.motiveimoveis.com'].includes(url.hostname.toLowerCase())) return null;
    const candidate = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) || '').trim();
    if (!candidate || !/\d/.test(candidate) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(candidate)) return null;
    return candidate.toUpperCase().slice(0, 60);
  } catch {
    return null;
  }
};

const extractDriveFolderUrl = (...values) => {
  const text = values.flatMap(value => Array.isArray(value) ? value : [value]).filter(Boolean).join('\n');
  const id = text.match(/https?:\/\/drive\.google\.com\/drive\/folders\/([\w-]+)/i)?.[1]
    || text.match(/https?:\/\/drive\.google\.com\/[^\s<>"]*[?&]id=([\w-]+)/i)?.[1];
  return id ? `https://drive.google.com/drive/folders/${id}` : null;
};

const recordToProperty = (record) => {
  const title = clean(valueFrom(record, ['name', 'nome', 'title', 'título', 'titulo']), 220);
  const description = cleanMultiline(valueFrom(record, ['description', 'descrição', 'descricao', 'observações', 'observacoes']), 5000);
  const coordinates = extractCoordinates(record);
  const address = clean(valueFrom(record, ['address', 'endereço', 'endereco', 'localização', 'localizacao']), 500);
  const titleCode = title.match(/^\s*([A-Za-z]{1,5}[-_]?\d+)\s*[-–]/)?.[1] || '';
  const mediaUrl = valueFrom(record, ['gx_media_links', 'foto principal', 'photo', 'image']);
  const photosUrl = valueFrom(record, ['fotos', 'pasta de fotos']);
  const siteUrl = valueFrom(record, ['site', 'link do imóvel', 'link do imovel']);
  const motiveUrl = extractMotiveUrl(siteUrl, description, Object.values(record));
  const motiveReference = motiveReferenceFromUrl(motiveUrl);
  const driveFolderUrl = extractDriveFolderUrl(photosUrl, description, Object.values(record));
  const propertyType = propertyTypeValue(valueFrom(record, ['tipo', 'type', 'tipo do imóvel', 'tipo do imovel']));
  const terrainOrFloor = valueFrom(record, ['terreno / andar', 'terreno ou andar']);
  return {
    code: motiveReference || clean(valueFrom(record, ['código', 'codigo', 'ref', 'referência', 'referencia']) || titleCode, 60) || null,
    title: title || 'Imóvel importado',
    description: description || null,
    address: address || 'Endereço não informado',
    city: clean(valueFrom(record, ['cidade', 'city']), 120) || null,
    neighborhood: clean(valueFrom(record, ['bairro', 'neighborhood']), 160) || null,
    propertyType,
    condition: conditionValue(valueFrom(record, ['condição', 'condicao', 'condition'])),
    status: inferStatus(record, description),
    price: priceValue(valueFrom(record, ['valor', 'preço', 'preco', 'price'])),
    area: numberValue(valueFrom(record, ['área', 'area', 'área construída', 'area construida'])),
    landArea: numberValue(valueFrom(record, ['terreno', 'área do terreno', 'area do terreno'])),
    landConfiguration: ['Casa', 'Sobrado'].includes(propertyType) ? landConfigurationValue(valueFrom(record, ['configuração do terreno', 'configuracao do terreno']) || terrainOrFloor) : null,
    floor: propertyType === 'Apartamento' ? floorValue(valueFrom(record, ['andar', 'pavimento']) || terrainOrFloor) : null,
    bedrooms: integerValue(valueFrom(record, ['dormitórios', 'dormitorios', 'quartos', 'bedrooms'])),
    suites: integerValue(valueFrom(record, ['suítes', 'suites', 'suite'])),
    bathrooms: integerValue(valueFrom(record, ['banheiros', 'banheiro', 'bathrooms'])),
    parkingSpaces: integerValue(valueFrom(record, ['vagas', 'garagem', 'parking'])),
    photoUrl: extractUrl(mediaUrl, true) || extractUrl(description, true),
    sourceUrl: motiveUrl || extractUrl(siteUrl) || extractUrl(photosUrl) || extractUrl(description),
    driveFolderUrl,
    captador: clean(valueFrom(record, ['captador', 'corretor', 'responsável', 'responsavel']), 160) || null,
    ownerName: clean(valueFrom(record, ['proprietário', 'proprietario', 'nome do proprietário', 'nome do proprietario', 'owner']), 160) || null,
    ownerWhatsapp: clean(valueFrom(record, ['whatsapp', 'telefone do proprietário', 'telefone do proprietario', 'contato do proprietário', 'contato do proprietario']), 40) || null,
    isFavorite: booleanValue(valueFrom(record, ['favorito', 'favorite', 'is favorite', 'isfavorite'])),
    ...coordinates,
  };
};

const textOf = (node, tagName) => clean(node.getElementsByTagName(tagName)[0]?.textContent || '', 10000);
const directTextOf = (node, tagName) => clean(Array.from(node?.childNodes || []).find(child => child.nodeType === 1 && child.localName === tagName)?.textContent || '', 10000);

const placemarkFolder = placemark => {
  let parent = placemark.parentNode;
  while (parent) {
    if (parent.nodeType === 1 && parent.localName === 'Folder') return directTextOf(parent, 'name');
    parent = parent.parentNode;
  }
  return '';
};

const parseKml = (content) => {
  const document = new DOMParser().parseFromString(content, 'application/xml');
  const parserErrors = document.getElementsByTagName('parsererror');
  if (parserErrors.length) throw new Error('O arquivo KML está inválido.');
  return Array.from(document.getElementsByTagName('Placemark')).slice(0, MAX_IMPORT_ITEMS).map(placemark => {
    const rawDescription = textOf(placemark, 'description');
    const record = {
      name: textOf(placemark, 'name'),
      description: rawDescription.replace(/<[^>]+>/g, ' '),
      fotos: extractUrl(rawDescription, true) || '',
      site: extractUrl(rawDescription) || '',
      city: placemarkFolder(placemark),
      coordinates: textOf(placemark, 'coordinates').split(/\s+/)[0],
    };
    for (const data of Array.from(placemark.getElementsByTagName('Data'))) {
      record[data.getAttribute('name') || ''] = textOf(data, 'value');
    }
    for (const data of Array.from(placemark.getElementsByTagName('SimpleData'))) {
      record[data.getAttribute('name') || ''] = clean(data.textContent, 5000);
    }
    return recordToProperty(record);
  });
};

const parseCsv = (content) => {
  const workbook = XLSX.read(content, { type: 'string', raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('O arquivo CSV não possui uma planilha válida.');
  return XLSX.utils.sheet_to_json(sheet, { defval: '' }).slice(0, MAX_IMPORT_ITEMS).map(recordToProperty);
};

export function parsePropertyImport(content, format) {
  const safeContent = String(content || '');
  if (!safeContent.trim()) throw new Error('O arquivo está vazio.');
  const normalizedFormat = String(format || '').toLowerCase();
  const properties = normalizedFormat === 'kml' || safeContent.includes('<kml')
    ? parseKml(safeContent)
    : parseCsv(safeContent);
  if (!properties.length) throw new Error('Nenhum imóvel foi encontrado no arquivo.');
  return properties;
}
