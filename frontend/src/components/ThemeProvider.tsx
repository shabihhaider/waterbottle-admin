'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

type Ctx = { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void; };
const ThemeCtx = createContext<Ctx | null>(null);

function applyTheme(next: Theme) {
  const root = document.documentElement;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const mode = next === 'system' ? (systemDark ? 'dark' : 'light') : next;
  root.classList.toggle('dark', mode === 'dark');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');

  useEffect(() => {
    const saved = (localStorage.getItem('theme') as Theme) || 'system';
    setThemeState(saved);
    applyTheme(saved);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('theme', t);
    applyTheme(t);
  };

  const toggle = () => setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark');

  return (
    <ThemeCtx.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeCtx.Provider>
  );
}

export const useTheme = () => {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};