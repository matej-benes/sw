'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, doc, setDoc, addDoc, getDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import type { User } from '@/lib/types';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';


const loginSchema = z.object({
  email: z.string().email({ message: 'Prosím zadejte platný email.' }),
  password: z.string().min(1, { message: 'Prosím zadejte heslo.' }),
});

const pinSchema = z.object({
  pin: z.string().min(6, { message: 'PIN musí mít 6 znaků.' }).max(6),
});

const registrationSchema = z.object({
    email: z.string().email({ message: 'Prosím zadejte platný email.' }),
    password: z.string().min(6, { message: 'Heslo musí mít alespoň 6 znaků.' }),
});

// Helper function to create/update initial admin user
const createInitialAdminIfNeeded = async (firestore: any) => {
  if (!firestore) return;
  const adminEmail = 'matej.romana@seznam.cz';
  const newPin = '987654';
  const usersRef = collection(firestore, 'users');
  const q = query(usersRef, where("email", "==", adminEmail));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    console.log("Creating initial admin user...");
    const newUserDocRef = doc(usersRef);
    const adminUser: Omit<User, 'id'> & { pin: string } = {
      name: 'Matěj Mikolášek',
      email: adminEmail,
      roles: ['ucitel', 'administrator', 'vedouci pracovnik'],
      pin: newPin,
      avatarUrl: `https://picsum.photos/seed/${newUserDocRef.id}/100/100`,
    };
    await setDoc(newUserDocRef, adminUser);
    console.log("Initial admin user created with PIN:", newPin);
  } else {
    // If admin exists, just update the PIN
    const adminDoc = querySnapshot.docs[0];
    await updateDoc(doc(firestore, 'users', adminDoc.id), { pin: newPin });
  }
};


