import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';

const require = createRequire(import.meta.url);

function executePrisma() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    for (const [stream, destination] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
      stream.on('data', chunk => {
        destination.write(chunk);
        output = (output + chunk.toString()).slice(-32768);
      });
    }
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal, output }));
  });
}

export async function migrateDeploy({ execute = executePrisma, wait = setTimeout, log = console.log } = {}) {
  const delays = [5000, 10000, 20000];
  for (let attempt = 0; ; attempt++) {
    const result = await execute();
    if (result.code === 0) return 0;
    const lockTimeout = /\bP1002\b/.test(result.output) && /Timed out trying to acquire a postgres advisory lock/i.test(result.output);
    if (!lockTimeout || result.signal || attempt >= delays.length) return result.code || 1;
    log(`[MIGRATE] Outra sessão está usando o bloqueio de migração. Nova tentativa ${attempt + 2}/4 em ${delays[attempt] / 1000}s.`);
    await wait(delays[attempt]);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await migrateDeploy(); }
  catch (error) {
    console.error('[MIGRATE] Não foi possível executar o Prisma:', error.code || error.name);
    process.exitCode = 1;
  }
}
