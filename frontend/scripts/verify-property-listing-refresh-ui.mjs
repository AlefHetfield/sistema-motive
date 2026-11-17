import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<button id="opener">Atualizar Imóveis</button><div id="root"></div>', { url: 'http://localhost:5173/properties-map', pretendToBeVisual: true });
const restored = new Map();
const replacements = {
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  Element: dom.window.Element, HTMLElement: dom.window.HTMLElement,
  Event: dom.window.Event, MouseEvent: dom.window.MouseEvent,
  IS_REACT_ACT_ENVIRONMENT: true,
};
for (const [name, value] of Object.entries(replacements)) {
  restored.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}
const React = await import('react');
const { act, StrictMode } = React;
const { createRoot } = await import('react-dom/client');
const frontend = fileURLToPath(new URL('../', import.meta.url));
const bundlePath = fileURLToPath(new URL(`../.verify-property-refresh-${randomUUID()}.mjs`, import.meta.url));
let root;
let current;
let clock = Date.parse('2026-11-17T18:00:00.000Z');
const timers = new Map();
let timerSequence = 0;
const realDateNow = Date.now;
const timerNames = ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'fetch'];
const savedFunctions = new Map(timerNames.map(name => [name, globalThis[name]]));
let scenario;
const requests = [];
const updatedProperties = [];
const settledJobs = [];
let closed = 0;
const close = () => { closed++; };
const statuses = job => ({ id: 'refresh-1', status: 'running', total: 3, processed: 0, updatedCount: 0, failed: [], pendingCount: 3, nextAttemptAt: null, message: '', retryAttempt: 0, maxAttempts: 3, ...job });
const button = label => [...document.querySelectorAll('button')].find(element => element.textContent.trim() === label);
const flush = async () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const advance = async milliseconds => {
  const target = clock + milliseconds;
  let iterations = 0;
  while (true) {
    const next = [...timers.entries()].filter(([, task]) => task.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
    if (!next) break;
    assert.ok(++iterations < 1000, 'A rotina não pode entrar em um loop de consultas');
    const [id, task] = next;
    clock = task.at;
    if (task.interval) task.at += task.interval;
    else timers.delete(id);
    await act(async () => { task.callback(...task.args); await Promise.resolve(); await Promise.resolve(); });
  }
  clock = target;
  await flush();
};

try {
  const output = await build({
    absWorkingDir: frontend, bundle: true, write: false, format: 'esm', platform: 'node', packages: 'external', jsx: 'automatic',
    stdin: { contents: "export { default as useRefresh } from './src/hooks/usePropertyListingRefresh.js'; export { default as Modal } from './src/components/properties/RefreshListingsModal.jsx';", resolveDir: frontend, loader: 'jsx' },
    plugins: [{ name: 'local-api-only', setup(builder) {
      builder.onResolve({ filter: /\/config\/api$/ }, () => ({ path: 'api-config', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: "export const API_BASE_URL = 'http://fixture.invalid';" }));
    } }],
  });
  await writeFile(bundlePath, output.outputFiles[0].text);
  const { useRefresh, Modal } = await import(pathToFileURL(bundlePath).href);
  Date.now = () => clock;
  globalThis.setTimeout = (callback, delay = 0, ...args) => {
    const id = ++timerSequence; timers.set(id, { callback, args, at: clock + Math.max(0, Number(delay) || 0) }); return id;
  };
  globalThis.setInterval = (callback, delay = 0, ...args) => {
    const id = ++timerSequence; const interval = Math.max(1, Number(delay) || 1); timers.set(id, { callback, args, at: clock + interval, interval }); return id;
  };
  globalThis.clearTimeout = globalThis.clearInterval = id => timers.delete(id);
  globalThis.fetch = async (url, options = {}) => {
    const parsed = new URL(url);
    assert.equal(parsed.hostname, 'fixture.invalid', 'Nenhum site real pode ser acessado pelos testes.');
    assert.equal(options.credentials, 'include');
    const action = options.method === 'POST' ? JSON.parse(options.body).action : 'current';
    const body = options.body ? JSON.parse(options.body) : null;
    const record = { action, body, signal: options.signal };
    requests.push(record);
    assert.ok(options.signal instanceof AbortSignal, 'Todas as requisições podem ser canceladas ao sair da página.');
    const result = await scenario(action, body, options.signal);
    if (options.signal.aborted) throw new DOMException('Cancelado', 'AbortError');
    return new Response(JSON.stringify(result?.payload ?? result), { status: result?.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  };
  function Harness() {
    current = useRefresh({ onUpdated: items => updatedProperties.push(...items), onSettled: (job, notify) => settledJobs.push({ job, notify }) });
    return React.createElement(Modal, { total: 3, ...current, onClose: close, onStart: current.start, onResume: current.resume, onCancel: current.cancel, onRetry: current.refresh });
  }
  const mount = async handler => {
    if (root) await act(async () => root.unmount());
    scenario = handler;
    requests.length = 0; updatedProperties.length = 0; settledJobs.length = 0;
    document.getElementById('opener').focus();
    root = createRoot(document.getElementById('root'));
    await act(async () => root.render(React.createElement(StrictMode, null, React.createElement(Harness))));
    await flush();
  };
  const click = async label => {
    assert.ok(button(label), `O botão ${label} deve estar disponível.`);
    await act(async () => button(label).click());
    await flush();
  };

  let step = 0;
  await mount(async action => {
    if (action === 'current') return { job: null };
    if (action === 'start') return { job: statuses({}) };
    assert.equal(action, 'step');
    step++;
    return step === 1
      ? { job: statuses({ status: 'waiting', processed: 1, updatedCount: 1, pendingCount: 2, nextAttemptAt: new Date(clock + 30000).toISOString(), delayReason: 'rate_limit', retryAttempt: 1, message: 'O site limitou as consultas. Seu progresso está salvo.' }), updated: [{ id: 1, price: 310000 }] }
      : { job: statuses({ status: 'completed', processed: 3, updatedCount: 3, pendingCount: 0 }), updated: [{ id: 2 }, { id: 3 }] };
  });
  assert.ok(document.querySelector('[role="dialog"]'));
  assert.equal(document.activeElement.tagName, 'H2', 'O foco inicial deve estar no diálogo.');
  await click('Atualizar todos');
  await advance(500);
  assert.match(document.body.textContent, /Aguardando liberação do site/);
  assert.match(document.body.textContent, /Nova tentativa em 30s/);
  assert.equal(document.querySelector('[role="alert"]'), null, 'O 429 recuperável não deve aparecer como erro.');
  assert.equal(document.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'), '1');
  assert.equal(current.job.failed.length, 0, 'A espera não pode virar imóvel para revisão.');
  assert.equal(current.job.pendingCount, 2);
  assert.equal(updatedProperties[0].price, 310000, 'Sucessos parciais atualizam o mapa.');
  await advance(29999);
  assert.equal(step, 1, 'O cooldown deve ser respeitado sem repetir a consulta.');
  await advance(1);
  assert.equal(step, 2);
  assert.match(document.body.textContent, /Atualização concluída/);
  assert.equal(current.job.updatedCount, 3);
  assert.equal(settledJobs.length, 1, 'A conclusão deve sincronizar a lista uma só vez.');
  assert.equal(settledJobs[0].notify, true);
  assert.ok(requests.filter(item => item.action === 'step').every(item => item.body.jobId === 'refresh-1'));

  await mount(async action => ({ job: statuses({ status: 'paused', processed: 1, updatedCount: 1, pendingCount: 2, nextAttemptAt: new Date(clock + 10000).toISOString(), retryAttempt: 3, message: 'As tentativas foram pausadas.' }) }));
  assert.match(document.body.textContent, /Atualização pausada/);
  assert.doesNotMatch(document.body.textContent, /Processamento concluído/);
  assert.equal(button('Retomar pendentes').disabled, true);
  await advance(10000);
  assert.equal(button('Retomar pendentes').disabled, false);
  assert.equal(requests.filter(item => item.action === 'step').length, 0, 'Esgotar as tentativas não pode criar repetição infinita.');
  scenario = async action => { assert.equal(action, 'resume'); return { job: statuses({ status: 'running', processed: 1, updatedCount: 1, pendingCount: 2, nextAttemptAt: new Date(clock + 2000).toISOString() }) }; };
  await click('Retomar pendentes');
  assert.equal(current.job.processed, 1);
  assert.equal(current.job.pendingCount, 2);
  scenario = async action => { assert.equal(action, 'cancel'); return { job: statuses({ status: 'cancelled', processed: 1, updatedCount: 1, pendingCount: 2, nextAttemptAt: new Date(clock + 10000).toISOString() }) }; };
  await click('Cancelar atualização');
  assert.match(document.body.textContent, /Atualização cancelada/);
  assert.ok(button('Retomar pendentes'), 'O cancelamento deve preservar a opção de retomar a fila.');
  assert.equal(button('Retomar pendentes').disabled, true, 'Cancelar não deve liberar a retomada antes do cooldown.');
  assert.match(document.body.textContent, /Retomada disponível em 10s/, 'O cancelamento deve explicar o prazo de retomada.');
  assert.match(document.querySelector('.sr-only').textContent, /Retomada disponível às \d{2}:\d{2}:\d{2}/, 'O horário de retomada deve estar disponível para leitores de tela sem anunciar cada segundo.');
  await advance(9999);
  assert.equal(button('Retomar pendentes').disabled, true);
  await advance(1);
  assert.equal(button('Retomar pendentes').disabled, false);
  assert.doesNotMatch(document.body.textContent, /Retomada disponível em/, 'O aviso de espera deve desaparecer quando a retomada estiver liberada.');
  assert.equal(requests.filter(item => item.action === 'step').length, 0);

  const review = { id: 2, code: 'CA002', error: 'O anúncio não foi encontrado.' };
  await mount(async () => ({ job: statuses({ status: 'completed', processed: 3, updatedCount: 2, pendingCount: 0, failed: [review] }) }));
  assert.match(document.body.textContent, /Ver 1 imóvel\(is\) para revisão/);
  assert.equal(settledJobs[0].notify, false, 'Restaurar uma conclusão antiga não deve emitir aviso de conclusão novamente.');
  assert.equal(document.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'), '3');

  let restoreCalls = 0;
  await mount(async action => {
    if (action === 'current') { restoreCalls++; return { job: statuses({ status: 'waiting', nextAttemptAt: new Date(clock + 3000).toISOString(), delayReason: 'connection' }) }; }
    throw new Error('Falha de conexão com o servidor.');
  });
  assert.ok(restoreCalls >= 1, 'Ao reabrir, a fila salva deve ser consultada.');
  await advance(3000);
  assert.match(document.querySelector('[role="alert"]').textContent, /Falha de conexão/);
  assert.equal(current.job.pendingCount, 3);
  const afterFailure = requests.length;
  await advance(60000);
  assert.equal(requests.length, afterFailure, 'Falha de rede não pode disparar uma enxurrada de consultas.');
  scenario = async action => { assert.equal(action, 'current'); return { job: statuses({ status: 'paused', pendingCount: 3 }) }; };
  await click('Reconectar');
  assert.equal(document.querySelector('[role="alert"]'), null);
  assert.equal(current.job.pendingCount, 3);

  let releaseStep;
  await mount(async action => action === 'current' ? { job: statuses({}) } : new Promise(resolve => { releaseStep = resolve; }));
  await advance(500);
  assert.equal(current.busy, true);
  await act(async () => { void current.start(); void current.resume(); void current.cancel(); });
  assert.equal(requests.filter(item => item.action !== 'current').length, 1, 'Cliques concorrentes não podem sobrepor requisições.');
  const pending = requests.at(-1);
  await act(async () => root.unmount());
  root = null;
  assert.equal(pending.signal.aborted, true, 'Sair da página deve cancelar a espera pelo resultado.');
  await act(async () => releaseStep({ job: statuses({ status: 'completed', processed: 3, updatedCount: 3, pendingCount: 0 }) }));
  const unmountedRequests = requests.length;
  await advance(60000);
  assert.equal(requests.length, unmountedRequests, 'Nenhum timer pode continuar consultando após desmontar.');
  assert.equal(document.activeElement.id, 'opener', 'Fechar o diálogo deve devolver o foco.');
  assert.equal(timers.size, 0, 'Todos os timers da rotina e do contador devem ser removidos.');
  assert.equal(closed, 0);
  console.log('Atualização de imóveis: espera automática, retomada, cooldown, revisão, rede, persistência restaurada, StrictMode e desmontagem aprovados.');
} finally {
  if (root) await act(async () => root.unmount());
  Date.now = realDateNow;
  for (const [name, value] of savedFunctions) globalThis[name] = value;
  await unlink(bundlePath).catch(() => {});
  dom.window.close();
  for (const [name, descriptor] of restored) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}
