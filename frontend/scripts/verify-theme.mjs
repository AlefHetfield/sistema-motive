import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

const dom = new JSDOM('<!doctype html><html class="existing"><head><meta name="theme-color" content="#ffffff"></head><body><div id="root"></div></body></html>', { url: 'http://localhost:5173/tasks', runScripts: 'outside-only' });
const descriptors = new Map();
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, CustomEvent: dom.window.CustomEvent, IS_REACT_ACT_ENVIRONMENT: true })) {
  descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
let systemDark = true;
const mediaListeners = new Set();
window.matchMedia = () => ({
  get matches() { return systemDark; },
  addEventListener: (_, listener) => mediaListeners.add(listener),
  removeEventListener: (_, listener) => mediaListeners.delete(listener),
});
const changeSystem = async dark => act(async () => {
  systemDark = dark;
  mediaListeners.forEach(listener => listener());
});
const storage = window.localStorage;
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const bootstrap = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(match => match[1].includes('motive-theme'))?.[1];
assert.ok(bootstrap, 'O bootstrap do tema deve executar antes do React');
const rootElement = document.documentElement;
const checkDom = theme => {
  assert.equal(rootElement.dataset.theme, theme);
  assert.equal(rootElement.classList.contains('dark'), theme === 'dark');
  assert.equal(rootElement.style.colorScheme, theme);
  assert.equal(document.querySelector('meta[name="theme-color"]').content, theme === 'dark' ? '#101820' : '#F6F8F9');
  assert.ok(rootElement.classList.contains('existing'), 'Classes alheias ao tema são preservadas');
};
const bundlePath = fileURLToPath(new URL(`.verify-theme-${randomUUID()}.mjs`, import.meta.url));
const frontend = fileURLToPath(new URL('../', import.meta.url));
const output = await build({ absWorkingDir: frontend, entryPoints: ['src/context/ThemeContext.jsx'], bundle: true, write: false, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic' });
await writeFile(bundlePath, output.outputFiles[0].text);
const { ThemeProvider, useTheme } = await import(pathToFileURL(bundlePath).href);
const { createRoot } = await import('react-dom/client');
let current;
let root;
function Probe() {
  current = useTheme();
  return React.createElement('output', null, `${current.theme}/${current.resolvedTheme}`);
}
const mount = async (withProvider = true) => {
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(withProvider ? React.createElement(ThemeProvider, null, React.createElement(Probe)) : React.createElement(Probe)));
};
const unmount = async () => {
  if (root) await act(async () => root.unmount());
  root = null;
  assert.equal(mediaListeners.size, 0, 'A assinatura do tema do dispositivo é limpa ao desmontar');
};
const select = async theme => act(async () => current.setTheme(theme));

try {
  // A preference saved in a previous visit wins over the current device setting.
  storage.setItem('motive-theme', 'light');
  window.eval(bootstrap);
  checkDom('light');
  await mount();
  assert.equal(current.theme, 'light');
  checkDom('light');
  await select('dark');
  assert.equal(storage.getItem('motive-theme'), 'dark');
  checkDom('dark');
  await unmount();
  await changeSystem(false);
  window.eval(bootstrap);
  checkDom('dark');
  await mount();
  assert.equal(current.theme, 'dark', 'A seleção persiste ao recarregar');
  checkDom('dark');

  await select('system');
  checkDom('light');
  await changeSystem(true);
  checkDom('dark');
  await select('light');
  await changeSystem(false);
  await changeSystem(true);
  checkDom('light');

  // Changes in another tab update the current UI without requiring a reload.
  await act(async () => window.dispatchEvent(new window.StorageEvent('storage', { key: 'motive-theme', newValue: 'dark' })));
  assert.equal(current.theme, 'dark');
  checkDom('dark');
  await act(async () => window.dispatchEvent(new window.StorageEvent('storage', { key: 'unrelated', newValue: 'light' })));
  checkDom('dark');
  await act(async () => window.dispatchEvent(new window.StorageEvent('storage', { key: 'motive-theme', newValue: 'invalid' })));
  assert.equal(current.theme, 'system');
  await changeSystem(false);
  checkDom('light');
  await select('dark');
  await act(async () => window.dispatchEvent(new window.StorageEvent('storage', { key: null })));
  assert.equal(current.theme, 'system');
  checkDom('light');
  await unmount();

  storage.setItem('motive-theme', 'invalid');
  await changeSystem(true);
  window.eval(bootstrap);
  checkDom('dark');
  await mount();
  assert.equal(current.theme, 'system');
  checkDom('dark');
  await unmount();

  // Blocked storage must not prevent opening the app or switching its appearance.
  const storageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
  Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('Storage blocked'); } });
  try {
    window.eval(bootstrap);
    checkDom('dark');
    await mount();
    assert.equal(current.theme, 'system');
    await select('light');
    checkDom('light');
    await unmount();
  } finally { Object.defineProperty(window, 'localStorage', storageDescriptor); }

  await mount(false);
  assert.equal(current.theme, 'system');
  assert.equal(current.resolvedTheme, 'light', 'Componentes isolados têm um contexto seguro');
  await unmount();
  console.log('Tema validado: bootstrap sem flash, preferência persistida, Automático, troca do dispositivo, sincronização entre abas, storage bloqueado e limpeza de listeners.');
} finally {
  await unmount();
  await unlink(bundlePath);
  dom.window.close();
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
}
