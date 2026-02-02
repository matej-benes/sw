'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/logo';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import type { User } from '@/lib/types';
import Link from 'next/link';
import { verifyPinByPin } from '@/ai/flows/verify-pin-by-pin';

const pinSchema = z.object({
  pin: z.string().length(6, 'PIN musí mít 6 číslic.'),
});

const passwordSchema = z
  .object({
    password: z.string().min(6, 'Heslo musí mít alespoň 6 znaků.'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Hesla se neshodují.',
    path: ['confirmPassword'],
  });

type PinFormValues = z.infer<typeof pinSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function RegistrationPage() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [verifiedUser, setVerifiedUser] = useState<User | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();

  const {
    register: registerPin,
    handleSubmit: handleSubmitPin,
    formState: { errors: pinErrors },
  } = useForm<PinFormValues>({ resolver: zodResolver(pinSchema) });

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors },
  } = useForm<PasswordFormValues>({ resolver: zodResolver(passwordSchema) });

  const onPinSubmit = async (data: PinFormValues) => {
    setIsLoading(true);
    try {
      const result = await verifyPinByPin({ pin: data.pin });

      if (!result.user) {
        toast({
          variant: 'destructive',
          title: 'Chyba ověření',
          description: 'Zadaný PIN nebyl nalezen nebo je nesprávný.',
        });
      } else {
        setVerifiedUser(result.user as User);
        setStep(2);
      }
    } catch (error) {
      console.error('Error verifying PIN: ', error);
      toast({
        variant: 'destructive',
        title: 'Chyba',
        description: 'Při ověřování PINu došlo k chybě.',
      });
    }
    setIsLoading(false);
  };

  const onPasswordSubmit = async (data: PasswordFormValues) => {
    if (!verifiedUser?.email || !verifiedUser?.id || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Chyba',
        description: 'Uživatelská data nejsou k dispozici.',
      });
      return;
    }
    setIsLoading(true);

    try {
      const auth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        verifiedUser.email,
        data.password
      );
      
      const tempUserDocRef = doc(firestore, 'users', verifiedUser.id);
      const tempUserSnap = await getDoc(tempUserDocRef);

      if(tempUserSnap.exists()) {
        const userData = tempUserSnap.data();
        // Remove pin and old id from data before creating new doc
        delete (userData as any).pin;
        delete (userData as any).id;
        
        const newUserDocRef = doc(firestore, 'users', userCredential.user.uid);
        await setDoc(newUserDocRef, userData);
        await deleteDoc(tempUserDocRef);

      } else {
        throw new Error("Původní uživatelský dokument nebyl nalezen.");
      }


      toast({
        title: 'Registrace dokončena!',
        description: 'Váš účet byl úspěšně vytvořen. Nyní se můžete přihlásit.',
      });
      router.replace('/');
    } catch (error: any) {
      let description = 'Při vytváření účtu došlo k chybě.';
      if (error.code === 'auth/email-already-in-use') {
        description =
          'Tento e-mailový účet již existuje. Pokud jste již registrováni, přihlaste se na hlavní stránce.';
      }
       console.error("Registration error:", error);
      toast({ variant: 'destructive', title: 'Chyba registrace', description });
    }
    setIsLoading(false);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <form onSubmit={handleSubmitPin(onPinSubmit)}>
            <CardHeader className="text-center">
              <Logo className="mx-auto h-12 w-12 text-primary" />
              <CardTitle className="mt-4 text-2xl">První přihlášení</CardTitle>
              <CardDescription>
                Zadejte svůj 6-místný registrační PIN, který vám byl přidělen.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="pin">Registrační PIN</Label>
                <Input
                  id="pin"
                  type="text"
                  {...registerPin('pin')}
                  disabled={isLoading}
                />
                {pinErrors.pin && (
                  <p className="text-sm text-destructive">
                    {pinErrors.pin.message}
                  </p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                Ověřit PIN
              </Button>
               <Button asChild variant="link" className="w-full">
                  <Link href="/">Zpět na přihlášení</Link>
                </Button>
            </CardFooter>
          </form>
        );
      case 2:
        return (
          <form onSubmit={handleSubmitPassword(onPasswordSubmit)}>
            <CardHeader className="text-center">
              <Logo className="mx-auto h-12 w-12 text-primary" />
              <CardTitle className="mt-4 text-2xl">Nastavení hesla</CardTitle>
              <CardDescription>
                Vytvořte si heslo pro váš účet: {verifiedUser?.email}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="password">Nové heslo</Label>
                <Input
                  id="password"
                  type="password"
                  {...registerPassword('password')}
                  disabled={isLoading}
                />
                {passwordErrors.password && (
                  <p className="text-sm text-destructive">
                    {passwordErrors.password.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirmPassword">Potvrzení hesla</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  {...registerPassword('confirmPassword')}
                  disabled={isLoading}
                />
                {passwordErrors.confirmPassword && (
                  <p className="text-sm text-destructive">
                    {passwordErrors.confirmPassword.message}
                  </p>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Dokončit registraci
              </Button>
            </CardFooter>
          </form>
        );
      default:
        return null;
    }
  };

  return (
    <main className="flex h-screen w-full items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">{renderStep()}</Card>
    </main>
  );
}
