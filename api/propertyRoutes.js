import express from 'express';
import { parsePropertyImport } from './propertyImporter.js';

const PROPERTY_STATUSES = ['Disponível', 'Reservado', 'Vendido', 'Indisponível', 'Confirmar disponibilidade'];
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
    description: nullableText(embeddedDescription || schema.description, 5000),
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
  const value = Number(data.price) > 0
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(data.price))
    : 'Valor sob consulta';
  return `${location}, ${value}`;
};

const normalizeProperty = (payload, user, { partial = false } = {}) => {
  const source = payload || {};
  const data = {
    code: nullableText(source.code, 60),
    title: cleanText(source.title, 220),
    description: nullableText(source.description, 5000),
    address: cleanText(source.address, 500),
    city: nullableText(source.city, 120),
    neighborhood: nullableText(source.neighborhood, 160),
    propertyType: nullableText(source.propertyType, 80),
    condition: nullableText(source.condition, 80),
    status: normalizeStatus(source.status),
    price: numberValue(source.price),
    area: numberValue(source.area),
    landArea: numberValue(source.landArea),
    bedrooms: integerValue(source.bedrooms),
    suites: integerValue(source.suites),
    bathrooms: integerValue(source.bathrooms),
    parkingSpaces: integerValue(source.parkingSpaces),
    photoUrl: urlValue(source.photoUrl),
    sourceUrl: urlValue(source.sourceUrl),
    captador: nullableText(source.captador, 160),
    latitude: numberValue(source.latitude),
    longitude: numberValue(source.longitude),
    lastAvailabilityCheck: dateValue(source.lastAvailabilityCheck),
  };

  if (!partial) {
    data.createdById = user.id;
    data.createdByName = user.nome;
  }
  return data;
};

const validateProperty = (data) => {
  const errors = [];
  if (!data.title) errors.push('Informe o título do imóvel.');
  if (!data.address) errors.push('Informe o endereço do imóvel.');
  for (const field of ['price', 'area', 'landArea', 'bedrooms', 'suites', 'bathrooms', 'parkingSpaces']) {
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
      const status = cleanText(req.query.status, 80);
      const city = cleanText(req.query.city, 120);
      const propertyType = cleanText(req.query.propertyType, 80);
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
          ] } : {}),
          ...(status ? { status } : {}),
          ...(city ? { city } : {}),
          ...(propertyType ? { propertyType } : {}),
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

  router.get('/next-reference', async (req, res) => {
    try {
      res.json({ code: await nextPropertyReference(prisma, req.query.propertyType) });
    } catch (error) {
      console.error('Erro ao gerar referência do imóvel:', error);
      res.status(500).json({ error: 'Não foi possível gerar a referência do imóvel.' });
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

  router.post('/import', async (req, res) => {
    try {
      const properties = parsePropertyImport(req.body?.content, req.body?.format);
      const existing = await prisma.property.findMany({
        where: { latitude: { not: null }, longitude: { not: null } },
        select: { code: true, title: true, latitude: true, longitude: true },
      });
      const keys = new Set(existing.map(propertyKey));
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
        if (errors.length || (key && keys.has(key))) {
          skipped += 1;
          continue;
        }
        normalized.code = allocateReference(normalized.propertyType);
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
      if (motiveListingUrl(data.sourceUrl)) {
        try {
          const preview = await listingPreview(data.sourceUrl);
          if (!data.photoUrl) data.photoUrl = preview.imageUrl;
          enrichPropertyFromListing(data, preview.property);
        } catch (error) {
          console.warn('Cadastro seguirá sem dados automáticos:', error.message);
        }
      }
      data.code = await nextPropertyReference(prisma, data.propertyType);
      data.title = automaticPropertyTitle(data);
      const errors = validateProperty(data);
      if (errors.length) return res.status(400).json({ error: errors[0], details: errors });
      if ((data.latitude === null || data.longitude === null) && process.env.GOOGLE_MAPS_API_KEY) {
        const location = await geocodeAddress([data.address, data.neighborhood, data.city].filter(Boolean).join(', '));
        data.latitude = location.latitude;
        data.longitude = location.longitude;
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
      if (motiveListingUrl(data.sourceUrl)) {
        try {
          const preview = await listingPreview(data.sourceUrl);
          if (!data.photoUrl) data.photoUrl = preview.imageUrl;
          enrichPropertyFromListing(data, preview.property);
        } catch (error) {
          console.warn('Atualização seguirá sem dados automáticos:', error.message);
        }
      }
      data.title = automaticPropertyTitle(data);
      const errors = validateProperty(data);
      if (errors.length) return res.status(400).json({ error: errors[0], details: errors });
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
