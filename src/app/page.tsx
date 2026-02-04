'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
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
import { Loader2, FileEdit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

const loginSchema = z.object({
  email: z.string().email('Neplatný formát e-mailu'),
  password: z.string().min(1, 'Heslo je povinné'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { user, signIn, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  const onSubmit = async (data: LoginFormValues) => {
    setIsSigningIn(true);
    try {
      await signIn(data.email, data.password);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Chyba přihlášení',
        description: error.message || 'Zkontrolujte prosím své přihlašovací údaje.',
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Logo className="h-24 w-24 animate-boot-pulse text-primary" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <Card>
          <CardHeader className="text-center">
            <Logo className="mx-auto h-12 w-12 text-primary" />
            <CardTitle className="mt-4 text-2xl">Vítejte ve ŠkolaWeb</CardTitle>
            <CardDescription>
              Zadejte své přihlašovací údaje pro vstup do systému.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="jmeno.prijmeni@skola.cz"
                  {...register('email')}
                  disabled={isSigningIn}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="password">Heslo</Label>
                <Input
                  id="password"
                  type="password"
                  {...register('password')}
                  disabled={isSigningIn}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isSigningIn}>
                {isSigningIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Přihlásit se
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Zájemci o studium</CardTitle>
            <CardDescription>
              Ještě u nás nestudujete? Podejte si elektronickou přihlášku.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full bg-background" asChild>
              <Link href="/zapis">
                <FileEdit className="mr-2 h-4 w-4 text-primary" />
                Podat přihlášku ke studiu
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      
      <p className="mt-8 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} ŠkolaWeb. Všechna práva vyhrazena.
      </p>
    </main>
  );
}
