/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { applyTheme, normalizeTheme, readSystemTheme, readThemePreference, resolveTheme, THEME_STORAGE_KEY } from '../utils/theme';

const ThemeContext = createContext({ theme: 'system', resolvedTheme: 'light', setTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setPreference] = useState(readThemePreference);
  const [systemTheme, setSystemTheme] = useState(readSystemTheme);
  const resolvedTheme = resolveTheme(theme, systemTheme);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return undefined;
    const update = () => setSystemTheme(media.matches ? 'dark' : 'light');
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const sync = event => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) setPreference(normalizeTheme(event.newValue));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  useLayoutEffect(() => { applyTheme(resolvedTheme); }, [resolvedTheme]);

  const setTheme = useCallback(value => {
    const next = normalizeTheme(value);
    setPreference(next);
    try { window.localStorage.setItem(THEME_STORAGE_KEY, next); }
    catch { /* The selected theme still works when storage is unavailable. */ }
  }, []);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
