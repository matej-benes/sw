"use client";

import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { User, Trida } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format, parse } from 'date-fns';
import { cs } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';


const matriSchema = z.object({
    name: z.string().min(1, "Jméno je povinné"),
    prijmeni: z.string().min(1, "Příjmení je povinné"),
    rodneCislo: z.string().optional(),
    oborVzdelani: z.string().optional(),
    tridaId: z.string().optional(),
    cvtv: z.string().optional(),
    datumNarozeni: z.date().optional(),
    rodnePrijmeni: z.string().optional(),
    mistoNarozeni: z.string().optional(),
    statNarozeni: z.string().optional(),
    pohlavi: z.enum(['Muž', 'Žena']).optional(),
    plnolety: z.boolean().optional(),
    rodinnyStav: z.enum(['Svobodný/Svobodná', 'Ženatý/Vdaná', 'Rozvedený/Rozvedená']).optional(),
    stav: z.enum(['Aktivní', 'Neaktivní']).optional(),
    okresNarozeni: z.string().optional(),
    cisloOP: z.string().optional(),
    pocetDeti: z.number().optional(),
    cisloPasu: z.string().optional(),
    osobniEmail: z.string().email({ message: "Neplatný formát emailu" }).optional().or(z.literal('')),
    skolniEmail: z.string().email({ message: "Neplatný formát emailu" }).optional().or(z.literal('')),
});

type MatrikaFormData = z.infer<typeof matriSchema>;

interface StudentMatrikaProps {
    user: User;
    onSave: (data: Partial<User>) => void;
    closeDialog: () => void;
}

