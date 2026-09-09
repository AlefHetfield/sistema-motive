import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { createMatriculaSearch, getMatriculaSearch } from '../api/matriculaSearch.js';
import { createMatriculaRouter } from '../api/matriculaRoutes.js';

const columns = ['matricula', 'indicadorFiscal', 'tipoImovel', 'endereco', 'numero', 'lote', 'quadra', 'bairro', 'cidade', 'imovel'];
const fixture = createMatriculaSearch({ columns, records: [
  ['00123', '1.002.003', 'Urbano', 'Avenida São João', '012', '04-A', '01', 'Jardim Azul', 'SUMARÉ', 'Casa'],
  ['456', '', 'Urbano', 'Avenida São João', '120', '04-B', '01', 'Jardim Azul', 'Sumaré', 'Casa'],
  ['789', '', 'Urbano', 'Avenida São João', '12', '04-A', '01', 'Jardim Azul', 'Hortolândia', 'Casa'],
  ['0', '', 'Urbano', 'Rua das Flores', '', '', '', '', 'Sumaré', 'Lote'],
] });

test('acentos, abreviações, cidades e filtros combinados preservam identificadores', () => {
  const result = fixture.search({ street: 'Av. sao joao', city: 'sumare', number: '12', lot: '4a', block: '1' });
  assert.equal(result.total, 1);
  assert.equal(result.results[0].matricula, '00123');
  assert.equal(result.results[0].sourceRow, 2);
  assert.equal(fixture.search({ street: 'sao joao', number: '12' }).total, 2);
  assert.equal(fixture.search({ registration: '123' }).results[0].matricula, '00123');
  assert.equal(fixture.search({ fiscal: '1002003' }).total, 1);
});

test('ausência de dados, entrada inválida e busca sem critérios', () => {
  assert.equal(fixture.search({ street: 'flores' }).results[0].matriculaDisponivel, false);
  assert.equal(fixture.search({ street: 'flores', number: '0' }).total, 0);
  assert.equal(fixture.search({ street: 'inexistente' }).total, 0);
  assert.equal(fixture.search({ city: 'sumare' }).needsQuery, true);
  assert.equal(fixture.search({ street: ['a', 'b'] }).needsQuery, true);
  assert.equal(fixture.search({ q: 'JARDIM AZUL', page: '-4' }).page, 1);
});

test('paginação não perde registros nem repete linhas', () => {
  const index = createMatriculaSearch({ columns, records: Array.from({ length: 55 }, (_, i) => [String(i + 1), '', '', 'Rua A', '', '', '', '', '', '']) });
  const results = [1, 2, 3].flatMap(page => index.search({ street: 'Rua A', page: String(page) }).results);
  assert.equal(results.length, 55);
  assert.equal(new Set(results.map(row => row.id)).size, 55);
  assert.equal(index.search({ street: 'Rua A', page: '99999' }).page, 3);
});

test('base real: contagem, registro conhecido e distinção por lote', () => {
  const started = performance.now();
  const index = getMatriculaSearch();
  assert.equal(index.metadata.total, 171239);
  const result = index.search({ street: 'r. jatoba', city: 'sumare', neighborhood: 'basilicata', lot: '04-B', block: '11' });
  assert.ok(result.results.some(row => row.matricula === '226740' && row.numero === 's/nº'));
  assert.ok(!result.results.some(row => row.matricula === '226739'));
  console.log(`Base carregada e consultada em ${Math.round(performance.now() - started)} ms; ${index.metadata.unavailable} registros sem matrícula válida.`);
});

test('API exige autenticação e retorna metadados e páginas', async () => {
  const app = express();
  app.use('/api/matriculas', createMatriculaRouter((req, res, next) => {
    if (req.headers.authorization !== 'test-session') return res.sendStatus(401);
    next();
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/matriculas`;
  try {
    assert.equal((await fetch(base)).status, 401);
    assert.equal((await fetch(`${base}/metadata`)).status, 401);
    const headers = { Authorization: 'test-session' };
    const metadata = await (await fetch(`${base}/metadata`, { headers })).json();
    assert.equal(metadata.total, 171239);
    const response = await fetch(`${base}?registration=226740`, { headers });
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const data = await response.json();
    assert.ok(data.results.some(row => row.endereco === 'Rua Jatobá'));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
