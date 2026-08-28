import express from 'express';
import { parsePropertyImport } from './propertyImporter.js';
import { fetchDriveImage, listDriveFolderImages, normalizeDriveFolderUrl } from './googleDrive.js';

const PROPERTY_STATUSES = ['Disponível', 'Reservado', 'Vendido', 'Indisponível', 'Confirmar disponibilidade'];
const LAND_CONFIGURATIONS = ['Meio', 'Intermediário', 'Inteiro'];
const PROPERTY_REFERENCE_PREFIXES = {
  Casa: 'CA',
  Apartamento: 'AP',
  Lote: 'LT',
  Terreno: 'LT',
  Sobrado: 'SB',
  Chácara: 'CH',
  Comercial: 'CM',
  Outro: 'IM',
};
const MOTIVE_LISTING_HOSTS = new Set(['motiveimoveis.com', 'www.motiveimoveis.com']);
const LISTING_HTML_LIMIT = 2 * 1024 * 1024;
const cleanText = (value, max = 500) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const nullableText = (value, max) => cleanText(value, max) || null;
const cleanMultilineText = (value, max = 5000) => String(value ?? '')
  .replace(/\r\n?/g, '\n')
  .replace(/\u0000/g, '')
  .trim()
  .slice(0, max);
const nullableMultilineText = (value, max) => cleanMultilineText(value, max) || null;

const numberValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).replace(/R\$/gi, '').replace(/\s/g, '');
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const parsed = typeof value === 'number' ? value : Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const integerValue = (value) => {
  const parsed = numberValue(value);
  return parsed === null ? null : Math.max(0, Math.round(parsed));
};

const urlValue = (value) => {
  const text = nullableText(value, 1000);
  if (!text) return null;
  try {
    const url = new URL(text);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
};

const motiveListingUrl = (value) => {
  const normalized = urlValue(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  return url.protocol === 'https:' && MOTIVE_LISTING_HOSTS.has(url.hostname.toLowerCase()) ? url : null;
};

const landConfigurationValue = value => {
  const text = cleanText(value, 40).toLocaleLowerCase('pt-BR');
  return LAND_CONFIGURATIONS.find(item => item.toLocaleLowerCase('pt-BR') === text) || null;
};

const listingReferenceFromUrl = (value) => {
  const url = motiveListingUrl(value);
  if (!url) return null;
  const candidate = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) || '').trim();
  if (!candidate || !/\d/.test(candidate) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(candidate)) return null;
  return candidate.toUpperCase().slice(0, 60);
};

const decodeHtml = value => String(value || '')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));

const metaContent = (html, names) => {
  const wanted = new Set(names.map(name => name.toLowerCase()));
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attributes = {};
    const pattern = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
    let match;
    while ((match = pattern.exec(tag))) attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
    const name = String(attributes.property || attributes.name || '').toLowerCase();
    if (wanted.has(name) && attributes.content) return decodeHtml(attributes.content);
  }
  return null;
};

const jsonTextValue = (html, field) => {
  const match = html.match(new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 'i'));
  if (!match) return null;
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return null;
  }
};

const jsonRangeValue = (html, field) => {
  const match = html.match(new RegExp(`"${field}"\\s*:\\s*\\[\\s*(-?\\d+(?:\\.\\d+)?)`, 'i'));
  return match ? numberValue(match[1]) : null;
};

const listingSchema = (html) => {
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1]);
      const entries = Array.isArray(parsed) ? parsed : parsed?.['@graph'] || [parsed];
      const listing = entries.find(item => String(item?.['@type'] || '').toLowerCase() === 'realestatelisting');
      if (listing) return listing;
    } catch {
      // Alguns anúncios podem conter outros blocos JSON-LD inválidos. Seguimos para os dados da página.
    }
  }
  return {};
};

const propertyTypeFromSite = value => ({
  HOUSE: 'Casa',
  APARTMENT: 'Apartamento',
  RESIDENTIAL_LAND: 'Lote',
  LAND: 'Terreno',
  TWO_STORY_HOUSE: 'Sobrado',
  FARM: 'Chácara',
  COMMERCIAL: 'Comercial',
  COMMERCIAL_PROPERTY: 'Comercial',
})[String(value || '').toUpperCase()] || null;