export function StudentMatrika({ user, onSave, closeDialog }: StudentMatrikaProps) {
    const firestore = useFirestore();

    const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<MatrikaFormData>({
        resolver: zodResolver(matriSchema),
        defaultValues: {
            name: user.name.split(' ').slice(1).join(' ') || '',
            prijmeni: user.name.split(' ')[0] || '',
            rodneCislo: user.rodneCislo || '',
            oborVzdelani: user.oborVzdelani || '79-01-C/01 Základní škola',
            tridaId: user.tridaId || '',
            cvtv: user.cvtv || '',
            datumNarozeni: user.datumNarozeni ? parse(user.datumNarozeni, 'dd.MM.yyyy', new Date()) : undefined,
            rodnePrijmeni: user.rodnePrijmeni || '',
            mistoNarozeni: user.mistoNarozeni || '',
            statNarozeni: user.statNarozeni || 'Česká republika',
            pohlavi: user.pohlavi || 'Muž',
            plnolety: user.plnolety || false,
            rodinnyStav: user.rodinnyStav || 'Svobodný/Svobodná',
            stav: user.stav || 'Aktivní',
            okresNarozeni: user.okresNarozeni || '',
            cisloOP: user.cisloOP || '',
            pocetDeti: user.pocetDeti || 0,
            cisloPasu: user.cisloPasu || '',
            osobniEmail: user.osobniEmail || '',
            skolniEmail: user.skolniEmail || '',
        },
    });

    const classRef = useMemoFirebase(() => user.tridaId ? doc(firestore, 'tridy', user.tridaId) : null, [firestore, user.tridaId]);
    const {data: classData} = useDoc<Trida>(classRef);
    
    const onSubmit = (data: MatrikaFormData) => {
        const finalData = {
            ...data,
            name: `${data.prijmeni} ${data.name}`,
            datumNarozeni: data.datumNarozeni ? format(data.datumNarozeni, 'dd.MM.yyyy') : undefined,
        };
        onSave(finalData);
        closeDialog();
    };

    const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Header Section */}
             <div className="flex items-center gap-6 p-4 border rounded-lg bg-muted/20">
                <div className="flex flex-col items-center justify-start space-y-2">
                    <Avatar className="w-24 h-24">
                        <AvatarImage src={user.avatarUrl} />
                        <AvatarFallback className="text-3xl">{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <Button variant="link">Změnit fotografii</Button>
                </div>
                <div className="flex-grow space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label htmlFor="prijmeni">Příjmení</Label>
                            <Input id="prijmeni" {...register('prijmeni')} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="name">Jméno</Label>
                            <Input id="name" {...register('name')} />
                        </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        <p><strong>Škola:</strong> Soukromá zábavná a základní škola, Bukovany</p>
                        <p><strong>Třída:</strong> {classData?.nazev || 'Nepřiřazeno'}</p>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <Tabs defaultValue="osobni-udaje">
                <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="osobni-udaje">Osobní údaje</TabsTrigger>
                    <TabsTrigger value="studium">Studium</TabsTrigger>
                    <TabsTrigger value="adresy">Adresy</TabsTrigger>
                    <TabsTrigger value="zakonni-zastupci">Zákonní zástupci</TabsTrigger>
                </TabsList>
                
                <TabsContent value="osobni-udaje" className="mt-4">
                    <Card>
                        <CardHeader><CardTitle>Základní údaje</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                             <div className="space-y-1">
                                <Label>Datum narození</Label>
                                <Controller
                                    name="datumNarozeni"
                                    control={control}
                                    render={({ field }) => (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {field.value ? format(field.value, 'dd.MM.yyyy') : <span>Vyberte datum</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={cs} /></PopoverContent>
                                    </Popover>
                                    )}
                                />
                            </div>
                             <div className="space-y-1">
                                <Label>Rodné číslo</Label>
                                <Input {...register('rodneCislo')} />
                            </div>
                            <div className="space-y-1">
                                <Label>Rodné příjmení</Label>
                                <Input {...register('rodnePrijmeni')}/>
                            </div>
                             <div className="space-y-1">
                                <Label>Místo narození</Label>
                                <Input {...register('mistoNarozeni')}/>
                            </div>
                            <div className="space-y-1">
                                <Label>Okres narození</Label>
                                <Input {...register('okresNarozeni')}/>
                            </div>
                             <div className="space-y-1">
                                <Label>Stát narození</Label>
                                 <Controller name="statNarozeni" control={control} render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Česká republika">Česká republika</SelectItem><SelectItem value="Slovenská republika">Slovenská republika</SelectItem></SelectContent></Select>
                                 )}/>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="mt-6">
                        <CardHeader><CardTitle>Kontaktní údaje</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                             <div className="space-y-1">
                                <Label>Osobní e-mail</Label>
                                <Input {...register('osobniEmail')}/>
                                 {errors.osobniEmail && <p className="text-sm text-destructive">{errors.osobniEmail.message}</p>}
                            </div>
                            <div className="space-y-1">
                                <Label>Školní e-mail</Label>
                                <Input value={user.email} readOnly/>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                 <TabsContent value="studium" className="mt-4">
                     <Card>
                        <CardHeader><CardTitle>Informace o studiu</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <Label>Stav</Label>
                                <Controller name="stav" control={control} render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Aktivní">Aktivní</SelectItem><SelectItem value="Neaktivní">Neaktivní</SelectItem></SelectContent></Select>
                                )}/>
                            </div>
                            <div className="space-y-1">
                                <Label>Obor vzdělání</Label>
                                <Input {...register('oborVzdelani')} readOnly />
                            </div>
                            <div className="space-y-1">
                                <Label>ČVTV</Label>
                                <Input {...register('cvtv')} />
                            </div>
                        </CardContent>
                     </Card>
                </TabsContent>
                
                 <TabsContent value="adresy" className="mt-4">
                    <Card>
                        <CardHeader><CardTitle>Adresy</CardTitle></CardHeader>
                         <CardContent>
                            <p className="text-muted-foreground">Zde bude správa adres (Trvalá, Kontaktní).</p>
                        </CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="zakonni-zastupci" className="mt-4">
                    <Card>
                        <CardHeader><CardTitle>Zákonní zástupci</CardTitle></CardHeader>
                         <CardContent>
                            <p className="text-muted-foreground">Zde bude správa zákonných zástupců žáka.</p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
             <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Zrušit</Button></DialogClose>
                <Button type="submit">Uložit změny</Button>
            </DialogFooter>
        </form>
    );
}
