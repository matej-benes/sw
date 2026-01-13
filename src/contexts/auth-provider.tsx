'use client';

import type { User, Role, Organization, OrganizationType } from '@/lib/types';
import { useRouter, usePathname } from 'next/navigation';
import React, { createContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useFirestore } from '@/firebase';
import { getAuth, signInWithEmailAndPassword, signOut as firebaseSignOut, onIdTokenChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, limit } from 'firebase/firestore';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { toast } from '@/hooks/use-toast';
import { parseISO, isPast } from 'date-fns';
import { Logo } from '@/components/logo';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (role: Role) => boolean;
  isSuperAdmin: () => boolean;
  activeOrganization: Organization | null;
  activeOrganizationId: string | null;
  isTrialExpired: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const firestore = useFirestore();
  const auth = getAuth();
  
  const activeOrganizationId = activeOrganization?.id || null;
  const isTrialExpired = useMemo(() => {
    if (!activeOrganization || activeOrganization.status !== 'trial' || !activeOrganization.trialEndDate) {
      return false;
    }
    try {
      const trialEnd = parseISO(activeOrganization.trialEndDate);
      return isPast(trialEnd);
    } catch {
      return false; // Invalid date format
    }
  }, [activeOrganization]);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser && firestore) {
           const userDocRef = doc(firestore, 'users', firebaseUser.uid);
           const orgsQuery = query(collection(firestore, 'organizations'), limit(1));
           
           try {
                const [userDocSnap, orgsSnap] = await Promise.all([
                    getDoc(userDocRef),
                    getDocs(orgsQuery)
                ]);

                if (userDocSnap.exists()) {
                    const userData = { id: userDocSnap.id, ...userDocSnap.data() } as User;
                    setUser(userData);

                    if (!orgsSnap.empty) {
                        const orgData = { id: orgsSnap.docs[0].id, ...orgsSnap.docs[0].data() } as Organization;
                        setActiveOrganization(orgData);
                    } else {
                        setActiveOrganization(null);
                    }
                } else {
                    console.log(`No user document found for UID: ${firebaseUser.uid}, signing out.`);
                    await firebaseSignOut(auth);
                    setUser(null);
                    setActiveOrganization(null);
                }
           } catch (e) {
                console.error("Error fetching user or organization data:", e);
                await firebaseSignOut(auth);
                setUser(null);
                setActiveOrganization(null);
           }
      } else {
        setUser(null);
        setActiveOrganization(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [auth, firestore]);


  const signIn = async (email: string, pass: string): Promise<void> => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // onIdTokenChanged will handle the rest
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

  const value: AuthContextType = { 
    user, 
    loading, 
    signIn, 
    signOut, 
    hasRole, 
    isSuperAdmin, 
    activeOrganization,
    activeOrganizationId,
    isTrialExpired
  };

   if (loading && ['/', '/registrace'].includes(pathname)) {
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
