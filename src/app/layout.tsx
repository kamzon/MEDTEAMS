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
    document.documentElement.classList.remove('dark');
  }, []);

  return (
    <html lang={language === 'FR' ? 'fr' : 'en'}>
      <body className="flex h-screen bg-slate-50 text-slate-900 transition-colors duration-300">
        <AuthProvider>
          {/* Sidebar Navigation */}
          <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50 transition-colors duration-300">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