const listingDetails = (html) => {
  const schema = listingSchema(html);
  const offers = Array.isArray(schema.offers) ? schema.offers[0] : schema.offers;
  const floorSize = typeof schema.floorSize === 'object' ? schema.floorSize?.value : schema.floorSize;
  const embeddedDescription = jsonTextValue(html, 'listing_description');
  return {
    price: numberValue(offers?.price) ?? jsonRangeValue(html, 'sale_price'),
    area: numberValue(floorSize) ?? jsonRangeValue(html, 'usable_floor_area'),
    landArea: jsonRangeValue(html, 'gross_floor_area'),
    bedrooms: integerValue(schema.numberOfRooms) ?? integerValue(jsonRangeValue(html, 'bedrooms')),
    suites: integerValue(jsonRangeValue(html, 'suites')),
    bathrooms: integerValue(jsonRangeValue(html, 'bathrooms')),
    parkingSpaces: integerValue(jsonRangeValue(html, 'garages')),
    neighborhood: nullableText(jsonTextValue(html, 'neighborhood'), 160),
    city: nullableText(schema.address?.addressLocality || jsonTextValue(html, 'city'), 120),
    propertyType: propertyTypeFromSite(jsonTextValue(html, 'property_type')),
    description: nullableMultilineText(embeddedDescription || schema.description, 5000),
    externalReference: nullableText(jsonTextValue(html, 'property_reference'), 60),
  };
};

