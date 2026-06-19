'use client';

import './globals.css';
import { ReactNode, useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useClinicStore } from '@/store/useClinicStore';
import { AuthProvider } from '@/context/AuthContext';
import { useAppSettingsStore } from '@/store/useAppSettingsStore';

/**
 * Global Layout Wrapper
 * Integrates the Sidebar navigation system with responsive flexbox layout
 * Desktop-first approach: Sidebar always visible on desktop
 */

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const language = useAppSettingsStore((state) => state.language);
  const themeMode = useAppSettingsStore((state) => state.themeMode);
  const initSettings = useAppSettingsStore((state) => state.initSettings);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      void useClinicStore.getState().initStore();
    }
  }, []);

  useEffect(() => {
    initSettings();
  }, [initSettings]);

  useEffect(() => {
    document.documentElement.lang = language === 'FR' ? 'fr' : 'en';
    document.documentElement.classList.toggle('dark', themeMode === 'dark');
  }, [language, themeMode]);

  return (
    <html lang={language === 'FR' ? 'fr' : 'en'}>
      <body className="flex h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-50">
        <AuthProvider>
          {/* Sidebar Navigation */}
          <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden transition-colors duration-300 dark:bg-slate-950">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