function LoginForm() {
  const { user, signIn, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const firestore = useFirestore();

  useEffect(() => {
    if (firestore) {
      createInitialAdminIfNeeded(firestore);
    }
  },[firestore]);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

   useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    setIsLoading(true);
    try {
      await signIn(values.email, values.password);
      router.push('/dashboard');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Chyba přihlášení',
        description: (error as Error).message,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Přihlášení</CardTitle>
          <CardDescription>Zadejte své údaje pro vstup do systému.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="vas@email.cz" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Heslo</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading || authLoading}>
                {isLoading || authLoading ? <Loader2 className="animate-spin" /> : 'Přihlásit se'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
  )
}

function RegistrationForm({ onLoginClick }: { onLoginClick: () => void }) {
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [registrationData, setRegistrationData] = useState<{ user: User, tridaName: string | null } | null>(null);
    const { toast } = useToast();
    const firestore = useFirestore();
    const auth = getAuth();

    const pinForm = useForm<z.infer<typeof pinSchema>>({
        resolver: zodResolver(pinSchema),
        defaultValues: { pin: '' },
    });

    const registrationForm = useForm<z.infer<typeof registrationSchema>>({
        resolver: zodResolver(registrationSchema),
        defaultValues: { email: '', password: '' },
    });

    const handlePinSubmit = async (values: z.infer<typeof pinSchema>) => {
        setIsLoading(true);
        if (!firestore) {
            toast({ variant: 'destructive', title: 'Chyba', description: 'Databáze není dostupná.' });
            setIsLoading(false);
            return;
        }

        try {
            const usersRef = collection(firestore, 'users');
            // Look for a user (teacher, admin etc) with that PIN directly.
            let q = query(usersRef, where("pin", "==", values.pin));
            let querySnapshot = await getDocs(q);
            let userDoc;

            if (!querySnapshot.empty) {
                userDoc = querySnapshot.docs[0];
            } else {
                 // If no direct match, it might be a parent registering with a student's PIN.
                 // 1. Find the student with the PIN.
                const studentQuery = query(usersRef, where("roles", "array-contains", "ziak"), where("pin", "==", values.pin));
                const studentSnapshot = await getDocs(studentQuery);

                if (!studentSnapshot.empty) {
                    const student = studentSnapshot.docs[0].data() as User;
                    // 2. Find the parent linked to this student (studentId on parent doc).
                    if (student.id) {
                         const parentQuery = query(usersRef, where("roles", "array-contains", "rodic"), where("studentId", "==", student.id));
                         const parentSnapshot = await getDocs(parentQuery);
                         if (!parentSnapshot.empty) {
                             userDoc = parentSnapshot.docs[0];
                         }
                    }
                }
            }

            if (!userDoc) {
                toast({ variant: 'destructive', title: 'Chyba', description: 'Neplatný PIN kód.' });
                setIsLoading(false);
                return;
            }


            const userData = { ...userDoc.data(), id: userDoc.id } as User;
            
            let tridaName: string | null = "N/A";
            if (userData.tridaId) {
                const tridaRef = doc(firestore, 'tridy', userData.tridaId);
                const tridaDoc = await getDoc(tridaRef);
                if (tridaDoc.exists()) {
                    tridaName = tridaDoc.data().nazev;
                }
            }

            setRegistrationData({ user: userData, tridaName });
            registrationForm.setValue('email', userData.email);
            setStep(2);
            toast({ title: 'PIN ověřen', description: 'Nyní si můžete vytvořit účet.' });

        } catch (error) {
            console.error("PIN verification error:", error);
            toast({ variant: 'destructive', title: 'Chyba', description: 'Při ověřování PINu došlo k chybě.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegistrationSubmit = async (values: z.infer<typeof registrationSchema>) => {
        setIsLoading(true);
        if (!firestore || !registrationData) {
            toast({ variant: 'destructive', title: 'Chyba', description: 'Došlo k neočekávané chybě.' });
            setIsLoading(false);
            return;
        }

        try {
            const batch = writeBatch(firestore);
            
            // 1. Create Firebase Auth user
            const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
            const firebaseUser = userCredential.user;

            // 2. Create the new user document in Firestore with the Firebase Auth UID.
            const newUserDocRef = doc(firestore, 'users', firebaseUser.uid);
            batch.set(newUserDocRef, {
                id: firebaseUser.uid,
                name: registrationData.user.name,
                email: values.email,
                roles: registrationData.user.roles,
                avatarUrl: registrationData.user.avatarUrl || `https://picsum.photos/seed/${firebaseUser.uid}/100/100`,
                tridaId: registrationData.user.tridaId || null,
                studentId: registrationData.user.studentId || null,
            });

            // 3. Delete the original pre-seeded document to prevent duplication.
            const originalUserDocRef = doc(firestore, 'users', registrationData.user.id);
            batch.delete(originalUserDocRef);

            // 4. If the user is a student, we must update the ziaciIds in the trida document with the new UID.
            if (registrationData.user.roles.includes('ziak') && registrationData.user.tridaId) {
                const tridaRef = doc(firestore, 'tridy', registrationData.user.tridaId);
                const tridaDoc = await getDoc(tridaRef);
                if (tridaDoc.exists()) {
                    const ziaciIds = tridaDoc.data().ziaciIds || [];
                    // Remove the old ID and add the new UID
                    const updatedZiaciIds = ziaciIds.filter((id: string) => id !== registrationData.user.id);
                    updatedZiaciIds.push(firebaseUser.uid);
                    batch.update(tridaRef, { ziaciIds: updatedZiaciIds });
                }
            }
            
            await batch.commit();

            toast({ title: 'Registrace úspěšná', description: 'Váš účet byl vytvořen, nyní se můžete přihlásit.' });
            onLoginClick(); // Switch back to login form
        } catch (error: any) {
            console.error("Registration error:", error);
            let description = 'Při registraci došlo k chybě.';
            if (error.code === 'auth/email-already-in-use') {
                description = 'Tento e-mail je již používán jiným účtem.';
            }
            toast({ variant: 'destructive', title: 'Chyba registrace', description });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-sm">
            {step === 1 && (
                <>
                    <CardHeader>
                        <CardTitle>Krok 1: Ověření PINu</CardTitle>
                        <CardDescription>Zadejte PIN kód, který jste obdrželi od školy.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...pinForm}>
                            <form onSubmit={pinForm.handleSubmit(handlePinSubmit)} className="space-y-4">
                                <FormField
                                    control={pinForm.control}
                                    name="pin"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>PIN</FormLabel>
                                            <FormControl>
                                                <Input placeholder="123456" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" className="w-full" disabled={isLoading}>
                                    {isLoading ? <Loader2 className="animate-spin" /> : 'Ověřit PIN'}
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </>
            )}
            {step === 2 && registrationData && (
                 <>
                    <CardHeader>
                        <CardTitle>Krok 2: Registrace</CardTitle>
                        <CardDescription>Vytvořte si svůj účet pro přístup do systému.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-4 rounded-lg border bg-muted/50 p-3 text-sm">
                            <p><strong>Jméno:</strong> {registrationData.user.name}</p>
                            <p><strong>{registrationData.user.tridaId ? 'Třída' : 'Role'}:</strong> {registrationData.user.tridaId ? registrationData.tridaName : "Zaměstnanec školy"}</p>
                        </div>
                        <Form {...registrationForm}>
                            <form onSubmit={registrationForm.handleSubmit(handleRegistrationSubmit)} className="space-y-4">
                                <FormField
                                    control={registrationForm.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email</FormLabel>
                                            <FormControl>
                                                <Input type="email" placeholder="vas@email.cz" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={registrationForm.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Heslo</FormLabel>
                                            <FormControl>
                                                <Input type="password" placeholder="••••••••" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" className="w-full" disabled={isLoading}>
                                    {isLoading ? <Loader2 className="animate-spin" /> : 'Dokončit registraci'}
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </>
            )}
        </Card>
    );
}

export default function LoginPage() {
  const [isRegistering, setIsRegistering] = useState(false);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center justify-center text-center mb-8">
        <Logo className="h-16 w-16 mb-4 text-primary" />
        <h1 className="text-4xl font-bold text-primary">ŠkolaWeb</h1>
        <p className="text-muted-foreground">Vítejte v informačním systému</p>
      </div>
      
      {isRegistering ? <RegistrationForm onLoginClick={() => setIsRegistering(false)} /> : <LoginForm />}

      <Button 
        variant="link" 
        className="mt-6 text-muted-foreground text-center h-auto leading-normal"
        onClick={() => setIsRegistering(!isRegistering)}
        >
        {isRegistering ? 'Už mám účet, chci se přihlásit' : 'Jsem v systému poprvé, mám od školy pin a chci se zaregistrovat.'}
      </Button>
    </main>
  );
}
