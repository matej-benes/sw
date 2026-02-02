'use client';

import type { User, Role } from '@/lib/types';
import { useRouter, usePathname } from 'next/navigation';
import React, { createContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useFirestore } from '@/firebase';
import { getAuth, signInWithEmailAndPassword, signOut as firebaseSignOut, onIdTokenChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { Logo } from '@/components/logo';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (role: Role) => boolean;
  isSuperAdmin: () => boolean;
  activeOrganizationId: string | null;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const firestore = useFirestore();
  const auth = getAuth();
  
  const activeOrganizationId = useMemo(() => user?.organizationId || null, [user]);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onIdTokenChanged(auth, (firebaseUser) => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }
      
      if (firebaseUser && firestore) {
        setLoading(true);
        const userDocRef = doc(firestore, 'users', firebaseUser.uid);
        
        unsubscribeDoc = onSnapshot(userDocRef, 
          (userDocSnap) => {
            if (userDocSnap.exists()) {
              const userData = { id: userDocSnap.id, ...userDocSnap.data() } as User;
              setUser(userData);
              if (userData.pin && pathname !== '/nastaveni-hesla') {
                router.replace('/nastaveni-hesla');
              }
            } else {
              console.log(`No user document found for UID: ${firebaseUser.uid}, signing out.`);
              firebaseSignOut(auth);
            }
            setLoading(false);
          },
          (error) => {
            console.error("Error fetching user data in real-time:", error);
            firebaseSignOut(auth);
            setLoading(false);
          }
        );
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) {
        unsubscribeDoc();
      }
    };
  }, [auth, firestore, pathname, router]);

  useEffect(() => {
    if (loading) return;

    if (user) {
      if (user.pin && pathname !== '/nastaveni-hesla') {
        router.replace('/nastaveni-hesla');
      } else if (!user.pin && pathname === '/nastaveni-hesla') {
        router.replace('/dashboard');
      } else if (pathname === '/' || pathname.startsWith('/registrace')) {
        router.replace('/dashboard');
      }
    } else {
      // Not logged in
      const isPublicPage = pathname === '/' || pathname.startsWith('/zapis') || pathname.startsWith('/registrace');
      if (!isPublicPage) {
        router.replace('/');
      }
    }
  }, [user, loading, pathname, router]);

  const signIn = async (email: string, pass: string): Promise<void> => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      setLoading(false);
      throw new Error('Nesprávný email nebo heslo.');
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    router.push('/');
  };

  const hasRole = useCallback((role: Role) => {
    if (user?.isSuperAdmin) return true;
    return user?.roles?.includes(role) ?? false;
  }, [user]);
  
  const isSuperAdmin = useCallback(() => {
    return user?.isSuperAdmin === true;
  }, [user]);

  const value: AuthContextType = { 
    user, 
    loading, 
    signIn, 
    signOut, 
    hasRole, 
    isSuperAdmin,
    activeOrganizationId,
  };

   if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Logo className="h-24 w-24 animate-boot-pulse text-primary" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      <FirebaseErrorListener />
      {children}
    </AuthContext.Provider>
  );
}
