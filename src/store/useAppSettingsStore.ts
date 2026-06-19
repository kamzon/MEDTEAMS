'use client';

import { create } from 'zustand';

export type AppLanguage = 'FR' | 'EN';
export type AppThemeMode = 'light' | 'dark';

interface AppSettingsStore {
  language: AppLanguage;
  themeMode: AppThemeMode;
  isInitialized: boolean;
  setLanguage: (language: AppLanguage) => void;
  toggleLanguage: () => void;
  setThemeMode: (themeMode: AppThemeMode) => void;
  toggleThemeMode: () => void;
  initSettings: () => void;
}

const LANGUAGE_STORAGE_KEY = 'medteams-language';
const THEME_STORAGE_KEY = 'medteams-theme';

export const useAppSettingsStore = create<AppSettingsStore>((set, get) => ({
  language: 'FR',
  themeMode: 'light',
  isInitialized: false,

  setLanguage: (language) => {
    set({ language });

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      document.documentElement.lang = language === 'FR' ? 'fr' : 'en';
    }
  },

  toggleLanguage: () => {
    const nextLanguage = get().language === 'FR' ? 'EN' : 'FR';
    get().setLanguage(nextLanguage);
  },

  setThemeMode: (themeMode) => {
    set({ themeMode });

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    }
  },

  toggleThemeMode: () => {
    const nextTheme = get().themeMode === 'dark' ? 'light' : 'dark';
    get().setThemeMode(nextTheme);
  },

  initSettings: () => {
    if (get().isInitialized || typeof window === 'undefined') {
      return;
    }

    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const nextLanguage: AppLanguage = storedLanguage === 'EN' ? 'EN' : 'FR';
    const nextTheme: AppThemeMode = storedTheme === 'dark' ? 'dark' : 'light';

    set({
      language: nextLanguage,
      themeMode: nextTheme,
      isInitialized: true,
    });

    document.documentElement.lang = nextLanguage === 'FR' ? 'fr' : 'en';
    document.documentElement.classList.remove('dark');
  },
}));