import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// A separate process enforces the heap budget from startup, including cold load.
// Increasing the server's heap limit would hide this regression rather than fix it.
if (!process.argv.includes('--worker')) {
  const result = spawnSync(process.execPath, ['--max-old-space-size=128', fileURLToPath(import.meta.url), '--worker'], {
    encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `Falha com heap de 128 MiB (${result.signal}):\n${result.stderr}`);
  process.stdout.write(result.stdout);
} else {
  const { getMatriculaSearch } = await import('../api/matriculaSearch.js');
  const start = performance.now();
  const index = getMatriculaSearch();
  assert.equal(index.metadata.total, 171239);
  const queries = [
    [{ street: 'jatoba', city: 'sumare' }, 56],
    [{ q: 'rua' }, 154811],
    [{ number: 's/n' }, 111922],
    [{ registration: '226740' }, 1],
    [{ street: 'inexistente-xyz' }, 0],
  ];
  let peakRss = process.memoryUsage().rss;
  for (let repeat = 0; repeat < 20; repeat++) {
    for (const [query, total] of queries) {
      assert.equal(index.search(query).total, total);
      peakRss = Math.max(peakRss, process.memoryUsage().rss);
    }
  }
  // Include a maximum-length query with many distinct tokens.
  assert.equal(index.search({ q: Array.from({ length: 60 }, (_, i) => String(i)).join(' ').slice(0, 180) }).total, 0);
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
  assert.ok(peakRss < 320 * 1048576, `RSS amostrado excedeu 320 MiB: ${peakRss}`);
  console.log(JSON.stringify({ heapLimitMiB: 128, queries: 101, sampledPeakRssMiB: Math.round(peakRss / 1048576), elapsedMs: Math.round(performance.now() - start) }));
}
