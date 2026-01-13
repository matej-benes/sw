'use client';

import type { User, Role, Organization, OrganizationType } from '@/lib/types';
import { useRouter, usePathname } from 'next/navigation';
import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useFirestore } from '@/firebase';
import { getAuth, signInWithEmailAndPassword, signOut as firebaseSignOut, onIdTokenChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { toast } from '@/hooks/use-toast';
import { parseISO, isPast } from 'date-fns';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (role: Role) => boolean;
  isSuperAdmin: () => boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const firestore = useFirestore();
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
           const userDocRef = doc(firestore, 'users', firebaseUser.uid);
           let docSnap = await getDoc(userDocRef);
           
           if (docSnap.exists()) {
             const userData = { id: docSnap.id, ...docSnap.data() } as User;
             setUser(userData);
           } else {
             console.log(`No user document found for UID: ${firebaseUser.uid}, signing out.`);
             await firebaseSignOut(auth);
             setUser(null);
           }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [auth, firestore]);


  const signIn = async (email: string, pass: string): Promise<void> => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error("Sign in error", error);
      setLoading(false);
      throw new Error('Nesprávný email nebo heslo.');
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    router.push('/');
  };

  const hasRole = useCallback((role: Role) => {
    // Super Admins have all roles
    if (user?.isSuperAdmin) return true;
    return user?.roles?.includes(role) ?? false;
  }, [user]);
  
  const isSuperAdmin = useCallback(() => {
    return user?.isSuperAdmin === true;
  }, [user]);

  const value = { 
    user, 
    loading, 
    signIn, 
    signOut, 
    hasRole, 
    isSuperAdmin, 
  };

   if (loading && ['/', '/registrace'].includes(pathname)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-24 w-24 animate-boot-pulse text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <path d="M2 17l10 5 10-5"></path>
                <path d="M2 12l10 5 10-5"></path>
            </svg>
        </div>
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
