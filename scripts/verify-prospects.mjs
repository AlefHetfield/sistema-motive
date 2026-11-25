import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { test } from 'node:test';
import express from 'express';
import sharp from 'sharp';
import { prospectData, createProspectRouter } from '../api/prospectRoutes.js';
import { prepareProspectPhoto, MAX_PROSPECT_PHOTO_BYTES } from '../api/prospectPhoto.js';
import { lookupProspectRegistration } from '../api/prospectRegistration.js';
import { selectProspectPostalCode } from '../api/prospectPostalCode.js';
import { createMatriculaSearch } from '../api/matriculaSearch.js';

const address = { street: 'Rua Jatobá', number: '120', city: 'Sumaré', state: 'SP' };
const columns = ['matricula', 'indicadorFiscal', 'tipoImovel', 'endereco', 'numero', 'lote', 'quadra', 'bairro', 'cidade', 'imovel'];
const record = (registration, street = 'RUA JATOBA', number = '120', city = 'Sumaré') => [registration, '123', 'CASA', street, number, '04', '11', 'Jardim Teste', city, ''];
const search = records => createMatriculaSearch({ columns, records, source: 'Teste local', sheet: 'Teste', importedAt: '2026-11-24' });

test('cadastro exige endereço, valida etapa e telefone e recusa campos/operações inesperados', () => {
  assert.deepEqual(prospectData(address, true), address);
  for (const body of [null, [], {}, { ...address, street: ' ' }, { ...address, city: '' }, { ...address, number: { set: '3' } }, { ...address, stage: 'OUTRO' }, { ...address, state: 'ZZ' }, { ...address, createdById: 2 }, { ...address, ownerPhone: 'abc' }, { ...address, notes: 'x'.repeat(4001) }]) {
    assert.throws(() => prospectData(body, true), error => error.status === 400);
  }
  assert.equal(prospectData({ ...address, ownerPhone: '(19) 99999-1111' }, true).ownerPhone, '19999991111');
  assert.throws(() => prospectData({ notes: 'Mudança' }), error => error.status === 409);
  assert.throws(() => prospectData({ ...address, state: 'MG' }, true), error => error.status === 400);
  assert.throws(() => prospectData({ postalCode: '12345-67', version: 1 }), error => error.status === 400);
  assert.equal(prospectData({ ...address, postalCode: '13170-123' }, true).postalCode, '13170123');
});

test('CEP exige rua e cidade exatas e usa número, lado e bairro para escolher sem ambiguidade', () => {
  const row = (cep, properties = {}) => ({
    cep, logradouro: 'Rua Jatobá', bairro: 'Jardim Teste', localidade: 'Sumaré', uf: 'SP', complemento: '', ...properties,
  });
  const resolved = (postalCode) => ({ postalCode, status: 'found' });
  const west = row('13170-321', { complemento: 'até 119/120' });
  const east = row('13170-322', { complemento: 'de 121/122 ao fim' });
  assert.deepEqual(selectProspectPostalCode([west, east], address), resolved('13170321'));
  assert.deepEqual(selectProspectPostalCode([west, east], { ...address, number: '122A' }), resolved('13170322'));
  assert.deepEqual(selectProspectPostalCode([
    row('13170-400', { complemento: 'lado par' }), row('13170-401', { complemento: 'lado ímpar' }),
    row('13170-901', { complemento: '380' }), row('13170-902', { complemento: '500 2 Andar' }),
  ], address), resolved('13170400'));
  assert.deepEqual(selectProspectPostalCode([
    row('13170-400', { complemento: 'lado par' }), row('13170-901', { complemento: '120' }),
  ], address), { postalCode: null, status: 'ambiguous' });
  assert.deepEqual(selectProspectPostalCode([row('13170-321'), row('13170-322')], address), { postalCode: null, status: 'ambiguous' });
  assert.deepEqual(selectProspectPostalCode([row('13170-321', { complemento: 'trecho desconhecido' })], address), { postalCode: null, status: 'ambiguous' });
  assert.deepEqual(selectProspectPostalCode([
    row('13170-321'), row('13170-322', { bairro: 'Outro bairro' }),
  ], { ...address, neighborhood: 'Jardim teste' }), resolved('13170321'));
  assert.deepEqual(selectProspectPostalCode([
    row('13170-321', { logradouro: 'Rua Jatobá do Sul' }), row('13170-322', { localidade: 'Hortolândia' }),
  ], address), { postalCode: null, status: 'not_found' });
  const sameName = [row('13170-201'), row('13170-202', { logradouro: 'Avenida Jatobá' })];
  assert.deepEqual(selectProspectPostalCode(sameName, { ...address, street: 'Av. Jatobá' }), resolved('13170202'));
  assert.deepEqual(selectProspectPostalCode(sameName, { ...address, street: 'Jatobá' }), { postalCode: null, status: 'ambiguous' });
});

