'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

const addAccountSchema = z.object({
  email: z.string().email({ message: 'Prosím zadejte platný email.' }),
  password: z.string().min(1, { message: 'Prosím zadejte heslo.' }),
});

export default function AddProfilePage() {
    const router = useRouter();
    const { addUser } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const isMobile = useIsMobile();

    useEffect(() => {
        if (isMobile === false) { 
            router.replace('/dashboard');
        }
    }, [isMobile, router]);

    const form = useForm<z.infer<typeof addAccountSchema>>({
        resolver: zodResolver(addAccountSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    async function onSubmit(values: z.infer<typeof addAccountSchema>) {
        setIsLoading(true);
        try {
            await addUser(values.email, values.password);
            toast({
                title: 'Účet přidán',
                description: 'Nový účet byl úspěšně přidán do seznamu.',
            });
            router.push('/dashboard/profil/prepnout');
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Chyba při přidávání účtu',
                description: (error as Error).message,
            });
        } finally {
            setIsLoading(false);
        }
    }
    
    if (isMobile === undefined || isMobile === false) {
        return null;
    }


    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Přidat účet</h1>
                    <p className="text-muted-foreground">Přidejte další účet pro rychlé přepínání.</p>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Přihlášení dalšího účtu</CardTitle>
                    <CardDescription>Zadejte přihlašovací údaje existujícího účtu, který chcete přidat.</CardDescription>
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
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? <Loader2 className="animate-spin" /> : 'Přidat účet'}
                        </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    )
}
