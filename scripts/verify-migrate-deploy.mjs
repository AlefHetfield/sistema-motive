import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrationDatabaseUrl } from './prisma-database-url.mjs';
import { migrateDeploy } from './migrate-deploy.mjs';

test('usa conexão direta do Neon, preservando credenciais, banco e SSL', () => {
  const env = { DATABASE_URL: 'postgresql://user:p%40ss@ep-test-123-pooler.sa-east-1.aws.neon.tech/mydb?sslmode=require&channel_binding=require&pgbouncer=true' };
  const original = env.DATABASE_URL;
  const direct = new URL(migrationDatabaseUrl(env));
  assert.equal(direct.hostname, 'ep-test-123.sa-east-1.aws.neon.tech');
  assert.equal(direct.username, 'user');
  assert.equal(direct.password, 'p%40ss');
  assert.equal(direct.pathname, '/mydb');
  assert.equal(direct.searchParams.get('sslmode'), 'require');
  assert.equal(direct.searchParams.get('channel_binding'), 'require');
  assert.equal(direct.searchParams.has('pgbouncer'), false);
  assert.equal(env.DATABASE_URL, original);
});

test('respeita URLs explícitas e mantém outros provedores e banco local', () => {
  assert.equal(migrationDatabaseUrl({ DIRECT_URL: 'direct', DATABASE_URL_UNPOOLED: 'unpooled', DATABASE_URL: 'runtime' }), 'direct');
  assert.equal(migrationDatabaseUrl({ DATABASE_URL_UNPOOLED: 'unpooled', DATABASE_URL: 'runtime' }), 'unpooled');
  for (const url of ['postgresql://u:p@localhost:5433/motive_local', 'postgresql://u:p@ep-test-pooler.other.example/db', 'postgresql://u:p@ep-test.neon.tech/db']) {
    assert.equal(migrationDatabaseUrl({ DATABASE_URL: url }), url);
  }
  assert.equal(migrationDatabaseUrl({}), undefined);
});

const locked = { code: 1, output: 'Error: P1002\nContext: Timed out trying to acquire a postgres advisory lock (SELECT pg_advisory_lock(72707369)).' };
test('repete apenas timeout de advisory lock e para após sucesso', async () => {
  let attempts = 0;
  const waits = [];
  assert.equal(await migrateDeploy({ execute: async () => ++attempts === 3 ? { code: 0 } : locked, wait: async ms => waits.push(ms), log: () => {} }), 0);
  assert.equal(attempts, 3);
  assert.deepEqual(waits, [5000, 10000]);
});

test('mantém falha após quatro tentativas, sem loop infinito', async () => {
  let attempts = 0;
  const waits = [];
  assert.equal(await migrateDeploy({ execute: async () => { attempts++; return locked; }, wait: async ms => waits.push(ms), log: () => {} }), 1);
  assert.equal(attempts, 4);
  assert.deepEqual(waits, [5000, 10000, 20000]);
});

test('não repete falha SQL, timeout de conexão ou encerramento por sinal', async () => {
  for (const result of [{ code: 1, output: 'P3018 SQL error' }, { code: 1, output: 'P1002 database timed out' }, { ...locked, code: null, signal: 'SIGTERM' }]) {
    let attempts = 0;
    assert.equal(await migrateDeploy({ execute: async () => { attempts++; return result; }, wait: async () => assert.fail('Não deveria repetir'), log: () => {} }), 1);
    assert.equal(attempts, 1);
  }
});