const listingPreview = async (sourceUrl) => {
  const listingUrl = motiveListingUrl(sourceUrl);
  if (!listingUrl) {
    const error = new Error('Use um link de imóvel do site motiveimoveis.com.');
    error.status = 400;
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(listingUrl, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Motive-Sistema/1.0 (+https://www.motiveimoveis.com)',
      },
    });
    if (!response.ok) throw new Error('O anúncio não respondeu corretamente.');
    if (!motiveListingUrl(response.url)) throw new Error('O anúncio redirecionou para um endereço não permitido.');
    const contentLength = Number(response.headers.get('content-length'));
    if (contentLength > LISTING_HTML_LIMIT) throw new Error('A página do anúncio é maior que o permitido.');
    const html = await response.text();
    if (html.length > LISTING_HTML_LIMIT) throw new Error('A página do anúncio é maior que o permitido.');

    const schema = listingSchema(html);
    const schemaImages = Array.isArray(schema.image) ? schema.image : [schema.image].filter(Boolean);
    const imageValue = metaContent(html, ['og:image', 'og:image:secure_url', 'twitter:image']) || schemaImages[0];
    const property = listingDetails(html);
    property.externalReference = property.externalReference || listingReferenceFromUrl(response.url);
    if (!imageValue && !Object.values(property).some(value => value !== null)) {
      const error = new Error('Não encontrei informações publicadas nesse anúncio.');
      error.status = 422;
      throw error;
    }
    const imageUrl = imageValue ? new URL(imageValue, response.url) : null;
    if (imageUrl && !['http:', 'https:'].includes(imageUrl.protocol)) throw new Error('A foto principal do anúncio possui um endereço inválido.');
    return {
      imageUrl: imageUrl?.toString() || null,
      title: metaContent(html, ['og:title', 'twitter:title']),
      sourceUrl: response.url,
      property,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('O site demorou demais para responder. Tente novamente.');
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const normalizeStatus = (value) => {
  const text = cleanText(value, 80).toLocaleLowerCase('pt-BR');
  return PROPERTY_STATUSES.find(status => status.toLocaleLowerCase('pt-BR') === text) || 'Disponível';
};

const dateValue = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const propertyReferencePrefix = propertyType => PROPERTY_REFERENCE_PREFIXES[cleanText(propertyType, 80)] || 'IM';

const nextPropertyReference = async (prisma, propertyType) => {
  const prefix = propertyReferencePrefix(propertyType);
  const existing = await prisma.property.findMany({
    where: { code: { startsWith: `${prefix}-` } },
    select: { code: true },
  });
  const lastNumber = existing.reduce((highest, property) => {
    const match = property.code?.match(new RegExp(`^${prefix}-(\\d+)$`, 'i'));
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `${prefix}-${String(lastNumber + 1).padStart(3, '0')}`;
};

const automaticPropertyTitle = data => {
  const location = cleanText(data.neighborhood || data.city || 'Imóvel', 160);
  return location;
};

const normalizeProperty = (payload, user, { partial = false } = {}) => {
  const source = payload || {};
  const data = {
    code: nullableText(source.code, 60),
    title: cleanText(source.title, 220),
    description: nullableMultilineText(source.description, 5000),
    additionalInformation: nullableMultilineText(source.additionalInformation, 5000),
    address: cleanText(source.address, 500),
    city: nullableText(source.city, 120),
    neighborhood: nullableText(source.neighborhood, 160),
    propertyType: nullableText(source.propertyType, 80),
    condition: nullableText(source.condition, 80),
    status: normalizeStatus(source.status),
    price: numberValue(source.price),
    area: numberValue(source.area),
    landArea: numberValue(source.landArea),
    landConfiguration: landConfigurationValue(source.landConfiguration),
    floor: integerValue(source.floor),
    bedrooms: integerValue(source.bedrooms),
    suites: integerValue(source.suites),
    bathrooms: integerValue(source.bathrooms),
    parkingSpaces: integerValue(source.parkingSpaces),
    photoUrl: urlValue(source.photoUrl),
    sourceUrl: urlValue(source.sourceUrl),
    driveFolderUrl: normalizeDriveFolderUrl(source.driveFolderUrl),
    driveCoverFileId: nullableText(source.driveCoverFileId, 300),
    captador: nullableText(source.captador, 160),
    ownerName: nullableText(source.ownerName, 160),
    ownerWhatsapp: nullableText(String(source.ownerWhatsapp ?? '').replace(/\D/g, ''), 20),
    latitude: numberValue(source.latitude),
    longitude: numberValue(source.longitude),
    lastAvailabilityCheck: dateValue(source.lastAvailabilityCheck),
  };

  if (!partial) {
    data.isFavorite = source.isFavorite === true;
    data.createdById = user.id;
    data.createdByName = user.nome;
  } else if (typeof source.isFavorite === 'boolean') {
    data.isFavorite = source.isFavorite;
  }
  return data;
};

const validateProperty = (data) => {
  const errors = [];
  if (!data.title) errors.push('Informe o título do imóvel.');
  if (!data.address) errors.push('Informe o endereço do imóvel.');
  for (const field of ['price', 'area', 'landArea', 'floor', 'bedrooms', 'suites', 'bathrooms', 'parkingSpaces']) {
    if (data[field] !== null && data[field] < 0) errors.push('Valores e quantidades não podem ser negativos.');
  }
  if (data.latitude !== null && (data.latitude < -90 || data.latitude > 90)) errors.push('Latitude inválida.');
  if (data.longitude !== null && (data.longitude < -180 || data.longitude > 180)) errors.push('Longitude inválida.');
  return errors;
};

const formatGeocodeMatch = (match, fallbackCoordinates = {}) => {
  const component = (...types) => match.address_components?.find(item => types.some(type => item.types.includes(type)))?.long_name || '';
  const route = component('route');
  const streetNumber = component('street_number');
  return {
    latitude: match.geometry?.location?.lat ?? fallbackCoordinates.latitude,
    longitude: match.geometry?.location?.lng ?? fallbackCoordinates.longitude,
    formattedAddress: match.formatted_address,
    address: [route, streetNumber].filter(Boolean).join(', ') || match.formatted_address,
    neighborhood: component('sublocality_level_1', 'sublocality', 'neighborhood'),
    city: component('administrative_area_level_2', 'locality'),
    state: component('administrative_area_level_1'),
    postalCode: component('postal_code'),
    placeId: match.place_id,
  };
};

const geocodeAddress = async (address) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    const error = new Error('A geocodificação ainda não foi configurada. Informe as coordenadas manualmente ou configure GOOGLE_MAPS_API_KEY.');
    error.status = 503;
    throw error;
  }
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', address);
  url.searchParams.set('region', 'br');
  url.searchParams.set('language', 'pt-BR');
  url.searchParams.set('key', apiKey);
  const response = await fetch(url);
  if (!response.ok) throw new Error('O Google não respondeu à consulta de endereço.');
  const result = await response.json();
  if (result.status !== 'OK' || !result.results?.length) {
    const error = new Error(result.status === 'ZERO_RESULTS' ? 'Endereço não localizado.' : 'Não foi possível localizar o endereço.');
    error.status = 422;
    throw error;
  }
  return formatGeocodeMatch(result.results[0]);
};

const geocodePlaceId = async (placeId) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    const error = new Error('A geocodificação ainda não foi configurada.');
    error.status = 503;
    throw error;
  }
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('language', 'pt-BR');
  url.searchParams.set('region', 'br');
  url.searchParams.set('key', apiKey);
  const response = await fetch(url);
  if (!response.ok) throw new Error('O Google não respondeu à consulta do endereço.');
  const result = await response.json();
  if (result.status !== 'OK' || !result.results?.length) {
    const error = new Error('Não foi possível localizar o endereço selecionado.');
    error.status = 422;
    throw error;
  }
  return formatGeocodeMatch(result.results[0]);
};

