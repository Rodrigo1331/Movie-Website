import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'reelbook-theme';
const META_COLORS: Record<Theme, string> = { dark: '#09090b', light: '#f6f5f1' };

/** The theme already applied to <html> (set before render by the inline script in index.html). */
function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[theme]);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this visit.
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return { theme, toggle };
}
