import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import { parsePropertyImport } from '../api/propertyImporter.js';

const prisma = new PrismaClient();
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.resolve(scriptDirectory, '..', 'exports');
const outputPath = path.join(outputDirectory, 'imoveis-motive-final.csv');

const properties = await prisma.property.findMany({ orderBy: { id: 'asc' } });

const rows = properties.map(property => ({
  Codigo: property.code || '',
  Nome: property.title,
  Descricao: property.description || '',
  Endereco: property.address,
  Cidade: property.city || '',
  Bairro: property.neighborhood || '',
  Tipo: property.propertyType || '',
  Condicao: property.condition || '',
  Status: property.status,
  Valor: property.price ?? '',
  Area: property.area ?? '',
  Terreno: property.landArea ?? '',
  Dormitorios: property.bedrooms ?? '',
  Suites: property.suites ?? '',
  Banheiros: property.bathrooms ?? '',
  Vagas: property.parkingSpaces ?? '',
  Foto: property.photoUrl || '',
  Site: property.sourceUrl || '',
  Captador: property.captador || '',
  Favorito: property.isFavorite ? 'Sim' : 'Nao',
  Latitude: property.latitude ?? '',
  Longitude: property.longitude ?? '',
}));

fs.mkdirSync(outputDirectory, { recursive: true });
const worksheet = XLSX.utils.json_to_sheet(rows);
const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });
fs.writeFileSync(outputPath, `\uFEFF${csv}`, 'utf8');

const importedProperties = parsePropertyImport(csv, 'csv');
const validation = {
  count: importedProperties.length,
  favorites: importedProperties.filter(property => property.isFavorite).length,
  withCoordinates: importedProperties.filter(property => Number.isFinite(property.latitude) && Number.isFinite(property.longitude)).length,
  codesUnique: new Set(importedProperties.map(property => property.code).filter(Boolean)).size,
};
if (
  validation.count !== properties.length
  || validation.favorites !== properties.filter(property => property.isFavorite).length
  || validation.withCoordinates !== properties.length
  || validation.codesUnique !== properties.length
) {
  throw new Error(`A validação do arquivo exportado falhou: ${JSON.stringify(validation)}`);
}

console.log(JSON.stringify({
  outputPath,
  count: properties.length,
  favorites: properties.filter(property => property.isFavorite).length,
  withSite: properties.filter(property => property.sourceUrl?.includes('motiveimoveis.com')).length,
  withPhoto: properties.filter(property => property.photoUrl).length,
  withCoordinates: properties.filter(property => Number.isFinite(property.latitude) && Number.isFinite(property.longitude)).length,
  codesUnique: new Set(properties.map(property => property.code).filter(Boolean)).size,
  validation,
}, null, 2));

await prisma.$disconnect();
