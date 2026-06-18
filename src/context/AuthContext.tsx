'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { useClinicStore } from '@/store/useClinicStore';

const AUTH_STORAGE_KEY = 'medteams-active-user';

export type SessionUser = {
  id: string;
  username: string;
  role: string;
  name: string;
};

interface AuthContextType {
  currentUser: SessionUser | null;
  setCurrentUser: (user: SessionUser | null) => void;
  handleLogout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<SessionUser | null>(null);

  const setCurrentUser = (user: SessionUser | null) => {
    setCurrentUserState(user);
    if (typeof window !== 'undefined') {
      if (user) {
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
        useClinicStore.getState().setActiveUserScope(user.username);
      } else {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        useClinicStore.getState().setActiveUserScope(null);
      }
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
