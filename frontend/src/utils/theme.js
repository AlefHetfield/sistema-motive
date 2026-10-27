export const THEME_STORAGE_KEY = 'motive-theme';
export const THEME_COLORS = { light: '#F6F8F9', dark: '#101820' };

export function normalizeTheme(value) {
  return ['light', 'dark', 'system'].includes(value) ? value : 'system';
}

export function readThemePreference() {
  try { return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY)); }
  catch { return 'system'; }
}

export function readSystemTheme() {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  catch { return 'light'; }
}

export function resolveTheme(theme, systemTheme) {
  return normalizeTheme(theme) === 'system' ? systemTheme : theme;
}

export function applyTheme(theme) {
  const root = document.documentElement;
  const changed = root.dataset.theme !== theme;
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  if (changed) window.dispatchEvent(new CustomEvent('motive:theme-change', { detail: { theme } }));
}
