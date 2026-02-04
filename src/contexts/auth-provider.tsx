
'use client';

import type { User, Role, SavedAccount } from '@/lib/types';
import { useRouter, usePathname } from 'next/navigation';
import React, { createContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useFirestore } from '@/firebase';
import { getAuth, signInWithEmailAndPassword, signOut as firebaseSignOut, onIdTokenChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { Logo } from '@/components/logo';

const SAVED_ACCOUNTS_KEY = 'skolaweb_saved_accounts';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (role: Role) => boolean;
  isSuperAdmin: () => boolean;
  activeOrganizationId: string | null;
  activeStudentId: string | null;
  setActiveStudentId: (id: string | null) => void;
  savedAccounts: SavedAccount[];
  switchAccount: (account: SavedAccount) => Promise<void>;
  addAccount: () => Promise<void>;
  removeSavedAccount: (id: string) => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  
  const router = useRouter();
  const pathname = usePathname();
  const firestore = useFirestore();
  const auth = getAuth();
  
  const activeOrganizationId = useMemo(() => user?.organizationId || null, [user]);

  // Load saved accounts on mount
  useEffect(() => {
    const saved = localStorage.getItem(SAVED_ACCOUNTS_KEY);
    if (saved) {
      try {
        setSavedAccounts(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved accounts:", e);
      }
    }
  }, []);

  // Update saved accounts when current user changes
  useEffect(() => {
    if (user) {
      setSavedAccounts(prev => {
        const exists = prev.find(a => a.id === user.id);
        const updated = exists 
          ? prev.map(a => a.id === user.id ? { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl } : a)
          : [...prev, { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl }];
        
        localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(updated));
        return updated;
      });
    }
  }, [user]);

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
              
              // Set default active student for parents if not set or if current active is not in list
              if (userData.roles.includes('rodic')) {
                const kids = userData.studentIds || (userData.studentId ? [userData.studentId] : []);
                if (kids.length > 0 && (!activeStudentId || !kids.includes(activeStudentId))) {
                  setActiveStudentId(kids[0]);
                }
              }

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
        setActiveStudentId(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) {
        unsubscribeDoc();
      }
    };
  }, [auth, firestore, pathname, router, activeStudentId]);

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

  const switchAccount = async (account: SavedAccount) => {
    await firebaseSignOut(auth);
    router.push(`/?email=${encodeURIComponent(account.email)}`);
  };

  const addAccount = async () => {
    await firebaseSignOut(auth);
    router.push('/');
  };

  const removeSavedAccount = (id: string) => {
    setSavedAccounts(prev => {
      const updated = prev.filter(a => a.id !== id);
      localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(updated));
      return updated;
    });
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
    activeStudentId,
    setActiveStudentId,
    savedAccounts,
    switchAccount,
    addAccount,
    removeSavedAccount
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
