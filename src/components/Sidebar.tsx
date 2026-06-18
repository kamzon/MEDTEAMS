'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Calendar,
  Users,
  Stethoscope,
  Briefcase,
  Globe,
  Moon,
  ChevronLeft,
  LogOut,
  Settings,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

type UserRole = 'doctor' | 'secretary';
type Language = 'FR' | 'AR';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const [userRole, setUserRole] = useState<UserRole>('doctor');
  const [language, setLanguage] = useState<Language>('FR');
  const pathname = usePathname();
  const { currentUser, handleLogout } = useAuth();

  const isActive = (path: string) => pathname === path;

  const navItems = [
    { label: 'Dashboard', path: '/', icon: Home },
    { label: 'Calendar', path: '/calendar', icon: Calendar },
    { label: 'Patients', path: '/patients', icon: Users },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside className={`${
      isOpen ? 'w-64' : 'w-20'
    } h-screen flex flex-col bg-white border-r border-slate-200 shadow-sm transition-all duration-300 flex-shrink-0`}>
      {/* Logo / Header Section */}
      <div className={`px-6 py-8 border-b border-slate-200 flex items-center ${
        isOpen ? 'justify-between' : 'justify-center'
      }`}>
        <div className={`flex items-center gap-2 ${isOpen ? 'mb-0' : 'mb-0'}`}>
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center flex-shrink-0">
            <Stethoscope className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          {isOpen && (
            <>
              <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
                MedTeams
              </h1>
            </>
          )}
        </div>
        <button
          onClick={onToggle}
          className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          title="Toggle sidebar"
        >
          <ChevronLeft
            className={`w-5 h-5 text-slate-600 transition-transform duration-300 ${
              isOpen ? '' : 'rotate-180'
            }`}
            strokeWidth={2}
          />
        </button>
      </div>

      {isOpen && (
        <p className="text-xs text-slate-500 font-medium px-6 pb-2">Clinical Workspace</p>
      )}

      {/* Navigation Section */}
      <nav className={`flex-1 py-6 space-y-2 ${
        isOpen ? 'px-4' : 'px-2'
      }`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          const linkClasses = active
            ? 'bg-blue-50 text-blue-600'
            : 'text-slate-600 hover:bg-slate-100';

          return (
            <Link key={item.path} href={item.path} className="block">
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer group ${
                  linkClasses
                } ${
                  isOpen ? 'justify-start' : 'justify-center'
                }`}
                title={isOpen ? '' : item.label}
                aria-current={active ? 'page' : undefined}
              >
                <Icon
                  className={`w-5 h-5 flex-shrink-0 ${
                    active ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-700'
                  }`}
                  strokeWidth={2}
                />
                {isOpen && <span className="text-sm">{item.label}</span>}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer Controls Section */}
      {isOpen && (
        <div className="border-t border-slate-200 px-4 py-6 space-y-4">
          {/* Role Toggle */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block">
              Role
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setUserRole('doctor')}
                className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  userRole === 'doctor'
                    ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Stethoscope className="w-4 h-4" strokeWidth={2} />
                <span>Doctor</span>
              </button>
              <button
                onClick={() => setUserRole('secretary')}
                className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  userRole === 'secretary'
                    ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Briefcase className="w-4 h-4" strokeWidth={2} />
                <span>Secretary</span>
              </button>
            </div>
          </div>

          {/* Language Toggle */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block">
              Language
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setLanguage('FR')}
                className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  language === 'FR'
                    ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Globe className="w-4 h-4" strokeWidth={2} />
                <span>FR</span>
              </button>
              <button
                onClick={() => setLanguage('AR')}
                className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  language === 'AR'
                    ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Moon className="w-4 h-4" strokeWidth={2} />
                <span>AR</span>
              </button>
            </div>
          </div>

          {/* Status Indicator */}
          <div className="pt-2 border-t border-slate-200">
            <p className="text-xs text-slate-500 space-x-1">
              <span>Active Role:</span>
              <span className="font-semibold text-slate-700 capitalize">
                {userRole}
              </span>
            </p>
          </div>

          {/* Logout Section */}
          {currentUser && (
            <div className="pt-4 border-t border-slate-200">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors text-sm font-medium"
              >
                <LogOut className="w-4 h-4" strokeWidth={2} />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Collapsed State - Icon Tooltips */}
      {!isOpen && (
        <div className="border-t border-slate-200 px-2 py-6 space-y-2">
          <div className="px-2 py-2">
            <button
              onClick={() => setUserRole(userRole === 'doctor' ? 'secretary' : 'doctor')}
              className="w-full px-2 py-2 hover:bg-slate-100 rounded-lg transition-colors"
              title={userRole === 'doctor' ? 'Switch to Secretary' : 'Switch to Doctor'}
            >
              {userRole === 'doctor' ? (
                <Stethoscope className="w-5 h-5 text-blue-600 mx-auto" strokeWidth={2} />
              ) : (
                <Briefcase className="w-5 h-5 text-slate-600 mx-auto" strokeWidth={2} />
              )}
            </button>
          </div>
          <div className="px-2 py-2">
            <button
              onClick={() => setLanguage(language === 'FR' ? 'AR' : 'FR')}
              className="w-full px-2 py-2 hover:bg-slate-100 rounded-lg transition-colors"
              title={language === 'FR' ? 'Switch to Arabic' : 'Switch to French'}
            >
              {language === 'FR' ? (
                <Globe className="w-5 h-5 text-emerald-600 mx-auto" strokeWidth={2} />
              ) : (
                <Moon className="w-5 h-5 text-emerald-600 mx-auto" strokeWidth={2} />
              )}
            </button>
          </div>

          {/* Logout Icon - Collapsed State */}
          {currentUser && (
            <div className="px-2 py-2 border-t border-slate-200">
              <button
                onClick={handleLogout}
                className="w-full px-2 py-2 hover:bg-red-50 rounded-lg transition-colors"
                title="Log Out"
              >
                <LogOut className="w-5 h-5 text-red-600 mx-auto" strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
