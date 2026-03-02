import React, { createContext, useContext, useEffect, useState } from 'react';

const SETTINGS_KEY = 'ee-info-settings';

export type ThemeMode = 'light' | 'dark' | 'cyberpunk' | 'system';

function getStoredTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.theme && ['light', 'dark', 'cyberpunk', 'system'].includes(parsed.theme)) {
        return parsed.theme;
      }
    }
  } catch {}
  return 'system';
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' | 'cyberpunk' {
  if (mode === 'system') {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark' | 'cyberpunk';
  setTheme: (t: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(getStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark' | 'cyberpunk'>(() =>
    resolveTheme(getStoredTheme())
  );

  useEffect(() => {
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    document.documentElement.setAttribute('data-theme', resolved);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const handler = () => {
      const resolved = mq?.matches ? 'dark' : 'light';
      setResolvedTheme(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    };
    mq?.addEventListener('change', handler);
    return () => mq?.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = (t: ThemeMode) => {
    setThemeState(t);
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.theme = t;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed));
    } catch {}
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
