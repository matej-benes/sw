'use client';

import type { User } from '@/lib/types';
import { useRouter, usePathname } from 'next/navigation';
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { useUser as useFirebaseUser, useFirestore } from '@/firebase';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';


interface AuthContextType {
  user: User | null;
  signIn: (email: string, pass: string) => Promise<void>;
  signOut: () => void;
  loading: boolean;
  hasRole: (role: User['roles'][number]) => boolean;
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
    setLoading(firebaseUserLoading);
    if (!firebaseUserLoading) {
      if (firebaseUser) {
        // User is authenticated, now fetch their profile from Firestore
        const userDocRef = doc(firestore, 'users', firebaseUser.uid);
        getDoc(userDocRef).then((docSnap) => {
          if (docSnap.exists()) {
            const userData = { id: docSnap.id, ...docSnap.data() } as User;
            setUser(userData);
            sessionStorage.setItem('skolaweb-user', JSON.stringify(userData));
          } else {
            // Firestore profile doesn't exist. This can happen.
            // For now, we sign them out.
            console.error("User exists in Auth but not in Firestore.");
            signOut();
          }
        }).catch(error => {
            console.error("Error fetching user profile:", error);
            signOut();
        });
      } else {
        // No firebase user, clear local state
        setUser(null);
        sessionStorage.removeItem('skolaweb-user');
      }
    }
  }, [firebaseUser, firebaseUserLoading, firestore]);
  
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
    const auth = getAuth();
    try {
      // Use Firebase to sign in
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      // The useEffect will handle fetching the user profile and setting the state
      // No need to do anything else here.
    } catch (error) {
      console.error("Sign in error", error);
      setLoading(false);
      // Re-throw a simpler error message for the UI
      throw new Error('Nesprávný email nebo heslo.');
    }
    // Loading will be set to false by the useEffect
  };

  const signOut = () => {
    const auth = getAuth();
    auth.signOut(); // This will trigger the onAuthStateChanged listener
    setUser(null);
    sessionStorage.removeItem('skolaweb-user');
    router.push('/');
  };

  const value = { user, signIn, signOut, loading, hasRole };

  // Use the loading state from this provider, which is synced with firebaseUserLoading.
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
