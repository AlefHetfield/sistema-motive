import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { MemoryRouter } from 'react-router-dom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost:5173/properties-map' });
const descriptors = new Map();
const scenario = { role: 'ADM', mapMounts: 0, engineeringMounts: 0 };
for (const [name, value] of Object.entries({
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true, __propertiesWorkspaceScenario: scenario,
  fetch: () => { throw new Error('Requisição de rede inesperada no teste.'); },
})) {
  descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}

const frontend = fileURLToPath(new URL('../', import.meta.url));
const bundlePath = fileURLToPath(new URL(`../.verify-properties-workspace-${randomUUID()}.mjs`, import.meta.url));
const fixtures = {
  AuthContext: 'export const useAuth = () => ({ user: { role: globalThis.__propertiesWorkspaceScenario.role } });',
  PrivateRoute: `import React from 'react';
    export default function Guard({ requiredRole, children }) {
      return requiredRole.includes(globalThis.__propertiesWorkspaceScenario.role) ? children : <p role="alert">Acesso negado</p>;
    }`,
  LoadingAnimation: "export default function Loading() { return <p>Carregando…</p>; }",
  PropertiesMap: `import { useEffect, useState } from 'react';
    export default function Map({ active, engineeringRevision, onOpenEngineering, onCreateEngineering }) {
      const [filter, setFilter] = useState('');
      useEffect(() => { globalThis.__propertiesWorkspaceScenario.mapMounts++; }, []);
      return <div data-testid="map" data-active={active}>
        <input aria-label="Filtro do mapa" value={filter} onChange={event => setFilter(event.target.value)} />
        <output data-testid="revision">{engineeringRevision}</output>
        <button onClick={() => onOpenEngineering({ id: 71 })}>Abrir engenharia pelo mapa</button>
        <button onClick={() => onCreateEngineering({ id: 43 })}>Cadastrar engenharia pelo mapa</button>
      </div>;
    }`,
  Engineerings: `import { useEffect, useState } from 'react';
    export default function Engineerings({ active, onChanged }) {
      const [filter, setFilter] = useState('');
      useEffect(() => { globalThis.__propertiesWorkspaceScenario.engineeringMounts++; }, []);
      return <div data-testid="engineerings" data-active={active}>
        <input aria-label="Filtro de engenharias" value={filter} onChange={event => setFilter(event.target.value)} />
        <button onClick={onChanged}>Salvar engenharia de teste</button>
      </div>;
    }`,
};
let root;
try {
  const result = await build({
    absWorkingDir: frontend, bundle: true, write: false, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic',
    stdin: { resolveDir: frontend, contents: `
      import PropertiesWorkspace from './src/pages/PropertiesWorkspace.jsx';
      import { useLocation, useNavigate } from 'react-router-dom';
      export default function Harness() {
        const location = useLocation();
        const navigate = useNavigate();
        return <><PropertiesWorkspace /><output data-testid="url">{location.pathname + location.search}</output><button onClick={() => navigate(-1)}>Voltar no histórico</button></>;
      }`, loader: 'jsx' },
    plugins: [{ name: 'workspace-fixtures', setup(builder) {
      builder.onResolve({ filter: /^react(?:\/.*)?$/ }, args => ({ path: args.path, external: true }));
      builder.onResolve({ filter: /\/(AuthContext|PrivateRoute|LoadingAnimation|PropertiesMap|Engineerings)$/ }, args => ({ path: args.path.split('/').at(-1), namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: fixtures[args.path], loader: 'jsx' }));
    } }],
  });
  await writeFile(bundlePath, result.outputFiles[0].text);
  const { default: Harness } = await import(pathToFileURL(bundlePath).href);
  const { createRoot } = await import('react-dom/client');
  const element = id => document.querySelector(`[data-testid="${id}"]`);
  const link = label => [...document.querySelectorAll('nav a')].find(node => node.textContent === label);
  const button = label => [...document.querySelectorAll('button')].find(node => node.textContent === label);
  const click = async node => { assert.ok(node, 'Controle esperado está presente'); await act(async () => node.click()); };
  const fill = async (label, value) => {
    const input = document.querySelector(`input[aria-label="${label}"]`);
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    return input;
  };
  const mount = async (role, url = '/properties-map') => {
    if (root) await act(async () => root.unmount());
    Object.assign(scenario, { role, mapMounts: 0, engineeringMounts: 0 });
    root = createRoot(document.getElementById('root'));
    await act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: [url] }, React.createElement(Harness))));
  };

  await mount('ADM');
  assert.equal(scenario.mapMounts, 1);
  assert.equal(scenario.engineeringMounts, 0, 'Engenharias carrega somente após acessar a aba');
  const originalMap = element('map');
  const mapFilter = await fill('Filtro do mapa', 'SO0040');
  await click(link('Engenharias'));
  assert.equal(element('url').textContent, '/properties-map?tab=engineerings');
  assert.equal(originalMap.closest('section').hidden, true);
  assert.equal(link('Engenharias').getAttribute('aria-current'), 'page');
  const originalEngineerings = element('engineerings');
  const engineeringFilter = await fill('Filtro de engenharias', 'Sumaré');
  await click(button('Salvar engenharia de teste'));
  await click(link('Mapa'));
  assert.equal(element('map'), originalMap, 'Mapa conserva a mesma instância DOM');
  assert.equal(mapFilter.value, 'SO0040');
  assert.equal(element('revision').textContent, '1', 'Salvar solicita atualização do resumo vinculado');
  await click(button('Voltar no histórico'));
  assert.equal(element('engineerings'), originalEngineerings);
  assert.equal(engineeringFilter.value, 'Sumaré');
  assert.equal(scenario.mapMounts, 1, 'Alternar e voltar não remonta o mapa');
  assert.equal(scenario.engineeringMounts, 1, 'Alternar e voltar não remonta Engenharias');
  await click(link('Mapa'));
  await click(button('Abrir engenharia pelo mapa'));
  assert.equal(element('url').textContent, '/properties-map?tab=engineerings&engineering=71');
  await click(link('Mapa'));
  assert.equal(element('url').textContent, '/properties-map', 'Alternar remove o comando de abertura já consumível');
  await click(button('Cadastrar engenharia pelo mapa'));
  assert.equal(element('url').textContent, '/properties-map?tab=engineerings&newProperty=43');

  await mount('ASSISTENTE', '/properties-map?tab=engineerings&engineering=71');
  assert.equal(scenario.engineeringMounts, 1, 'Link direto funciona para assistente');
  assert.equal(scenario.mapMounts, 0, 'Link direto não carrega o mapa antes de sua visita');
  await click(link('Mapa'));
  assert.equal(scenario.mapMounts, 1);
  await mount('CORRETOR');
  assert.equal(link('Engenharias'), undefined, 'Corretor vê apenas Mapa');
  assert.equal(scenario.engineeringMounts, 0);
  await mount('CORRETOR', '/properties-map?tab=engineerings');
  assert.equal(document.querySelector('[role="alert"]').textContent, 'Acesso negado');
  assert.equal(scenario.engineeringMounts, 0, 'URL forçada não monta a área restrita');
  console.log('Área de imóveis validada: navegação, histórico, telas e filtros preservados, carregamento sob demanda, vínculo e permissões.');
} finally {
  if (root) await act(async () => root.unmount());
  await unlink(bundlePath).catch(() => {});
  dom.window.close();
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}
