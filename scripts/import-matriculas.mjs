import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import XLSX from 'xlsx';
import { encodeMatriculaData } from '../api/matriculaData.js';

const source = process.argv[2];
if (!source) throw new Error('Uso: node scripts/import-matriculas.mjs caminho/planilha.xlsx');
const bytes = fs.readFileSync(source);
const workbook = XLSX.read(bytes, { type: 'buffer' });
const sheet = workbook.SheetNames[0];
const [header, ...rows] = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1, raw: false, defval: '' });
if (header.length !== 10 || header[0] !== 'Matricula' || header[1] !== 'Indicador Fiscal' || header[8] !== 'Cidade') {
  throw new Error('Formato inesperado: confira as dez colunas da planilha original.');
}
const records = rows.map((row, index) => {
  if (!row[0] || row.length > 10) throw new Error(`Registro inválido na linha ${index + 2}.`);
  return Array.from({ length: 10 }, (_, column) => String(row[column] ?? '').trim());
});
const dataset = {
  source: path.basename(source), sheet, sha256: createHash('sha256').update(bytes).digest('hex'),
  importedAt: new Date().toISOString(),
  columns: ['matricula', 'indicadorFiscal', 'tipoImovel', 'endereco', 'numero', 'lote', 'quadra', 'bairro', 'cidade', 'imovel'],
  records,
};
const destination = fileURLToPath(new URL('../api/data/matriculas.json.gz', import.meta.url));
fs.mkdirSync(path.dirname(destination), { recursive: true });
const compressed = gzipSync(JSON.stringify(encodeMatriculaData(dataset)));
fs.writeFileSync(`${destination}.tmp`, compressed);
fs.renameSync(`${destination}.tmp`, destination);
console.log(`Importados ${records.length} registros (${compressed.length} bytes). SHA-256: ${dataset.sha256}`);
