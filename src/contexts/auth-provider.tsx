'use client';

import type { User, Role } from '@/lib/types';
import { useRouter, usePathname } from 'next/navigation';
import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useFirestore } from '@/firebase';
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
  activeAccount: StoredUser | null;
  accounts: StoredUser[];
  signIn: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
  hasRole: (role: Role) => boolean;
  switchUser: (email: string, pass: string) => Promise<void>;
  removeUser: (uid: string) => Promise<void>;
  addUser: (email: string, pass: string) => Promise<void>;
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
    try {
        const storedAccounts = JSON.parse(localStorage.getItem(ACCOUNTS_STORAGE_KEY) || '[]') as StoredUser[];
        const storedActiveAccount = JSON.parse(localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY) || 'null') as StoredUser | null;
        setAccounts(storedAccounts);
        setActiveAccount(storedActiveAccount);
    } catch (e) {
        console.error("Failed to parse auth data from localStorage", e);
    }
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
           const userDocRef = doc(firestore, 'users', firebaseUser.uid);
           const docSnap = await getDoc(userDocRef);
           if (docSnap.exists()) {
             setUser({ id: docSnap.id, ...docSnap.data() } as User);
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
      // The onIdTokenChanged listener will handle setting the user state.
    } catch (error) {
      console.error("Sign in error", error);
      setLoading(false);
      throw new Error('Nesprávný email nebo heslo.');
    }
  };

  const addUser = async (email: string, pass: string): Promise<void> => {
    setLoading(true);
    const originalUser = auth.currentUser;

    try {
      // Temporarily sign out to not confuse the state
      if (originalUser) {
        await firebaseSignOut(auth);
      }
      
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const { user: fbUser } = userCredential;
      
      const newAccount: StoredUser = { uid: fbUser.uid, email: fbUser.email! };
      const currentAccounts = JSON.parse(localStorage.getItem(ACCOUNTS_STORAGE_KEY) || '[]') as StoredUser[];
      
      if (!currentAccounts.some(acc => acc.uid === newAccount.uid)) {
        const newAccounts = [...currentAccounts, newAccount];
        localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(newAccounts));
        setAccounts(newAccounts);
      }

    } catch (error) {
       console.error("Add user error", error);
       throw new Error('Nepodařilo se přidat účet. Zkontrolujte přihlašovací údaje.');
    } finally {
        // IMPORTANT: Sign out the newly added user and let the app go back to a logged-out state.
        // The user will then need to log in again or switch. This prevents state confusion.
        await firebaseSignOut(auth);
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
      // If we remove the active account, we must sign out completely.
      await signOut();
      updateStoredAccounts([], null);
      toast({ title: 'Aktivní účet odebrán', description: 'Prosím, přihlaste se znovu.' });
    } else {
      // Just remove from the list if it's not the active one.
      updateStoredAccounts(newAccounts, activeAccount);
      toast({ title: 'Účet odebrán ze seznamu.'});
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
