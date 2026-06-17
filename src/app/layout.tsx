'use client';

import './globals.css';
import { ReactNode, useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useClinicStore } from '@/store/useClinicStore';

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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      void useClinicStore.getState().initStore();
    }
  }, []);

  return (
    <html lang="en">
      <body className="flex h-screen bg-slate-50 text-slate-900">
        {/* Sidebar Navigation */}
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </body>
    </html>
  );
}
