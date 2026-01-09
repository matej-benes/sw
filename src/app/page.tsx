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
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import type { User } from '@/lib/types';
import { createUserWithEmailAndPassword } from 'firebase/auth';


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
              <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={isLoading || authLoading}>
                {isLoading || authLoading ? <Loader2 className="animate-spin" /> : 'Přihlásit se'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
  )
}

function RegistrationForm({ onLoginClick }: { onLoginClick: () => void }) {
    const { signIn } = useAuth();
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [registrationData, setRegistrationData] = useState<{ user: User, tridaName: string | null } | null>(null);
    const { toast } = useToast();
    const firestore = useFirestore();

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
            const userData = { ...userDoc.data(), id: userDoc.id } as User;
            
            // For now, we mock the class name
            const tridaName = "4.C";

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

        const { auth } = await import('@/firebase');

        try {
            // Step 1: Create user in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
            const firebaseUser = userCredential.user;

            // Step 2: Update the user document in Firestore with the new Auth UID and remove the PIN
            const userRef = doc(firestore, 'users', registrationData.user.id);
            const userDataToUpdate = {
                ...registrationData.user,
                id: firebaseUser.uid, // This is crucial. Overwriting mock ID with real Auth UID
                email: values.email, // Update email from the form
                pin: '', // Clear the PIN after registration
            };
            
            // We use setDoc here to create a new document with the Auth UID as the ID
            const newDocRef = doc(firestore, 'users', firebaseUser.uid);
            await setDoc(newDocRef, userDataToUpdate);
            
            // Optionally, delete the old document if the ID was different, but here we overwrite
            // For this logic, we assume the user.id from PIN check is the one to be updated/replaced

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
                            <p><strong>Třída:</strong> {registrationData.tridaName || 'Neznámá'}</p>
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