const reverseGeocodeCoordinates = async (latitude, longitude) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    const error = new Error('A geocodificação ainda não foi configurada.');
    error.status = 503;
    throw error;
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    const error = new Error('Coordenadas inválidas.');
    error.status = 400;
    throw error;
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('latlng', `${latitude},${longitude}`);
  url.searchParams.set('language', 'pt-BR');
  url.searchParams.set('region', 'br');
  url.searchParams.set('key', apiKey);
  const response = await fetch(url);
  if (!response.ok) throw new Error('O Google não respondeu à consulta das coordenadas.');
  const result = await response.json();
  if (result.status !== 'OK' || !result.results?.length) {
    const error = new Error(result.status === 'ZERO_RESULTS' ? 'Nenhum endereço encontrado nesse ponto.' : 'Não foi possível identificar o endereço.');
    error.status = 422;
    throw error;
  }

  return formatGeocodeMatch(result.results[0], { latitude, longitude });
};

const propertyKey = property => `${cleanText(property.title, 220).toLocaleLowerCase('pt-BR')}|${Number(property.latitude).toFixed(6)}|${Number(property.longitude).toFixed(6)}`;

const enrichPropertyFromListing = (data, listing) => {
  if (!listing) return data;
  if (listing.externalReference) data.code = cleanText(listing.externalReference, 60).toUpperCase();
  const empty = value => value === null || value === undefined || value === '' || value === 0;
  for (const field of ['price', 'area', 'landArea', 'bedrooms', 'suites', 'bathrooms', 'parkingSpaces', 'neighborhood', 'city', 'propertyType', 'description']) {
    const value = listing[field];
    if (empty(data[field]) && !empty(value)) data[field] = value;
  }
  return data;
};

