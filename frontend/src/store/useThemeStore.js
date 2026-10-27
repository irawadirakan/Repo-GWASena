/**
 * Theme Store (Dark / Light Mode) GWASena 2.0
 * Acuan: docs/gwasena-v2/DESIGN.md Bagian 3
 */

import { create } from 'zustand';

const THEME_STORAGE_KEY = 'gwasena_theme';

function applyThemeToDOM(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'light') {
    root.classList.remove('dark');
    root.classList.add('light');
  } else {
    root.classList.remove('light');
    root.classList.add('dark');
  }
}

export const useThemeStore = create((set, get) => ({
  theme: 'dark', // Dark-first approach

  initTheme: () => {
    if (typeof localStorage === 'undefined') return;
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const initialTheme = savedTheme === 'light' ? 'light' : 'dark';
    applyThemeToDOM(initialTheme);
    set({ theme: initialTheme });
  },

  toggleTheme: () => {
    const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    }
    applyThemeToDOM(nextTheme);
    set({ theme: nextTheme });
  },

  setTheme: (theme) => {
    const validTheme = theme === 'light' ? 'light' : 'dark';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, validTheme);
    }
    applyThemeToDOM(validTheme);
    set({ theme: validTheme });
  },
}));
