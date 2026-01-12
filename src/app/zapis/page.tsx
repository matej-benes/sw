'use client';
import React, { useState } from 'react';
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { PrijimaciRizeni } from '@/lib/types';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, differenceInYears } from 'date-fns';
import { cs } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/logo';

const applicationSchema = z.object({
    jmenoDitete: z.string().min(1, 'Jméno dítěte je povinné.'),
    datumNarozeniDitete: z.date({ required_error: 'Datum narození je povinné.' }),
    bydlisteDitete: z.string().min(1, 'Bydliště je povinné.'),
    jmenoZastupce: z.string(),
    emailZastupce: z.string().email('Neplatný formát emailu.'),
    telefonZastupce: z.string(),
}).superRefine((data, ctx) => {
    const age = differenceInYears(new Date(), data.datumNarozeniDitete);
    if (age < 13) {
        if (!data.jmenoZastupce) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Jméno zákonného zástupce je povinné.", path: ['jmenoZastupce'] });
        }
        if (!data.emailZastupce) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Email zákonného zástupce je povinný.", path: ['emailZastupce'] });
        }
        if (!data.telefonZastupce) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Telefon zákonného zástupce je povinný.", path: ['telefonZastupce'] });
        }
    }
});

type ApplicationFormData = z.infer<typeof applicationSchema>;

export default function ZapisPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const { control, handleSubmit, watch, formState: { errors } } = useForm<ApplicationFormData>({
        resolver: zodResolver(applicationSchema),
        defaultValues: {
            jmenoDitete: '',
            bydlisteDitete: '',
            jmenoZastupce: '',
            emailZastupce: '',
            telefonZastupce: '',
        }
    });

    const birthDate = watch('datumNarozeniDitete');
    const age = birthDate ? differenceInYears(new Date(), birthDate) : null;
    const isGuardianRequired = age !== null && age < 13;

    const onSubmit = async (data: ApplicationFormData) => {
        if (!firestore) {
            toast({ variant: 'destructive', title: 'Chyba', description: 'Databáze není dostupná.' });
            return;
        }
        setIsSubmitting(true);
        
        const newApplication: Omit<PrijimaciRizeni, 'id'> = {
            jmenoDitete: data.jmenoDitete,
            datumNarozeniDitete: format(data.datumNarozeniDitete, 'yyyy-MM-dd'),
            bydlisteDitete: data.bydlisteDitete,
            jmenoZastupce: data.jmenoZastupce,
            emailZastupce: data.emailZastupce,
            telefonZastupce: data.telefonZastupce,
            datumPodani: format(new Date(), 'yyyy-MM-dd HH:mm'),
            status: 'Podáno',
        };

        try {
            await addDocumentNonBlocking(collection(firestore, 'prijimaci-rizeni'), newApplication);
            setIsSubmitted(true);
        } catch (error) {
            console.error("Error submitting application: ", error);
            toast({ variant: 'destructive', title: 'Chyba odeslání', description: 'Při odesílání přihlášky došlo k chybě. Zkuste to prosím znovu.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSubmitted) {
        return (
             <main className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
                <Card className="w-full max-w-lg text-center">
                     <CardHeader>
                        <Logo className="mx-auto h-12 w-12 text-primary" />
                        <CardTitle className="mt-4 text-2xl">Přihláška úspěšně odeslána!</CardTitle>
                        <CardDescription>
                            Děkujeme za váš zájem o studium na naší škole. V nejbližší době se vám ozveme s dalšími informacemi o průběhu přijímacího řízení.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <p className="text-sm text-muted-foreground">Stav své přihlášky můžete sledovat ve svém emailu.</p>
                    </CardContent>
                </Card>
            </main>
        )
    }

    return (
        <main className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
            <Card className="w-full max-w-2xl">
                 <CardHeader>
                    <div className="flex items-center gap-4">
                        <Logo className="h-10 w-10 text-primary" />
                        <div>
                             <CardTitle className="text-2xl">Přihláška ke studiu</CardTitle>
                             <CardDescription>Soukromá zábavná a základní škola, Bukovany</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <CardContent className="space-y-6">
                        <div className="space-y-4 rounded-lg border p-4">
                            <h3 className="font-semibold">Údaje o uchazeči</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="jmenoDitete">Jméno a příjmení</Label>
                                    <Input id="jmenoDitete" {...control.register('jmenoDitete')} />
                                    {errors.jmenoDitete && <p className="text-sm text-destructive">{errors.jmenoDitete.message}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Datum narození</Label>
                                     <Controller
                                        name="datumNarozeniDitete"
                                        control={control}
                                        render={({ field }) => (
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {field.value ? format(field.value, 'PPP', { locale: cs }) : <span>Vyberte datum</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={cs} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} />
                                            </PopoverContent>
                                        </Popover>
                                        )}
                                    />
                                    {errors.datumNarozeniDitete && <p className="text-sm text-destructive">{errors.datumNarozeniDitete.message}</p>}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="bydlisteDitete">Adresa trvalého bydliště</Label>
                                <Input id="bydlisteDitete" {...control.register('bydlisteDitete')} placeholder="Ulice, č.p., Město, PSČ" />
                                {errors.bydlisteDitete && <p className="text-sm text-destructive">{errors.bydlisteDitete.message}</p>}
                            </div>
                        </div>
                        
                        <div className="space-y-4 rounded-lg border p-4">
                             <h3 className="font-semibold">Údaje o zákonném zástupci</h3>
                              {isGuardianRequired && <p className="text-sm text-destructive">U uchazečů mladších 13 let je nutné vyplnit údaje o zákonném zástupci.</p>}
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div className="space-y-1.5">
                                    <Label htmlFor="jmenoZastupce">Jméno a příjmení</Label>
                                    <Input id="jmenoZastupce" {...control.register('jmenoZastupce')} />
                                    {errors.jmenoZastupce && <p className="text-sm text-destructive">{errors.jmenoZastupce.message}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="emailZastupce">Kontaktní e-mail</Label>
                                    <Input id="emailZastupce" type="email" {...control.register('emailZastupce')} />
                                    {errors.emailZastupce && <p className="text-sm text-destructive">{errors.emailZastupce.message}</p>}
                                </div>
                                <div className="space-y-1.5 md:col-span-2">
                                    <Label htmlFor="telefonZastupce">Kontaktní telefon</Label>
                                    <Input id="telefonZastupce" {...control.register('telefonZastupce')} />
                                    {errors.telefonZastupce && <p className="text-sm text-destructive">{errors.telefonZastupce.message}</p>}
                                </div>
                            </div>
                        </div>

                    </CardContent>
                    <CardFooter>
                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            <Send className="mr-2 h-4 w-4" />
                            {isSubmitting ? 'Odesílání...' : 'Odeslat přihlášku'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </main>
    );
}
