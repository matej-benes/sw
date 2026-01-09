'use client';

import { getMockUserByEmail } from '@/lib/mock-data';
import type { User } from '@/lib/types';
import { useRouter, usePathname } from 'next/navigation';
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { useUser as useFirebaseUser } from '@/firebase';

interface AuthContextType {
  user: User | null;
  signIn: (email: string, pass: string) => Promise<void>;
  signOut: () => void;
  loading: boolean;
  hasRole: (role: User['roles'][number]) => boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: firebaseUser, isUserLoading } = useFirebaseUser();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
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

  const hasRole = (role: User['roles'][number]) => {
    return user?.roles.includes(role) ?? false;
  };

  const signIn = async (email: string, pass: string): Promise<void> => {
    setLoading(true);
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const foundUser = getMockUserByEmail(email);

        let isValid = false;
        if (foundUser?.email === 'matej.romana@seznam.cz' && pass === 'MikMat2008_') {
          isValid = true;
        } else if (foundUser && ['password', 'heslo'].includes(pass)) {
          isValid = true;
        }

        if (foundUser && isValid) {
          setUser(foundUser);
          sessionStorage.setItem('skolaweb-user', JSON.stringify(foundUser));
          setLoading(false);
          resolve();
        } else {
          setLoading(false);
          reject(new Error('Nesprávný email nebo heslo.'));
        }
      }, 1000);
    });
  };

  const signOut = () => {
    setUser(null);
    sessionStorage.removeItem('skolaweb-user');
    router.push('/');
  };

  const value = { user, signIn, signOut, loading, hasRole };

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