test('matrícula automática exige endereço único e exato; ambiguidade, unidade e ausência ficam manuais', () => {
  const index = search([record('12345')]);
  assert.equal(lookupProspectRegistration(index, address).automatic, '12345');
  assert.equal(lookupProspectRegistration(index, { ...address, number: '0120' }).automatic, '12345');
  assert.equal(lookupProspectRegistration(index, { ...address, complement: 'Apto 12' }).automatic, null);
  assert.equal(lookupProspectRegistration(index, { ...address, street: 'Jato' }).automatic, null, 'Nome parcial da rua não autoriza o preenchimento automático.');
  assert.equal(lookupProspectRegistration(search([record('12345'), record('67890')]), address).automatic, null);
  assert.equal(lookupProspectRegistration(search([record('0')]), address).results[0].registration, null);
  assert.equal(lookupProspectRegistration(index, { ...address, city: 'Americana' }).total, 0);
  assert.equal(lookupProspectRegistration(index, { ...address, state: 'MG' }).unsupported, true);
  assert.equal(lookupProspectRegistration(search(Array.from({ length: 30 }, (_, i) => record(String(i + 1)))), address, 2).results.length, 6);
});

test('foto é decodificada, orientada, reduzida e gravada como WebP sem metadados', async () => {
  const original = await sharp(randomBytes(512 * 384 * 3), { raw: { width: 512, height: 384, channels: 3 } }).jpeg({ quality: 75 }).withMetadata({ orientation: 6 }).toBuffer();
  const thumbnail = await prepareProspectPhoto(`data:image/jpeg;base64,${original.toString('base64')}`);
  assert.ok(thumbnail.length <= MAX_PROSPECT_PHOTO_BYTES);
  const metadata = await sharp(thumbnail).metadata();
  assert.equal(metadata.format, 'webp');
  assert.ok(metadata.width <= 960 && metadata.height <= 960);
  assert.ok(metadata.height > metadata.width, 'Orientação EXIF foi aplicada antes de remover os metadados.');
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.icc, undefined);
  assert.equal(await prepareProspectPhoto(null), null);
  for (const value of ['', {}, 'data:image/svg+xml;base64,PHN2Zy8+', 'data:image/webp;base64,QUJDRA==', `data:image/jpeg;base64,${'A'.repeat(350000)}`]) {
    await assert.rejects(prepareProspectPhoto(value), error => error.status === 400);
  }
});

