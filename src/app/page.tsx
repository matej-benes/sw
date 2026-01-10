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
import { collection, query, where, getDocs, doc, getDoc, writeBatch } from 'firebase/firestore';
import type { User } from '@/lib/types';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';


const loginSchema = z.object({
  email: z.string().email({ message: 'Prosím zadejte platný email.' }),
  password: z.string().min(1, { message: 'Prosím zadejte heslo.' }),
});

const pinSchema = z.object({
  pin: z.string().length(6, { message: 'PIN musí mít 6 znaků.' }),
});

const registrationSchema = z.object({
    email: z.string().email({ message: 'Prosím zadejte platný email.' }),
    password: z.string().min(6, { message: 'Heslo musí mít alespoň 6 znaků.' }),
});

function LoginForm() {
  const { user, signIn, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

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
    const [registrationData, setRegistrationData] = useState<{ userToRegister: User, userWithPin: User, tridaName: string | null } | null>(null);
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
            const q = query(usersRef, where("pin", "==", values.pin));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                toast({ variant: 'destructive', title: 'Chyba', description: 'Neplatný PIN kód.' });
                setIsLoading(false);
                return;
            }

            const userDoc = querySnapshot.docs[0];
            const userWithPin = { id: userDoc.id, ...userDoc.data() } as User;
            let userToRegister: User = userWithPin;

            if (userWithPin.roles.includes('rodic')) {
                 toast({
                    variant: 'destructive',
                    title: 'Nesprávný PIN',
                    description: 'Pro registraci rodičovského účtu zadejte prosím PIN, který patří Vašemu dítěti.'
                });
                setIsLoading(false);
                return;
            }
            
            if (userWithPin.roles.includes('ziak') && userWithPin.studentId) {
                const parentDocRef = doc(firestore, 'users', userWithPin.studentId);
                const parentDoc = await getDoc(parentDocRef);
                if (parentDoc.exists()) {
                    userToRegister = { id: parentDoc.id, ...parentDoc.data() } as User;
                } else {
                     throw new Error("Propojený rodičovský účet nebyl nalezen. Kontaktujte administrátora.");
                }
            }

            let tridaName: string | null = "N/A";
            const classId = userWithPin.tridaId;

            if (classId) {
                const tridaRef = doc(firestore, 'tridy', classId);
                const tridaDoc = await getDoc(tridaRef);
                if (tridaDoc.exists()) {
                    tridaName = tridaDoc.data().nazev;
                }
            }

            setRegistrationData({ userToRegister, userWithPin, tridaName });
            registrationForm.setValue('email', userToRegister.email || '');
            setStep(2);

        } catch (error) {
            console.error("PIN verification error:", error);
            toast({ variant: 'destructive', title: 'Chyba', description: (error as Error).message || 'Při ověřování PINu došlo k chybě.' });
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

        const { userToRegister, userWithPin } = registrationData;

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
            const newFirebaseUser = userCredential.user;
            
            const batch = writeBatch(firestore);

            const finalUserData: User = {
                id: newFirebaseUser.uid,
                name: userToRegister.name,
                email: values.email,
                roles: userToRegister.roles,
                avatarUrl: userToRegister.avatarUrl || `https://picsum.photos/seed/${newFirebaseUser.uid}/100/100`,
                tridaId: userToRegister.roles.includes('ziak') ? userToRegister.tridaId : undefined,
                studentId: userToRegister.roles.includes('rodic') ? userWithPin.id : undefined,
            };

            const newUserDocRef = doc(firestore, 'users', newFirebaseUser.uid);
            batch.set(newUserDocRef, finalUserData);

            // Delete the original pre-registration placeholder user
            const originalUserDocRef = doc(firestore, 'users', userToRegister.id);
            batch.delete(originalUserDocRef);

            // If a student used their PIN to register their parent,
            // we now need to delete the student's PIN user placeholder as well
            if (userToRegister.id !== userWithPin.id) {
                 const studentPinUserRef = doc(firestore, 'users', userWithPin.id);
                 batch.delete(studentPinUserRef);
            }

            // Update student's `tridaId` membership
            if (finalUserData.roles.includes('ziak') && userWithPin.tridaId) {
                const tridaRef = doc(firestore, 'tridy', userWithPin.tridaId);
                const tridaDoc = await getDoc(tridaRef);
                if (tridaDoc.exists()) {
                    const ziaciIds = (tridaDoc.data().ziaciIds || []).filter((id: string) => id !== userWithPin.id);
                    ziaciIds.push(newFirebaseUser.uid);
                    batch.update(tridaRef, { ziaciIds: ziaciIds });
                }
            }

            await batch.commit();

            toast({ title: 'Registrace úspěšná', description: 'Váš účet byl vytvořen, nyní se můžete přihlásit.' });
            onLoginClick();
        } catch (error: any) {
            console.error("Registration error:", error);
            let description = 'Při registraci došlo k chybě.';
            if (error.code === 'auth/email-already-in-use') {
                description = 'Tento e-mail je již používán jiným účtem.';
            } else if (error.code === 'auth/weak-password') {
                description = 'Heslo je příliš slabé. Musí mít alespoň 6 znaků.'
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
                            <p><strong>Jméno:</strong> {registrationData.userToRegister.name}</p>
                            <p><strong>Role:</strong> {registrationData.userToRegister.roles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')}</p>
                             {registrationData.userToRegister.roles.includes('rodic') && (
                                <p><strong>Dítě:</strong> {registrationData.userWithPin.name}</p>
                            )}
                            <p><strong>Třída:</strong> {registrationData.tridaName || 'N/A'}</p>
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
  const router = useRouter();
  const { user, loading } = useAuth();
  
  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);


  if(loading || user) {
     return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-dashed border-primary"></div>
      </div>
    );
  }

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
