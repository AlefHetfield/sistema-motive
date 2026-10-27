import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { noteBackground, noteColors } from '../src/components/notes/noteColors.js';
import { propertyMapThemeOptions } from '../src/components/properties/propertyMapTheme.js';

const frontend = fileURLToPath(new URL('../', import.meta.url));
const noteCss = await readFile(new URL('../src/components/notes/noteStyles.css', import.meta.url), 'utf8');
const darkColors = noteCss.match(/:root\[data-theme="dark"\]\s*\{([^}]+)\}/)[1];
const luminance = hex => {
  const channels = hex.match(/[0-9a-f]{2}/gi).map(value => Number.parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
};
for (const color of noteColors) {
  assert.equal(noteBackground(color.id), `var(--note-color-${color.id}, ${color.value})`);
  const background = darkColors.match(new RegExp(`--note-color-${color.id}:#([a-f0-9]{6})`))[1];
  assert.ok((luminance('e8eef4') + .05) / (luminance(background) + .05) >= 4.5, `Texto legível na nota ${color.id}`);
}
assert.equal(noteBackground('invalid'), noteBackground('default'));
assert.equal(propertyMapThemeOptions('light').styles, null, 'Tema claro restaura a cartografia padrão');
assert.ok(propertyMapThemeOptions('dark').styles.length > 0);

const dom = new JSDOM('<!doctype html><html><body><div id="map"></div></body></html>', { url: 'http://localhost:5173/properties-map', pretendToBeVisual: true });
for (const [name, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) Object.defineProperty(globalThis, name, { configurable: true, value });
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
const maps = [], markers = [];
class FakeMap {
  constructor(element, options) { this.element = element; this.options = options; this.changes = []; this.zoom = options.zoom; this.center = options.center; maps.push(this); }
  addListener() {}
  setOptions(options) { this.options = { ...this.options, ...options }; this.changes.push(options); }
  setCenter(center) { this.center = center; }
  getCenter() { return this.center; }
  setZoom(zoom) { this.zoom = zoom; }
  getZoom() { return this.zoom; }
  fitBounds() {}
}
class Marker {
  constructor(options) { this.options = options; this.detached = false; markers.push(this); }
  addListener() {}
  setMap(map) { this.detached = map == null; }
  setIcon(icon) { this.icon = icon; }
  setZIndex() {}
  setVisible() {}
}
window.google = { maps: { Map: FakeMap, Marker, Size: class {}, Point: class {}, LatLngBounds: class { extend() {} }, ControlPosition: { TOP_RIGHT: 1 }, event: { trigger() {} } } };
globalThis.__mapTestTheme = 'dark';
const bundlePath = path.join(frontend, `.verify-map-theme-${randomUUID()}.mjs`);
const bundled = await build({ absWorkingDir: frontend, entryPoints: ['src/components/properties/PropertyMap.jsx'], bundle: true, write: false, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', plugins: [{ name: 'map-fixtures', setup(builder) {
  builder.onResolve({ filter: /\/ThemeContext$/ }, () => ({ path: 'theme', namespace: 'fixture' }));
  builder.onResolve({ filter: /\/googleMaps$/ }, () => ({ path: 'maps', namespace: 'fixture' }));
  builder.onResolve({ filter: /^sonner$/ }, () => ({ path: 'toast', namespace: 'fixture' }));
  builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: name }) => ({ contents: name === 'theme' ? 'export const useTheme=()=>({resolvedTheme:globalThis.__mapTestTheme});' : name === 'maps' ? 'export const googleMapsIsConfigured=true;export const loadGoogleMaps=()=>Promise.resolve(window.google.maps);' : 'export const toast={success(){},error(){}};' }));
} }] });
await writeFile(bundlePath, bundled.outputFiles[0].text);
let root;
try {
  const { default: PropertyMap } = await import(pathToFileURL(bundlePath).href);
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('map'));
  const properties = [{ id: 1, title: 'Casa', propertyType: 'Casa', city: 'Sumaré', status: 'Disponível', price: 250000, latitude: -22.82, longitude: -47.26 }];
  const render = () => root.render(React.createElement(PropertyMap, { properties, selectedPropertyId: null, onSelect() {} }));
  await act(async () => { render(); await new Promise(resolve => setTimeout(resolve, 0)); });
  assert.equal(maps.length, 1);
  assert.ok(maps[0].options.styles.length > 0);
  assert.equal(markers.length, 1);
  maps[0].setZoom(18);
  maps[0].setCenter({ lat: -22.8, lng: -47.2 });
  globalThis.__mapTestTheme = 'light';
  await act(async () => render());
  assert.equal(maps[0].options.styles, null, 'Alteração para claro limpa estilos escuros');
  assert.equal(maps.length, 1, 'Trocar tema não recria o mapa');
  assert.equal(markers.length, 1, 'Trocar tema preserva os pins');
  assert.equal(markers[0].detached, false);
  assert.equal(maps[0].zoom, 18, 'Trocar tema preserva o zoom');
  assert.deepEqual(maps[0].center, { lat: -22.8, lng: -47.2 });
  globalThis.__mapTestTheme = 'dark';
  await act(async () => render());
  assert.ok(maps[0].options.styles.length > 0);
  assert.equal(maps.length, 1);
  console.log('Tema validado: seis cores de notas com contraste e mapa claro/escuro sem recriar pins, posição ou zoom.');
} finally {
  if (root) await act(async () => root.unmount());
  await unlink(bundlePath);
  dom.window.close();
}
