'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Calendar,
  Users,
  Stethoscope,
  Globe,
  Moon,
  SunMedium,
  ChevronLeft,
  LogOut,
  Settings,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getInitials } from '@/lib/roles';
import { useAppSettingsStore } from '@/store/useAppSettingsStore';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { currentUser, handleLogout } = useAuth();
  const language = useAppSettingsStore((state) => state.language);
  const themeMode = useAppSettingsStore((state) => state.themeMode);
  const setLanguage = useAppSettingsStore((state) => state.setLanguage);
  const toggleLanguage = useAppSettingsStore((state) => state.toggleLanguage);
  const toggleThemeMode = useAppSettingsStore((state) => state.toggleThemeMode);

  const isActive = (path: string) => pathname === path;

  const isFrench = language === 'FR';

  const navItems = [
    {
      label: isFrench ? 'Tableau de bord' : 'Dashboard',
      path: '/',
      icon: Home,
    },
    {
      label: isFrench ? 'Calendrier' : 'Calendar',
      path: '/calendar',
      icon: Calendar,
    },
    {
      label: isFrench ? 'Patients' : 'Patients',
      path: '/patients',
      icon: Users,
    },
    {
      label: isFrench ? 'Paramètres' : 'Settings',
      path: '/settings',
      icon: Settings,
    },
  ];

  const themeLabel = themeMode === 'dark' ? 'Mode clair' : 'Mode sombre';

  return (
    <aside
      className={`${isOpen ? 'w-64' : 'w-20'} h-screen flex flex-col flex-shrink-0 border-r border-slate-200 bg-white shadow-sm transition-all duration-300 dark:border-slate-800 dark:bg-slate-950`}
    >
      <div
        className={`flex items-center border-b border-slate-200 px-6 py-8 dark:border-slate-800 ${
          isOpen ? 'justify-between' : 'justify-center'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700">
            <Stethoscope className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          {isOpen && <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">MedTeams</h1>}
        </div>
        <button
          onClick={onToggle}
          className="rounded-lg p-1 transition-colors hover:bg-slate-100 dark:hover:bg-slate-900"
          title="Toggle sidebar"
        >
          <ChevronLeft
            className={`h-5 w-5 text-slate-600 transition-transform duration-300 dark:text-slate-300 ${isOpen ? '' : 'rotate-180'}`}
            strokeWidth={2}
          />
        </button>
      </div>

      {isOpen && <p className="px-6 pb-2 text-xs font-medium text-slate-500 dark:text-slate-400">{isFrench ? 'Espace clinique' : 'Clinical Workspace'}</p>}

      <nav className={`flex-1 space-y-2 py-6 ${isOpen ? 'px-4' : 'px-2'}`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          const linkClasses = active
            ? 'bg-blue-50 text-blue-600 dark:bg-slate-800 dark:text-sky-300'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900';

          return (
            <Link key={item.path} href={item.path} className="block">
              <div
                className={`group flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3 transition-all duration-200 ${
                  linkClasses
                } ${isOpen ? 'justify-start' : 'justify-center'}`}
                title={isOpen ? '' : item.label}
                aria-current={active ? 'page' : undefined}
              >
                <Icon
                  className={`h-5 w-5 flex-shrink-0 ${
                    active
                      ? 'text-blue-600 dark:text-sky-300'
                      : 'text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200'
                  }`}
                  strokeWidth={2}
                />
                {isOpen && <span className="text-sm">{item.label}</span>}
              </div>
            </Link>
          );
        })}
      </nav>

      {isOpen ? (
        <div className="space-y-4 border-t border-slate-200 px-4 py-6 dark:border-slate-800">
          {currentUser && (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-slate-800 text-sm font-bold text-white">
                {getInitials(currentUser.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{currentUser.name}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{currentUser.username}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              {isFrench ? 'Langue' : 'Language'}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setLanguage('FR')}
                className={`flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  language === 'FR'
                    ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Globe className="h-4 w-4" strokeWidth={2} />
                <span>{isFrench ? 'Français' : 'French'}</span>
              </button>
              <button
                onClick={() => setLanguage('EN')}
                className={`flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  language === 'EN'
                    ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Globe className="h-4 w-4" strokeWidth={2} />
                <span>{isFrench ? 'Anglais' : 'English'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              {isFrench ? 'Apparence' : 'Appearance'}
            </label>
            <button
              onClick={toggleThemeMode}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                themeMode === 'dark'
                  ? 'bg-slate-900 text-slate-100 ring-1 ring-slate-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {themeMode === 'dark' ? (
                <SunMedium className="h-4 w-4" strokeWidth={2} />
              ) : (
                <Moon className="h-4 w-4" strokeWidth={2} />
              )}
              <span>{themeLabel}</span>
            </button>
          </div>

          {currentUser && (
            <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" strokeWidth={2} />
                <span>{isFrench ? 'Se déconnecter' : 'Log out'}</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2 border-t border-slate-200 px-2 py-6 dark:border-slate-800">
          {currentUser && (
            <div className="px-2 py-2">
              <button
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-left dark:border-slate-800 dark:bg-slate-900"
                title={currentUser.name}
              >
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-slate-800 text-xs font-bold text-white">
                  {getInitials(currentUser.name)}
                </div>
              </button>
            </div>
          )}

          <div className="px-2 py-2">
            <button
              onClick={toggleLanguage}
              className="w-full rounded-lg px-2 py-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-900"
              title={isFrench ? 'Passer en anglais' : 'Switch to French'}
            >
              <Globe className="mx-auto h-5 w-5 text-emerald-600" strokeWidth={2} />
            </button>
          </div>

          <div className="px-2 py-2">
            <button
              onClick={toggleThemeMode}
              className="w-full rounded-lg px-2 py-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-900"
              title={themeLabel}
            >
              {themeMode === 'dark' ? (
                <SunMedium className="mx-auto h-5 w-5 text-slate-200" strokeWidth={2} />
              ) : (
                <Moon className="mx-auto h-5 w-5 text-slate-600" strokeWidth={2} />
              )}
            </button>
          </div>

          {currentUser && (
            <div className="border-t border-slate-200 px-2 py-2 dark:border-slate-800">
              <button
                onClick={handleLogout}
                className="w-full rounded-lg px-2 py-2 transition-colors hover:bg-red-50"
                title="Se déconnecter"
              >
                <LogOut className="mx-auto h-5 w-5 text-red-600" strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