test('API e PostgreSQL locais: cadastro, imagem privada, concorrência, busca, descarte e exclusão com permissão', { skip: process.env.TEST_PROSPECTS_DB !== '1' }, async () => {
  const target = new URL(process.env.DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname)); assert.equal(target.port, '5433'); assert.equal(target.pathname, '/motive_local');
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const userIds = [], ids = [], suffix = randomUUID();
  let server;
  try {
    for (const role of ['ADM', 'ASSISTENTE', 'CORRETOR']) {
      const user = await prisma.user.create({ data: { nome: `QA captação ${suffix}`, email: `qa-prospect-${role}-${suffix}@example.test`, passwordHash: 'test-only', role } });
      userIds.push(user.id);
    }
    const app = express(); app.use(express.json({ limit: '1mb' }));
    app.use('/prospects', createProspectRouter(prisma, (req, res, next) => {
      if (!req.headers['x-qa-user']) return res.status(401).json({ error: 'Não autenticado' });
      req.user = { id: Number(req.headers['x-qa-user']) }; next();
    }, {
      registrationIndex: () => search([record('12345')]),
      postalCodeLookup: address => ({ postalCode: address.number === '120' ? '13170123' : null, status: 'found' }),
    }));
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}/prospects`;
    const request = (path = '', { user = userIds[0], method = 'GET', body } = {}) => fetch(`${base}${path}`, {
      method, headers: { ...(user ? { 'x-qa-user': String(user) } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal((await request('', { user: null })).status, 401);
    const image = await sharp({ create: { width: 1000, height: 750, channels: 3, background: '#315B78' } }).jpeg().toBuffer();
    const createdResponse = await request('', { method: 'POST', user: userIds[2], body: { ...address, notes: suffix, postalCode: '13170-123', photoDataUrl: `data:image/jpeg;base64,${image.toString('base64')}` } });
    assert.equal(createdResponse.status, 201);
    let item = await createdResponse.json(); ids.push(item.id);
    assert.equal(item.stage, 'SEARCHING'); assert.equal(item.hasPhoto, true); assert.equal(item.version, 1);
    assert.equal(item.createdById, userIds[2]); assert.equal(Object.hasOwn(item, 'photo'), false);
    assert.equal(item.postalCode, '13170123');
    assert.equal(item.isFavorite, false);
    const cepResponse = await request('/lookup-postal-code', { method: 'POST', body: address });
    assert.equal(cepResponse.status, 200);
    assert.equal((await cepResponse.json()).postalCode, '13170123');
    assert.equal((await request('/lookup-postal-code', { method: 'POST', body: { ...address, state: 'RJ' } })).status, 400);
    assert.equal((await request(`/${item.id}/favorite`, { method: 'PATCH', body: { isFavorite: 'true' } })).status, 400);
    const favorited = await request(`/${item.id}/favorite`, { method: 'PATCH', user: userIds[1], body: { isFavorite: true } });
    assert.equal(favorited.status, 200);
    assert.deepEqual(await favorited.json(), { id: item.id, isFavorite: true });
    const favorites = await (await request(`?q=${suffix}&favorites=1`)).json();
    assert.equal(favorites.items[0].id, item.id);
    assert.equal(favorites.items[0].version, item.version, 'Favoritar não invalida o formulário que outra pessoa está editando.');
    assert.equal((await request(`/${item.id}/favorite`, { method: 'PATCH', body: { isFavorite: false } })).status, 200);
    assert.equal((await (await request(`?q=${suffix}&favorites=1`)).json()).total, 0);
    const storedPhoto = (await prisma.propertyProspect.findUnique({ where: { id: item.id } })).photo;
    assert.ok(storedPhoto.length <= MAX_PROSPECT_PHOTO_BYTES);
    const photo = await request(`/${item.id}/photo`);
    assert.equal(photo.status, 200); assert.match(photo.headers.get('content-type'), /image\/webp/);
    assert.ok(Buffer.from(await photo.arrayBuffer()).equals(Buffer.from(storedPhoto)));
    assert.equal((await request(`/${item.id}/photo`, { user: null })).status, 401);
    const lookup = await (await request('/lookup-registration', { method: 'POST', body: address })).json();
    assert.equal(lookup.automatic, '12345');
    const patches = await Promise.all([
      request(`/${item.id}`, { method: 'PATCH', user: userIds[1], body: { version: item.version, ownerName: 'Proprietário QA', ownerPhone: '19987654321', stage: 'CONTACT_FOUND' } }),
      request(`/${item.id}`, { method: 'PATCH', body: { version: item.version, notes: `${suffix} edição concorrente` } }),
    ]);
    assert.deepEqual(patches.map(response => response.status).sort(), [200, 409]);
    item = await (await request(`/${item.id}`)).json(); assert.equal(item.version, 2);
    assert.ok(Buffer.from((await prisma.propertyProspect.findUnique({ where: { id: item.id } })).photo).equals(Buffer.from(storedPhoto)), 'Editar os campos não altera nem duplica a foto.');
    const listing = await (await request(`?q=${suffix}&stage=all`)).json();
    assert.equal(listing.items.length, 1); assert.equal(Object.hasOwn(listing.items[0], 'photo'), false);
    const fullAddress = await (await request(`?q=${encodeURIComponent('Rua Jatobá, 120 · Sumaré / SP')}`)).json();
    assert.ok(fullAddress.items.some(record => record.id === item.id), 'Buscar o endereço completo funciona com número, cidade e pontuação.');
    const archived = await request(`/${item.id}`, { method: 'PATCH', body: { version: item.version, stage: 'DISCARDED' } });
    assert.equal(archived.status, 200); item = await archived.json();
    assert.equal((await (await request(`?q=${suffix}`)).json()).items.length, 0);
    assert.equal((await (await request(`?q=${suffix}&stage=DISCARDED`)).json()).items.length, 1);
    assert.equal((await request(`/${item.id}`, { method: 'DELETE', user: null, body: { version: item.version } })).status, 401);
    assert.equal((await request(`/${item.id}`, { method: 'DELETE', user: userIds[1], body: { version: item.version } })).status, 403, 'Outro usuário não pode excluir o cadastro do corretor.');
    assert.equal((await request(`/${item.id}/photo`)).status, 200, 'Recusa da exclusão preserva a foto.');
    assert.equal((await request(`/${item.id}`, { method: 'DELETE', body: { version: item.version - 1 } })).status, 409, 'Uma versão antiga não pode excluir uma captação alterada.');
    for (const body of [{}, { version: 0 }, { version: { equals: item.version } }, { version: item.version, createdById: userIds[0] }]) {
      assert.equal((await request(`/${item.id}`, { method: 'DELETE', body })).status, 400);
    }
    assert.equal((await request('/invalid', { method: 'DELETE', body: { version: 1 } })).status, 400);
    for (const user of [userIds[1], userIds[2]]) {
      const ownResponse = await request('', { method: 'POST', user, body: { ...address, notes: suffix, photoDataUrl: `data:image/jpeg;base64,${image.toString('base64')}` } });
      assert.equal(ownResponse.status, 201);
      const own = await ownResponse.json(); ids.push(own.id);
      const removed = await request(`/${own.id}`, { method: 'DELETE', user, body: { version: own.version } });
      assert.equal(removed.status, 204, 'Assistente e corretor podem excluir os próprios cadastros.');
      assert.equal(await removed.text(), '');
      assert.equal(await prisma.propertyProspect.findUnique({ where: { id: own.id } }), null);
      assert.equal((await request(`/${own.id}/photo`)).status, 404, 'Excluir o registro também remove a foto.');
    }
    const restored = await request(`/${item.id}`, { method: 'PATCH', body: { version: item.version, stage: 'SEARCHING', photoDataUrl: null } });
    assert.equal(restored.status, 200); item = await restored.json(); assert.equal(item.hasPhoto, false);
    assert.equal((await request(`/${item.id}/photo`)).status, 404);
    await prisma.user.update({ where: { id: userIds[2] }, data: { isActive: false } });
    assert.equal((await request('', { user: userIds[2] })).status, 401);
    assert.equal((await request(`/${item.id}/photo`, { user: userIds[2] })).status, 401);
    assert.equal((await request(`/${item.id}`, { method: 'DELETE', user: userIds[2], body: { version: item.version } })).status, 401);
    assert.equal((await request(`/${item.id}`, { method: 'PATCH', body: { version: item.version, street: { set: 'inválido' } } })).status, 400);
    assert.equal((await request(`/${item.id}`, { method: 'DELETE', body: { version: item.version } })).status, 204, 'Administrador pode excluir o cadastro de outro usuário.');
    assert.equal((await request(`/${item.id}`)).status, 404);
    assert.equal((await request(`/${item.id}`, { method: 'DELETE', body: { version: item.version } })).status, 404);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await prisma.propertyProspect.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
});
