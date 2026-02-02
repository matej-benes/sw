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
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { getAuth, updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';

const passwordSchema = z
  .object({
    password: z.string().min(6, 'Heslo musí mít alespoň 6 znaků.'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Hesla se neshodují.',
    path: ['confirmPassword'],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function SetPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, loading: authLoading } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordFormValues>({ resolver: zodResolver(passwordSchema) });

  const onPasswordSubmit = async (data: PasswordFormValues) => {
    setIsLoading(true);
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Chyba',
        description: 'Uživatel není přihlášen nebo databáze není dostupná.',
      });
      setIsLoading(false);
      return;
    }

    try {
      // 1. Update Firebase Auth password
      await updatePassword(currentUser, data.password);

      // 2. Clear the pin in Firestore
      const userRef = doc(firestore, 'users', currentUser.uid);
      await updateDoc(userRef, { pin: null });

      toast({
        title: 'Heslo úspěšně změněno!',
        description: 'Nyní budete přesměrováni na nástěnku.',
      });

      // The AuthProvider will detect the change and redirect automatically.
      // A small delay can make the UX smoother.
      setTimeout(() => router.replace('/dashboard'), 500);
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast({ variant: 'destructive', title: 'Chyba', description: 'Při změně hesla došlo k chybě. Zkuste se přihlásit znovu.' });
      setIsLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Logo className="h-24 w-24 animate-boot-pulse text-primary" />
      </div>
    );
  }

  return (
    <main className="flex h-screen w-full items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <form onSubmit={handleSubmit(onPasswordSubmit)}>
          <CardHeader className="text-center">
            <Logo className="mx-auto h-12 w-12 text-primary" />
            <CardTitle className="mt-4 text-2xl">Nastavení nového hesla</CardTitle>
            <CardDescription>
              Vítejte, {user.name}. Z bezpečnostních důvodů si prosím nastavte své vlastní heslo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="password">Nové heslo</Label>
              <Input
                id="password"
                type="password"
                {...register('password')}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirmPassword">Potvrzení hesla</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...register('confirmPassword')}
                disabled={isLoading}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Nastavit heslo a pokračovat
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
