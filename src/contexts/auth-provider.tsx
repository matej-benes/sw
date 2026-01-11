'use client';

import type { User, Role, UserMembership, Organization, OrganizationType } from '@/lib/types';
import { useRouter, usePathname } from 'next/navigation';
import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useFirestore, useActiveOrganization } from '@/firebase';
import { getAuth, signInWithEmailAndPassword, signOut as firebaseSignOut, onIdTokenChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
  isSuperAdmin: () => boolean;
  activeMembership: UserMembership | null;
  activeOrganization: Organization | null;
  activeOrganizationType: OrganizationType | null;
  isTrialExpired: boolean;
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
  const [activeOrganization, setActiveOrganization] = useState<Organization | null>(null);
  const [isTrialExpired, setIsTrialExpired] = useState(false);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
           const userDocRef = doc(firestore, 'users', firebaseUser.uid);
           let docSnap = await getDoc(userDocRef);
           
           // Special handling for the super admin user
           if (!docSnap.exists() && firebaseUser.email === 'matej.romana@seznam.cz') {
                const superAdminData: User = {
                    id: firebaseUser.uid,
                    name: "Super Administrátor",
                    email: firebaseUser.email,
                    isSuperAdmin: true,
                    memberships: [],
                };
                await setDoc(userDocRef, superAdminData);
                docSnap = await getDoc(userDocRef); // Re-fetch the doc
           }

           if (docSnap.exists()) {
             const userData = { id: docSnap.id, ...docSnap.data() } as User;
             setUser(userData);
             // Logic to set active organization
             if (userData.memberships && userData.memberships.length > 0) {
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
    const updateActiveOrganization = async () => {
        if (user && activeOrganizationId) {
            const membership = user.memberships.find(m => m.organizationId === activeOrganizationId);
            setActiveMembership(membership || null);

            if (firestore) {
                const orgDocRef = doc(firestore, 'organizations', activeOrganizationId);
                const orgDocSnap = await getDoc(orgDocRef);
                if (orgDocSnap.exists()) {
                    const orgData = { id: orgDocSnap.id, ...orgDocSnap.data() } as Organization
                    setActiveOrganization(orgData);
                    setIsTrialExpired(orgData.status === 'expired');
                } else {
                    setActiveOrganization(null);
                    setIsTrialExpired(false);
                }
            }
            
            localStorage.setItem('activeOrganizationId', activeOrganizationId);
        } else {
            setActiveMembership(null);
            setActiveOrganization(null);
            setIsTrialExpired(false);
        }
    };
    updateActiveOrganization();
  }, [user, activeOrganizationId, firestore]);

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
    setActiveOrganizationId(null);
    setActiveMembership(null);
    setActiveOrganization(null);
    setIsTrialExpired(false);
    localStorage.removeItem('activeOrganizationId');
    router.push('/');
  };

  const hasRole = useCallback((role: Role) => {
    if (user?.isSuperAdmin) return true; // Super admin has all roles
    return activeMembership?.roles.includes(role) ?? false;
  }, [activeMembership, user]);
  
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
    activeMembership, 
    activeOrganization,
    activeOrganizationType: activeOrganization?.type || null,
    isTrialExpired,
  };

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
