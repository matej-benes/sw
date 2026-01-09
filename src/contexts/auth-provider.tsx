'use client';

import { getMockUserByEmail, mockUsers } from '@/lib/mock-data';
import type { Role, User } from '@/lib/types';
import { useRouter, usePathname } from 'next/navigation';
import React, { createContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  user: User | null;
  signIn: (email: string, pass: string) => Promise<void>;
  signOut: () => void;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Simulate checking for a logged-in user in session storage
    const storedUser = sessionStorage.getItem('skolaweb-user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading && !user && pathname.startsWith('/dashboard')) {
      router.push('/');
    }
    if (!loading && user && pathname === '/') {
      router.push('/dashboard');
    }
  }, [user, loading, pathname, router]);


  const signIn = async (email: string, pass: string): Promise<void> => {
    // This is a mock sign-in. In a real app, you'd call Firebase.
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const foundUser = getMockUserByEmail(email);
        if (foundUser && pass === 'password') { // Mock password check
          setUser(foundUser);
          sessionStorage.setItem('skolaweb-user', JSON.stringify(foundUser));
          resolve();
        } else {
          reject(new Error('Nesprávný email nebo heslo. Zkuste "ucitel@skola.cz" a heslo "password".'));
        }
      }, 1000);
    });
  };

  const signOut = () => {
    setUser(null);
    sessionStorage.removeItem('skolaweb-user');
    router.push('/');
  };

  const value = { user, signIn, signOut, loading };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-dashed border-primary"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
