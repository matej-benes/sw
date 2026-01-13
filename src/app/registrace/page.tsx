'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
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
import { Loader2, ShieldCheck, KeyRound, User, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, writeBatch, setDoc, collection, updateDoc, deleteDoc } from 'firebase/firestore';
import type { User as AppUser } from '@/lib/types';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

const pinSchema = z.object({
  pin: z.string().length(6, 'PIN musí mít 6 číslic.'),
});

const passwordSchema = z.object({
    password: z.string().min(6, 'Heslo musí mít alespoň 6 znaků.'),
    confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
    message: "Hesla se neshodují.",
    path: ["confirmPassword"],
});

type PinFormValues = z.infer<typeof pinSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function RegistrationPage() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [verifiedUser, setVerifiedUser] = useState<AppUser | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const auth = getAuth();

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || step !== 1) return null;
    return collection(firestore, 'users');
  }, [firestore, step]);
  const { data: allUsers, isLoading: usersLoading } = useCollection<AppUser>(usersQuery);

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

    if (!allUsers) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Nepodařilo se načíst uživatelská data. Zkuste to prosím znovu.' });
      setIsLoading(false);
      return;
    }

    const user = allUsers.find(u => u.pin === data.pin);
    
    if (user) {
        setVerifiedUser(user);
        setStep(2);
    } else {
        toast({ variant: 'destructive', title: 'Chyba ověření', description: 'Zadaný PIN nebyl nalezen nebo je nesprávný.' });
    }
    
    setIsLoading(false);
  };

  const onPasswordSubmit = async (data: PasswordFormValues) => {
    if (!verifiedUser || !verifiedUser.email || !verifiedUser.id) return;
    setIsLoading(true);

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, verifiedUser.email, data.password);
        const firebaseUser = userCredential.user;

        const batch = writeBatch(firestore);

        // Reference to the new, final user document with the correct ID (from Auth)
        const newUserDocRef = doc(firestore, 'users', firebaseUser.uid);
        
        // Data for the new document (excluding PIN)
        const finalUserData = { ...verifiedUser };
        delete (finalUserData as any).pin; // Ensure PIN is not copied
        finalUserData.id = firebaseUser.uid; // Set the correct ID

        batch.set(newUserDocRef, finalUserData);

        // Reference to the old, temporary document with the random ID
        const oldUserDocRef = doc(firestore, 'users', verifiedUser.id);
        batch.delete(oldUserDocRef); // Delete the temporary document

        await batch.commit();

        setStep(3);
        
        setTimeout(() => {
             router.replace('/');
        }, 3000);

    } catch (error: any) {
        let description = 'Při vytváření účtu došlo k chybě.';
        if (error.code === 'auth/email-already-in-use') {
            description = 'Tento e-mailový účet již existuje. Pokud jste již registrováni, přihlaste se na hlavní stránce.';
        }
        console.error(error);
        toast({ variant: 'destructive', title: 'Chyba registrace', description });
        setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <form onSubmit={handleSubmitPin(onPinSubmit)}>
            <CardHeader className="text-center">
                <Logo className="mx-auto h-12 w-12 text-primary" />
                <CardTitle className="mt-4 text-2xl">První přihlášení</CardTitle>
                <CardDescription>Zadejte svůj 6-místný registrační PIN, který vám byl přidělen.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="pin">Registrační PIN</Label>
                <Input id="pin" type="text" {...registerPin('pin')} disabled={isLoading || usersLoading} />
                {pinErrors.pin && <p className="text-sm text-destructive">{pinErrors.pin.message}</p>}
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading || usersLoading}>
                {isLoading || usersLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Ověřit PIN
              </Button>
            </CardFooter>
          </form>
        );
      case 2:
        return (
           <form onSubmit={handleSubmitPassword(onPasswordSubmit)}>
             <CardHeader className="text-center">
                <User className="mx-auto h-12 w-12 text-primary" />
                <CardTitle className="mt-4 text-2xl">Ověření a nastavení hesla</CardTitle>
                <CardDescription>Zkontrolujte své údaje a nastavte si bezpečné heslo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="rounded-md border bg-muted/50 p-4 text-center">
                    <p className="text-sm text-muted-foreground">Vítejte,</p>
                    <p className="font-semibold text-lg">{verifiedUser?.name}</p>
                    <p className="text-sm text-muted-foreground">{verifiedUser?.email}</p>
                </div>
              <div className="space-y-1">
                <Label htmlFor="password">Nové heslo</Label>
                <Input id="password" type="password" {...registerPassword('password')} disabled={isLoading} />
                 {passwordErrors.password && <p className="text-sm text-destructive">{passwordErrors.password.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirmPassword">Potvrdit nové heslo</Label>
                <Input id="confirmPassword" type="password" {...registerPassword('confirmPassword')} disabled={isLoading} />
                 {passwordErrors.confirmPassword && <p className="text-sm text-destructive">{passwordErrors.confirmPassword.message}</p>}
              </div>
            </CardContent>
            <CardFooter>
               <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Nastavit heslo a dokončit
              </Button>
            </CardFooter>
          </form>
        );
        case 3:
            return (
                <>
                    <CardHeader className="text-center">
                        <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
                        <CardTitle className="mt-4 text-2xl">Registrace dokončena!</CardTitle>
                        <CardDescription>Váš účet byl úspěšně vytvořen. Nyní budete přesměrováni na přihlašovací stránku.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                    </CardContent>
                </>
            );
      default:
        return null;
    }
  };

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">{renderStep()}</Card>
    </main>
  );
}
