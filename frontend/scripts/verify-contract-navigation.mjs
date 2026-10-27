import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost:5173/contract-generator', pretendToBeVisual: true });
const descriptors = new Map();
const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, requestAnimationFrame: callback => setTimeout(callback, 0), IS_REACT_ACT_ENVIRONMENT: true, __contractWrites: 0 };
for (const [name, value] of Object.entries(globals)) {
  descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}

const frontend = fileURLToPath(new URL('../', import.meta.url));
const bundlePath = fileURLToPath(new URL(`../.verify-contract-navigation-${randomUUID()}.mjs`, import.meta.url));
let root;
try {
  const output = await build({
    absWorkingDir: frontend, entryPoints: ['src/pages/ContractGenerator.jsx'], bundle: true, write: false,
    platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic',
    plugins: [{ name: 'local-contract-fixtures', setup(builder) {
      builder.onResolve({ filter: /^react(?:\/.*)?$/ }, args => ({ path: args.path, external: true }));
      builder.onResolve({ filter: /(?:\/api|\/AuthContext|\/useContractDraft|\/ContractLivePreview|\/FancySelect)$|^react-router-dom$|^sonner$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => {
        if (path === 'react-router-dom') return { contents: 'export const useLocation=()=>({state:null});' };
        if (path === 'sonner') return { contents: 'export const toast={error(){},success(){}};' };
        if (path.endsWith('/AuthContext')) return { contents: 'export const useAuth=()=>({user:{id:1}});' };
        if (path.endsWith('/useContractDraft')) return { contents: 'export const useContractDraft=()=>"Rascunho de teste";' };
        if (path.endsWith('/ContractLivePreview')) return { contents: 'export default()=>null;' };
        if (path.endsWith('/FancySelect')) return { contents: 'import React from "react";export default function Select({options=[],value,onChange,ariaLabel}){return React.createElement("select",{value,onChange:event=>onChange(event.target.value),"aria-label":ariaLabel},options.map(item=>React.createElement("option",{key:item.value,value:item.value},item.label)));}' };
        return { contents: 'export const fetchClients=async()=>[];export const fetchProperties=async()=>[];export const fetchClientSimulations=async()=>[];export const fetchStandaloneContracts=async()=>[];const forbid=()=>{globalThis.__contractWrites++;throw Error("Unexpected write in navigation test");};export const createClientContract=forbid,createContractWithNewClient=forbid,createStandaloneContract=forbid,downloadContractDocx=forbid;' };
      });
    } }],
  });
  await writeFile(bundlePath, output.outputFiles[0].text);
  const { default: ContractGenerator } = await import(pathToFileURL(bundlePath).href);
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(React.createElement(ContractGenerator)); await new Promise(resolve => setTimeout(resolve, 0)); });

  const steps = () => [...document.querySelectorAll('nav[aria-label="Etapas do contrato"] button')];
  const button = label => [...document.querySelectorAll('button')].find(item => item.textContent.trim() === label);
  const click = async element => {
    assert.ok(element, 'Controle esperado presente');
    await act(async () => { element.click(); await new Promise(resolve => setTimeout(resolve, 0)); });
  };
  const current = () => steps().findIndex(item => item.getAttribute('aria-current') === 'step');

  assert.equal(current(), 0);
  assert.deepEqual(steps().map(item => item.disabled), [false, true, true, true, true, true]);
  await click(steps()[3]);
  assert.equal(current(), 0, 'Etapa futura não pode ser aberta diretamente');
  await click(button('Continuar'));
  assert.equal(current(), 0, 'A validação da origem continua obrigatória');
  assert.match(document.querySelector('[role="alert"]').textContent, /Selecione um cliente/);

  await click([...document.querySelectorAll('button')].find(item => item.textContent.startsWith('Contrato avulso')));
  await click(button('Continuar'));
  assert.equal(current(), 1, 'Continuar libera a próxima etapa após validação');
  assert.deepEqual(steps().map(item => item.disabled), [false, false, true, true, true, true]);
  await click(button('Continuar'));
  assert.equal(current(), 1, 'Campos obrigatórios impedem liberar Compradores');
  assert.ok(document.querySelector('[aria-invalid="true"]'));

  await click(steps()[0]);
  assert.equal(current(), 0);
  assert.equal(steps()[1].disabled, false, 'A etapa alcançada continua disponível ao voltar');
  await click(steps()[1]);
  assert.equal(current(), 1, 'É possível visitar novamente a etapa mais avançada');
  assert.equal(globalThis.__contractWrites, 0, 'Navegação não gera nem salva contrato');
  console.log('Contrato validado: etapas futuras bloqueadas, avanço condicionado à validação e retorno às etapas alcançadas sem gravar dados.');
} finally {
  if (root) await act(async () => root.unmount());
  await unlink(bundlePath).catch(() => {});
  dom.window.close();
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}
