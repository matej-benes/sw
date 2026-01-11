'use client';

import type { User, Role, UserMembership } from '@/lib/types';
import { useRouter, usePathname } from 'next/navigation';
import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useFirestore, useActiveOrganization } from '@/firebase';
import { getAuth, signInWithEmailAndPassword, signOut as firebaseSignOut, onIdTokenChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { toast } from '@/hooks/use-toast';

type StoredUser = {
  uid: string;
  email: string;
};

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (role: Role) => boolean;
  activeMembership: UserMembership | null;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const firestore = useFirestore();
  const auth = getAuth();
  const { activeOrganizationId, setActiveOrganizationId } = useActiveOrganization();
  const [activeMembership, setActiveMembership] = useState<UserMembership | null>(null);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
           const userDocRef = doc(firestore, 'users', firebaseUser.uid);
           const docSnap = await getDoc(userDocRef);
           if (docSnap.exists()) {
             const userData = { id: docSnap.id, ...docSnap.data() } as User;
             setUser(userData);
             // Logic to set active organization
             if (userData.memberships && userData.memberships.length > 0) {
                 // Check if there is a stored active organization, otherwise default to the first one
                 const storedOrgId = localStorage.getItem('activeOrganizationId');
                 if (storedOrgId && userData.memberships.some(m => m.organizationId === storedOrgId)) {
                     setActiveOrganizationId(storedOrgId);
                 } else {
                     setActiveOrganizationId(userData.memberships[0].organizationId);
                 }
             } else {
                 setActiveOrganizationId(null);
             }
           } else {
             console.log(`No user document found for UID: ${firebaseUser.uid}, signing out.`);
             await firebaseSignOut(auth);
             setUser(null);
             setActiveOrganizationId(null);
           }
      } else {
        setUser(null);
        setActiveOrganizationId(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [auth, firestore, setActiveOrganizationId]);

  useEffect(() => {
    if (user && activeOrganizationId) {
        const membership = user.memberships.find(m => m.organizationId === activeOrganizationId);
        setActiveMembership(membership || null);
        localStorage.setItem('activeOrganizationId', activeOrganizationId);
    } else {
        setActiveMembership(null);
    }
  }, [user, activeOrganizationId]);

  const signIn = async (email: string, pass: string): Promise<void> => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // The onIdTokenChanged listener will handle setting user and org state.
    } catch (error) {
      console.error("Sign in error", error);
      setLoading(false);
      throw new Error('Nesprávný email nebo heslo.');
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setActiveOrganizationId(null);
    setActiveMembership(null);
    localStorage.removeItem('activeOrganizationId');
    router.push('/');
  };

  const hasRole = useCallback((role: Role) => {
    return activeMembership?.roles.includes(role) ?? false;
  }, [activeMembership]);

  const value = { user, loading, signIn, signOut, hasRole, activeMembership };

   if (loading && !pathname.startsWith('/dashboard/profil')) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-dashed border-primary"></div>
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
