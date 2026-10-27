import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost:5173/simulador', pretendToBeVisual: true });
dom.window.scrollTo = () => {};
const descriptors = new Map();
const forbidSideEffect = () => { globalThis.__simulatorSideEffects++; throw Error('Unexpected external action in navigation test'); };
const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true, __simulatorSideEffects: 0, fetch: forbidSideEffect };
for (const [name, value] of Object.entries(globals)) {
  descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}

const frontend = fileURLToPath(new URL('../', import.meta.url));
const bundlePath = fileURLToPath(new URL(`../.verify-simulator-navigation-${randomUUID()}.mjs`, import.meta.url));
let root;
try {
  const output = await build({
    absWorkingDir: frontend, entryPoints: ['src/pages/HousingSimulator.jsx'], bundle: true, write: false,
    platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic',
    plugins: [{ name: 'local-simulator-fixtures', setup(builder) {
      builder.onResolve({ filter: /^react(?:\/.*)?$/ }, args => ({ path: args.path, external: true }));
      builder.onResolve({ filter: /(?:\/housingSimulationPdf|\/SaveSimulationModal|\/FancySelect|\/useMobileLayout)$|^react-router-dom$|^sonner$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => {
        if (path === 'react-router-dom') return { contents: 'export const useLocation=()=>({state:null});' };
        if (path === 'sonner') return { contents: 'export const toast={error(){},success(){}};' };
        if (path.endsWith('/useMobileLayout')) return { contents: 'export default()=>true;' };
        if (path.endsWith('/housingSimulationPdf')) return { contents: 'export const downloadHousingSimulationPdf=()=>{globalThis.__simulatorSideEffects++;throw Error("Unexpected PDF export");};' };
        if (path.endsWith('/SaveSimulationModal')) return { contents: 'export default()=>{globalThis.__simulatorSideEffects++;throw Error("Unexpected save dialog");};' };
        return { contents: 'import React from "react";export default function Select({options=[],value,onChange,ariaLabel,disabled}){return React.createElement("select",{value,disabled,onChange:event=>onChange(event.target.value),"aria-label":ariaLabel},React.createElement("option",{value:""},"Selecione"),options.filter(item=>item.value!=="").map(item=>React.createElement("option",{key:item.value,value:item.value},item.label)));}' };
      });
    } }],
  });
  await writeFile(bundlePath, output.outputFiles[0].text);
  const { default: HousingSimulator } = await import(pathToFileURL(bundlePath).href);
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(HousingSimulator)));

  const steps = () => [...document.querySelectorAll('nav[aria-label="Etapas dos dados da simulação"] button')];
  const current = () => steps().findIndex(item => item.getAttribute('aria-current') === 'step');
  const button = label => [...document.querySelectorAll('button')].find(item => item.textContent.trim() === label);
  const resultTab = () => button('2. Resultado');
  const form = () => document.getElementById('housing-simulator-form');
  const click = async element => {
    assert.ok(element, 'Controle esperado presente');
    await act(async () => element.click());
  };
  const fill = async (placeholder, value) => {
    const input = [...document.querySelectorAll('input')].find(item => item.placeholder === placeholder);
    assert.ok(input, `Campo ${placeholder} presente`);
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  };
  const nativeSubmit = async () => act(async () => form().requestSubmit());
  const assertNoResult = () => assert.equal(resultTab().disabled, true, 'Avançar etapas não deve gerar resultado');
  const fillClient = async () => { await fill('DD/MM/AAAA', '20051990'); await fill('8.000,00', '800000'); };

  assert.equal(current(), 0);
  assert.deepEqual(steps().map(item => item.disabled), [false, true, true]);
  await click(steps()[2]);
  assert.equal(current(), 0, 'Financiamento não abre antes dos dados anteriores');
  await click(button('Continuar'));
  assert.equal(current(), 0, 'Dados obrigatórios bloqueiam avanço');
  assert.match(form().textContent, /data de nascimento válida e a renda familiar para continuar/);
  await fillClient();
  await click(button('Continuar'));
  assert.equal(current(), 1);
  assertNoResult();
  await click(button('Continuar'));
  assert.equal(current(), 1, 'Valor do imóvel é obrigatório');
  await fill('350.000,00', '35000000');
  const advanceButton = button('Continuar');
  await click(advanceButton);
  assert.equal(current(), 2);
  assert.notEqual(advanceButton, button('Calcular'), 'O botão Continuar não pode se transformar no submit durante o mesmo clique');
  assertNoResult();

  await click(button('Voltar'));
  assert.equal(current(), 1);
  assert.equal(document.querySelector('input[placeholder="350.000,00"]').value, '350.000,00');
  await click(steps()[0]);
  assert.equal(current(), 0);
  assert.equal(document.querySelector('input[placeholder="8.000,00"]').value, '8.000,00');
  await click(button('Continuar'));
  await click(button('Continuar'));
  assert.equal(current(), 2);
  assertNoResult();
  await click(button('Calcular'));
  assert.equal(resultTab().disabled, false, 'Calcular explicitamente gera o resultado');
  assert.equal(resultTab().getAttribute('aria-pressed'), 'true');

  await click([...document.querySelectorAll('button')].find(item => item.textContent.includes('Limpar simulação')));
  assert.equal(current(), 0);
  await nativeSubmit();
  assert.equal(current(), 0, 'Submit nativo também valida a primeira etapa');
  assertNoResult();
  await fillClient();
  await nativeSubmit();
  assert.equal(current(), 1, 'Enter/submit avança apenas uma etapa');
  assertNoResult();
  await nativeSubmit();
  assert.equal(current(), 1, 'Submit nativo valida o valor do imóvel');
  await fill('350.000,00', '35000000');
  await nativeSubmit();
  assert.equal(current(), 2, 'Submit da segunda etapa não calcula antecipadamente');
  assertNoResult();
  await nativeSubmit();
  assert.equal(resultTab().disabled, false, 'Submit explícito na terceira etapa calcula');
  assert.equal(globalThis.__simulatorSideEffects, 0);
  assert.equal(window.localStorage.length, 0, 'Dados sintéticos não são persistidos');
  assert.equal(window.sessionStorage.length, 0);
  console.log('Simulador validado: etapas e validações mobile, avanço sem cálculo automático, submit nativo seguro, retorno com dados preservados e cálculo explícito sem persistência.');
} finally {
  if (root) await act(async () => root.unmount());
  await unlink(bundlePath).catch(() => {});
  dom.window.close();
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}
