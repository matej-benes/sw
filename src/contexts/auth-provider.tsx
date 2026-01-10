'use client';

import type { User, Role } from '@/lib/types';
import { useRouter, usePathname } from 'next/navigation';
import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useUser as useFirebaseUser, useFirestore } from '@/firebase';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';


interface AuthContextType {
  user: User | null;
  signIn: (email: string, pass: string) => Promise<void>;
  signOut: () => void;
  loading: boolean;
  hasRole: (role: Role) => boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: firebaseUser, isUserLoading: firebaseUserLoading } = useFirebaseUser();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const firestore = useFirestore();

  useEffect(() => {
    const fetchUserProfile = async (uid: string) => {
        if (!firestore) return;
        const userDocRef = doc(firestore, 'users', uid);
        try {
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                const userData = { id: docSnap.id, ...docSnap.data() } as User;
                setUser(userData);
            } else {
                console.error("Firestore profile doesn't exist for authenticated user.");
                signOut();
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
            signOut();
        } finally {
            setLoading(false);
        }
    };

    if (firebaseUserLoading) {
      setLoading(true);
    } else {
      if (firebaseUser) {
        fetchUserProfile(firebaseUser.uid);
      } else {
        setUser(null);
        setLoading(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser, firebaseUserLoading, firestore]);
  
   useEffect(() => {
    if (!loading && !user && pathname.startsWith('/dashboard')) {
      router.push('/');
    }
    if (!loading && user && pathname === '/') {
      router.push('/dashboard');
    }
  }, [user, loading, pathname, router]);

  const hasRole = useCallback((role: Role) => {
    return user?.roles.includes(role) ?? false;
  }, [user]);

  const signIn = async (email: string, pass: string): Promise<void> => {
    setLoading(true);
    const auth = getAuth();
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // The useEffect hook will handle fetching the profile and updating the state
    } catch (error) {
      console.error("Sign in error", error);
      setLoading(false); // Make sure to stop loading on error
      throw new Error('Nesprávný email nebo heslo.');
    }
  };

  const signOut = () => {
    const auth = getAuth();
    auth.signOut();
    setUser(null);
    router.push('/');
  };

  const value = { user, signIn, signOut, loading, hasRole };

  // Use the loading state from this provider, which is synced with firebaseUserLoading.
  if (loading && pathname !== '/') { // Avoid showing loader on the login page during initial load
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
