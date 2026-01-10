'use client';

import type { User, Role } from '@/lib/types';
import { useRouter, usePathname } from 'next/navigation';
import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useFirestore } from '@/firebase';
import { getAuth, signInWithEmailAndPassword, signOut as firebaseSignOut, onIdTokenChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

type StoredUser = {
  uid: string;
  email: string;
};

interface AuthContextType {
  user: User | null;
  activeAccount: StoredUser | null;
  accounts: StoredUser[];
  signIn: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
  hasRole: (role: Role) => boolean;
  switchUser: (email: string, pass: string) => Promise<void>;
  removeUser: (uid: string) => Promise<void>;
  addUser: (email: string, pass: string) => Promise<StoredUser>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

const ACCOUNTS_STORAGE_KEY = 'firebase_accounts';
const ACTIVE_ACCOUNT_STORAGE_KEY = 'firebase_active_account';


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const firestore = useFirestore();
  const auth = getAuth();

  const [accounts, setAccounts] = useState<StoredUser[]>([]);
  const [activeAccount, setActiveAccount] = useState<StoredUser | null>(null);


   useEffect(() => {
    const storedAccounts = JSON.parse(localStorage.getItem(ACCOUNTS_STORAGE_KEY) || '[]') as StoredUser[];
    const storedActiveAccount = JSON.parse(localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY) || 'null') as StoredUser | null;
    setAccounts(storedAccounts);
    setActiveAccount(storedActiveAccount);
  }, []);

  const updateStoredAccounts = (newAccounts: StoredUser[], newActive: StoredUser | null) => {
    setAccounts(newAccounts);
    setActiveAccount(newActive);
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(newAccounts));
    localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, JSON.stringify(newActive));
  }


  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        if (activeAccount && firebaseUser.uid === activeAccount.uid) {
           const userDocRef = doc(firestore, 'users', firebaseUser.uid);
           const docSnap = await getDoc(userDocRef);
           if (docSnap.exists()) {
             setUser({ id: docSnap.id, ...docSnap.data() } as User);
           } else {
             setUser(null);
           }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [auth, firestore, activeAccount]);


  const signIn = async (email: string, pass: string): Promise<void> => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const { user: fbUser } = userCredential;
      const newAccount: StoredUser = { uid: fbUser.uid, email: fbUser.email! };
      
      const existingAccounts = JSON.parse(localStorage.getItem(ACCOUNTS_STORAGE_KEY) || '[]') as StoredUser[];
      const accountExists = existingAccounts.some(acc => acc.uid === newAccount.uid);

      let updatedAccounts = existingAccounts;
      if (!accountExists) {
          updatedAccounts = [...existingAccounts, newAccount];
      }

      updateStoredAccounts(updatedAccounts, newAccount);
      // The onIdTokenChanged listener will handle setting the user state
    } catch (error) {
      console.error("Sign in error", error);
      setLoading(false);
      throw new Error('Nesprávný email nebo heslo.');
    }
  };

  const addUser = async (email: string, pass: string): Promise<StoredUser> => {
    setLoading(true);
    try {
      // First, sign in to add the account without changing the active user.
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const { user: fbUser } = userCredential;

      const newAccount: StoredUser = { uid: fbUser.uid, email: fbUser.email! };
      
      const newAccounts = [...accounts.filter(a => a.uid !== newAccount.uid), newAccount];
      updateStoredAccounts(newAccounts, activeAccount); // Keep current user active
      
      // Immediately sign back in as the original active user to avoid UI flicker
      if (activeAccount) {
          // This requires a password. We'll rely on the user to manually switch back for now
          // or we can prompt for the active user's password.
          // For a simpler UX, we just add the account and let the user switch.
      }
      
      return newAccount;

    } catch (error) {
       console.error("Add user error", error);
       throw new Error('Nepodařilo se přidat účet. Zkontrolujte přihlašovací údaje.');
    } finally {
        setLoading(false);
    }
  };


  const switchUser = async (email: string, pass: string) => {
    // This function will now be the same as signIn, as signInWithEmailAndPassword handles the session switch.
    await signIn(email, pass);
  };
  
  const removeUser = async (uid: string) => {
    const newAccounts = accounts.filter(a => a.uid !== uid);
    if (activeAccount?.uid === uid) {
      const nextUser = newAccounts.length > 0 ? newAccounts[0] : null;
      if (nextUser) {
        // Since we don't store passwords, we can't automatically sign in.
        // We'll sign out and let the user sign in to the next available account.
        await signOut();
        toast({ title: 'Aktivní účet odebrán', description: 'Prosím, přihlaste se znovu.' });
      } else {
        await signOut();
      }
       updateStoredAccounts(newAccounts, null);
    } else {
      updateStoredAccounts(newAccounts, activeAccount);
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    updateStoredAccounts([], null);
    setUser(null);
    router.push('/');
  };

  const hasRole = useCallback((role: Role) => {
    return user?.roles.includes(role) ?? false;
  }, [user]);

  const value = { user, activeAccount, accounts, signIn, signOut, loading, hasRole, switchUser, removeUser, addUser };

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