export function createPropertyRouter(prisma, requireAuth) {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    try {
      const search = cleanText(req.query.search, 120);
      const searchDigits = search.replace(/\D/g, '');
      const status = cleanText(req.query.status, 80);
      const city = cleanText(req.query.city, 120);
      const propertyType = cleanText(req.query.propertyType, 80);
      const landConfigurationFilter = cleanText(req.query.landConfiguration, 40);
      const landConfiguration = landConfigurationValue(landConfigurationFilter);
      const floorGroup = cleanText(req.query.floorGroup, 30);
      const suiteFilter = cleanText(req.query.suite, 30);
      const minPrice = numberValue(req.query.minPrice);
      const maxPrice = numberValue(req.query.maxPrice);
      const bedrooms = integerValue(req.query.bedrooms);
      const properties = await prisma.property.findMany({
        where: {
          ...(search ? { OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { address: { contains: search, mode: 'insensitive' } },
            { neighborhood: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { ownerName: { contains: search, mode: 'insensitive' } },
            ...(searchDigits ? [{ ownerWhatsapp: { contains: searchDigits } }] : []),
          ] } : {}),
          ...(status ? { status } : {}),
          ...(city ? { city } : {}),
          ...(propertyType ? { propertyType } : {}),
          ...(landConfiguration ? { landConfiguration } : {}),
          ...(landConfigurationFilter === 'unknown' ? { landConfiguration: null } : {}),
          ...(floorGroup === 'ground' ? { floor: 0 } : {}),
          ...(floorGroup === 'upper' ? { floor: { gte: 1 } } : {}),
          ...(floorGroup === 'unknown' ? { floor: null } : {}),
          ...(suiteFilter === 'yes' ? { suites: { gte: 1 } } : {}),
          ...(suiteFilter === 'no' ? { AND: [{ OR: [{ suites: 0 }, { suites: null }] }] } : {}),
          ...(minPrice !== null || maxPrice !== null ? { price: {
            ...(minPrice !== null ? { gte: minPrice } : {}),
            ...(maxPrice !== null ? { lte: maxPrice } : {}),
          } } : {}),
          ...(bedrooms !== null ? { bedrooms: { gte: bedrooms } } : {}),
        },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        take: 2000,
      });
      res.json(properties);
    } catch (error) {
      console.error('Erro ao buscar imóveis:', error);
      res.status(500).json({ error: 'Não foi possível buscar os imóveis.' });
    }
  });

  router.get('/backup', async (req, res) => {
    if (req.user.role !== 'ADM') return res.status(403).json({ error: 'Apenas administradores podem gerar o backup do mapa.' });
    try {
      const properties = await prisma.property.findMany({ orderBy: { id: 'asc' } });
      const date = new Date().toISOString().slice(0, 10);
      const backup = {
        format: 'sistema-motive-properties-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        count: properties.length,
        properties,
      };
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="backup-mapa-motive-${date}.json"`);
      res.setHeader('X-Property-Count', String(properties.length));
      res.send(`${JSON.stringify(backup, null, 2)}\n`);
    } catch (error) {
      console.error('Erro ao gerar backup dos imóveis:', error);
      res.status(500).json({ error: 'Não foi possível gerar o backup do mapa.' });
    }
  });

  router.get('/next-reference', async (req, res) => {
    try {
      res.json({ code: await nextPropertyReference(prisma, req.query.propertyType) });
    } catch (error) {
      console.error('Erro ao gerar referência do imóvel:', error);
      res.status(500).json({ error: 'Não foi possível gerar a referência do imóvel.' });
    }
  });

  router.get('/drive-image/:fileId', async (req, res) => {
    try {
      const response = await fetchDriveImage(req.params.fileId);
      res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      const contentLength = response.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);
      res.send(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      console.error('Erro ao carregar foto do Drive:', error.message);
      res.status(error.status || 502).json({ error: error.message || 'Não foi possível carregar a foto.' });
    }
  });

  router.get('/:id/drive-photos', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID do imóvel inválido.' });
    try {
      const property = await prisma.property.findUnique({ where: { id }, select: { driveFolderUrl: true } });
      if (!property) return res.status(404).json({ error: 'Imóvel não encontrado.' });
      if (!property.driveFolderUrl) return res.json({ files: [] });
      const files = await listDriveFolderImages(property.driveFolderUrl);
      res.json({ files });
    } catch (error) {
      console.error('Erro ao listar fotos do Drive:', error.message);
      res.status(error.status || 502).json({ error: error.message || 'Não foi possível carregar as fotos do Drive.' });
    }
  });

  router.post('/drive-preview', async (req, res) => {
    try {
      const driveFolderUrl = normalizeDriveFolderUrl(req.body?.driveFolderUrl);
      if (!driveFolderUrl) return res.status(400).json({ error: 'Informe um link válido de pasta do Google Drive.' });
      const files = await listDriveFolderImages(driveFolderUrl);
      res.json({ driveFolderUrl, files });
    } catch (error) {
      console.error('Erro ao consultar pasta do Drive:', error.message);
      res.status(error.status || 502).json({ error: error.message || 'Não foi possível consultar a pasta do Drive.' });
    }
  });

  router.post('/refresh-drive-photos', async (req, res) => {
    const cursor = Math.max(0, integerValue(req.body?.cursor) || 0);
    const limit = Math.min(20, Math.max(1, integerValue(req.body?.limit) || 10));
    try {
      const candidates = await prisma.property.findMany({
        where: { id: { gt: cursor }, driveFolderUrl: { not: null } },
        orderBy: { id: 'asc' },
        take: limit + 1,
      });
      const batch = candidates.slice(0, limit);
      const updated = [];
      const failed = [];
      for (const property of batch) {
        try {
          const files = await listDriveFolderImages(property.driveFolderUrl);
          const saved = await prisma.property.update({
            where: { id: property.id },
            data: { driveCoverFileId: files[0]?.id || null },
          });
          updated.push(saved);
        } catch (error) {
          failed.push({ id: property.id, code: property.code, title: property.title, error: error.message });
        }
      }
      res.json({
        processed: batch.length,
        updated,
        failed,
        nextCursor: batch.at(-1)?.id || cursor,
        hasMore: candidates.length > limit,
      });
    } catch (error) {
      console.error('Erro ao atualizar fotos do Drive:', error.message);
      res.status(500).json({ error: 'Não foi possível atualizar as fotos do Google Drive.' });
    }
  });

  router.post('/geocode', async (req, res) => {
    const address = cleanText(req.body?.address, 500);
    const placeId = cleanText(req.body?.placeId, 300);
    if (!address && !placeId) return res.status(400).json({ error: 'Informe o endereço que deseja localizar.' });
    try {
      res.json(placeId ? await geocodePlaceId(placeId) : await geocodeAddress(address));
    } catch (error) {
      console.error('Erro ao geocodificar endereço:', error.message);
      res.status(error.status || 502).json({ error: error.message || 'Não foi possível localizar o endereço.' });
    }
  });

  router.post('/reverse-geocode', async (req, res) => {
    const latitude = numberValue(req.body?.latitude);
    const longitude = numberValue(req.body?.longitude);
    try {
      res.json(await reverseGeocodeCoordinates(latitude, longitude));
    } catch (error) {
      console.error('Erro ao identificar endereço pelas coordenadas:', error.message);
      res.status(error.status || 502).json({ error: error.message || 'Não foi possível identificar o endereço.' });
    }
  });

  router.post('/site-preview', async (req, res) => {
    try {
      res.json(await listingPreview(req.body?.sourceUrl));
    } catch (error) {
      console.error('Erro ao buscar foto do anúncio:', error.message);
      res.status(error.status || 502).json({ error: error.message || 'Não foi possível buscar a foto do anúncio.' });
    }
  });

  router.post('/refresh-listings', async (req, res) => {
    const cursor = Math.max(0, integerValue(req.body?.cursor) || 0);
    const limit = Math.min(10, Math.max(1, integerValue(req.body?.limit) || 6));
    try {
      const candidates = await prisma.property.findMany({
        where: {
          id: { gt: cursor },
          sourceUrl: { contains: 'motiveimoveis.com', mode: 'insensitive' },
        },
        orderBy: { id: 'asc' },
        take: limit + 1,
      });
      const batch = candidates.slice(0, limit);
      const updated = [];
      const failed = [];

      for (let index = 0; index < batch.length; index += 3) {
        const chunk = batch.slice(index, index + 3);
        const results = await Promise.all(chunk.map(async property => {
          try {
            const preview = await listingPreview(property.sourceUrl);
            const data = {
              sourceUrl: preview.sourceUrl || property.sourceUrl,
              lastAvailabilityCheck: new Date(),
            };
            if (preview.imageUrl) data.photoUrl = preview.imageUrl;
            if (preview.property?.externalReference) data.code = cleanText(preview.property.externalReference, 60).toUpperCase();
            for (const field of ['price', 'area', 'landArea', 'bedrooms', 'suites', 'bathrooms', 'parkingSpaces', 'neighborhood', 'city', 'propertyType', 'description']) {
              const value = preview.property?.[field];
              if (value !== null && value !== undefined && value !== '') data[field] = value;
            }
            data.title = property.title || automaticPropertyTitle({ ...property, ...data });
            return { property: await prisma.property.update({ where: { id: property.id }, data }) };
          } catch (error) {
            console.warn(`Não foi possível atualizar o anúncio do imóvel ${property.code || property.id}:`, error.message);
            return {
              failure: {
                id: property.id,
                code: property.code,
                title: property.title,
                error: error.message || 'O anúncio não respondeu corretamente.',
              },
            };
          }
        }));
        for (const result of results) {
          if (result.property) updated.push(result.property);
          if (result.failure) failed.push(result.failure);
        }
      }

      res.json({
        processed: batch.length,
        updated,
        failed,
        nextCursor: batch.at(-1)?.id || cursor,
        hasMore: candidates.length > limit,
      });
    } catch (error) {
      console.error('Erro ao atualizar anúncios em lote:', error);
      res.status(500).json({ error: 'Não foi possível atualizar os anúncios em lote.' });
    }
  });

  router.post('/import', async (req, res) => {
    try {
      const properties = parsePropertyImport(req.body?.content, req.body?.format);
      const existing = await prisma.property.findMany({
        select: { code: true, title: true, latitude: true, longitude: true },
      });
      const keys = new Set(existing
        .filter(property => property.latitude !== null && property.longitude !== null)
        .map(propertyKey));
      const usedCodes = new Set(existing.map(property => property.code).filter(Boolean));
      const referenceCounters = new Map();
      for (const code of usedCodes) {
        const match = code.match(/^([A-Z]{2})-(\d+)$/i);
        if (match) referenceCounters.set(match[1].toUpperCase(), Math.max(referenceCounters.get(match[1].toUpperCase()) || 0, Number(match[2])));
      }
      const allocateReference = propertyType => {
        const prefix = propertyReferencePrefix(propertyType);
        let next = referenceCounters.get(prefix) || 0;
        let code;
        do {
          next += 1;
          code = `${prefix}-${String(next).padStart(3, '0')}`;
        } while (usedCodes.has(code));
        referenceCounters.set(prefix, next);
        usedCodes.add(code);
        return code;
      };
      const prepared = [];
      let skipped = 0;
      for (const item of properties) {
        const normalized = normalizeProperty(item, req.user);
        const errors = validateProperty(normalized);
        const key = normalized.latitude !== null && normalized.longitude !== null ? propertyKey(normalized) : null;
        const siteReference = listingReferenceFromUrl(normalized.sourceUrl);
        if (errors.length || (key && keys.has(key)) || (siteReference && usedCodes.has(siteReference))) {
          skipped += 1;
          continue;
        }
        const requestedCode = cleanText(normalized.code, 60);
        if (siteReference) {
          normalized.code = siteReference;
          usedCodes.add(siteReference);
        } else if (requestedCode && !usedCodes.has(requestedCode)) {
          normalized.code = requestedCode;
          usedCodes.add(requestedCode);
          const match = requestedCode.match(/^([A-Z]{2})-(\d+)$/i);
          if (match) {
            const prefix = match[1].toUpperCase();
            referenceCounters.set(prefix, Math.max(referenceCounters.get(prefix) || 0, Number(match[2])));
          }
        } else {
          normalized.code = allocateReference(normalized.propertyType);
        }
        if (key) keys.add(key);
        prepared.push(normalized);
      }
      if (prepared.length) await prisma.property.createMany({ data: prepared });
      res.status(201).json({
        imported: prepared.length,
        skipped,
        withoutCoordinates: prepared.filter(property => property.latitude === null || property.longitude === null).length,
      });
    } catch (error) {
      console.error('Erro ao importar imóveis:', error);
      res.status(400).json({ error: error.message || 'Não foi possível importar os imóveis.' });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const data = normalizeProperty(req.body, req.user);
      const siteReference = listingReferenceFromUrl(data.sourceUrl);
      if (siteReference) data.code = siteReference;
      if (motiveListingUrl(data.sourceUrl)) {
        try {
          const preview = await listingPreview(data.sourceUrl);
          if (preview.imageUrl) data.photoUrl = preview.imageUrl;
          enrichPropertyFromListing(data, preview.property);
        } catch (error) {
          console.warn('Cadastro seguirá sem dados automáticos:', error.message);
        }
      }
      data.code = data.code || await nextPropertyReference(prisma, data.propertyType);
      data.title = data.title || automaticPropertyTitle(data);
      const errors = validateProperty(data);
      if (errors.length) return res.status(400).json({ error: errors[0], details: errors });
      if ((data.latitude === null || data.longitude === null) && process.env.GOOGLE_MAPS_API_KEY) {
        const location = await geocodeAddress([data.address, data.neighborhood, data.city].filter(Boolean).join(', '));
        data.latitude = location.latitude;
        data.longitude = location.longitude;
      }
      if (data.driveFolderUrl) {
        try {
          const files = await listDriveFolderImages(data.driveFolderUrl);
          data.driveCoverFileId = files[0]?.id || null;
        } catch (error) {
          console.warn('Cadastro seguirá sem capa do Drive:', error.message);
        }
      }
      const property = await prisma.property.create({ data });
      res.status(201).json(property);
    } catch (error) {
      console.error('Erro ao criar imóvel:', error);
      res.status(500).json({ error: 'Não foi possível cadastrar o imóvel.' });
    }
  });

  router.put('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID do imóvel inválido.' });
    try {
      const existing = await prisma.property.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Imóvel não encontrado.' });
      const data = normalizeProperty(req.body, req.user, { partial: true });
      const siteReference = listingReferenceFromUrl(data.sourceUrl);
      if (siteReference) data.code = siteReference;
      if (data.driveFolderUrl !== existing.driveFolderUrl) data.driveCoverFileId = null;
      if (motiveListingUrl(data.sourceUrl)) {
        try {
          const preview = await listingPreview(data.sourceUrl);
          if (preview.imageUrl) data.photoUrl = preview.imageUrl;
          enrichPropertyFromListing(data, preview.property);
        } catch (error) {
          console.warn('Atualização seguirá sem dados automáticos:', error.message);
        }
      }
      data.title = data.title || existing.title || automaticPropertyTitle({ ...existing, ...data });
      const errors = validateProperty(data);
      if (errors.length) return res.status(400).json({ error: errors[0], details: errors });
      if (data.driveFolderUrl && !data.driveCoverFileId) {
        try {
          const files = await listDriveFolderImages(data.driveFolderUrl);
          data.driveCoverFileId = files[0]?.id || null;
        } catch (error) {
          console.warn('Atualização seguirá sem capa do Drive:', error.message);
        }
      }
      const property = await prisma.property.update({ where: { id }, data });
      res.json(property);
    } catch (error) {
      console.error('Erro ao atualizar imóvel:', error);
      res.status(500).json({ error: 'Não foi possível atualizar o imóvel.' });
    }
  });

  router.patch('/:id/favorite', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID do imóvel inválido.' });
    if (typeof req.body?.isFavorite !== 'boolean') return res.status(400).json({ error: 'Informe se o imóvel deve ser favorito.' });
    try {
      const existing = await prisma.property.findUnique({ where: { id }, select: { id: true } });
      if (!existing) return res.status(404).json({ error: 'Imóvel não encontrado.' });
      const property = await prisma.property.update({ where: { id }, data: { isFavorite: req.body.isFavorite } });
      res.json(property);
    } catch (error) {
      console.error('Erro ao atualizar favorito:', error);
      res.status(500).json({ error: 'Não foi possível atualizar o favorito.' });
    }
  });

  router.delete('/all', async (req, res) => {
    if (req.user.role !== 'ADM') return res.status(403).json({ error: 'Apenas administradores podem limpar o mapa.' });
    if (req.body?.confirmation !== 'LIMPAR MAPA') {
      return res.status(400).json({ error: 'Digite LIMPAR MAPA para confirmar a exclusão.' });
    }
    try {
      const result = await prisma.property.deleteMany();
      res.json({ deleted: result.count });
    } catch (error) {
      console.error('Erro ao limpar o mapa:', error);
      res.status(500).json({ error: 'Não foi possível limpar o mapa.' });
    }
  });

  router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID do imóvel inválido.' });
    try {
      const property = await prisma.property.findUnique({ where: { id } });
      if (!property) return res.status(404).json({ error: 'Imóvel não encontrado.' });
      if (req.user.role !== 'ADM' && property.createdById !== req.user.id) {
        return res.status(403).json({ error: 'Você não pode excluir este imóvel.' });
      }
      await prisma.property.delete({ where: { id } });
      res.status(204).send();
    } catch (error) {
      console.error('Erro ao excluir imóvel:', error);
      res.status(500).json({ error: 'Não foi possível excluir o imóvel.' });
    }
  });

  return router;
}
