"use client";

import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { User } from '@/lib/types';
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
    const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<MatrikaFormData>({
        resolver: zodResolver(matriSchema),
        defaultValues: {
            name: user.name.split(' ').slice(1).join(' ') || '',
            prijmeni: user.name.split(' ')[0] || '',
            rodneCislo: user.rodneCislo || '',
            oborVzdelani: user.oborVzdelani || '7901C01 - Základní škola - ZŠ (9 let, denní)',
            tridaId: user.tridaId || '',
            cvtv: user.cvtv || '31',
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
            {/* Top Header Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-4 border rounded-lg">
                <div className="flex flex-col items-center justify-start space-y-2">
                    <Avatar className="w-24 h-24">
                        <AvatarImage src={user.avatarUrl} />
                        <AvatarFallback className="text-3xl">{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <Button variant="link">Vložit fotografii</Button>
                </div>
                <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                    <div className="space-y-1">
                        <Label htmlFor="prijmeni">Příjmení</Label>
                        <Input id="prijmeni" {...register('prijmeni')} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="name">Jméno</Label>
                        <Input id="name" {...register('name')} />
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor="rodneCislo">Rodné číslo</Label>
                        <Input id="rodneCislo" {...register('rodneCislo')} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Uživatelské jméno: <span className="text-foreground font-normal">nevytvořeno</span></p>
                        <Button variant="link" className="p-0 h-auto">Založit účet</Button>
                    </div>
                    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
                        <div className="space-y-1 sm:col-span-2">
                           <Label>Škola</Label>
                           <Input value="Základní škola Kvítečkov" readOnly />
                        </div>
                         <div className="space-y-1">
                           <Label>Část školy</Label>
                           <Input value="Část 01" readOnly />
                        </div>
                    </div>
                     <div className="space-y-1">
                        <Label>Obor vzdělání</Label>
                        <Input {...register('oborVzdelani')} readOnly />
                    </div>
                    <div className="flex items-end gap-2">
                        <div className="space-y-1 flex-grow">
                            <Label>Třída</Label>
                            <Input value="II.A (Josef Barcaba)" readOnly />
                        </div>
                         <div className="space-y-1 w-20">
                            <Label>ČVTV</Label>
                            <Input {...register('cvtv')} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs Section */}
             <Tabs defaultValue="prob-vzdelavani">
                <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="prob-vzdelavani">Probíhající vzdělávání</TabsTrigger>
                    <TabsTrigger value="dalsi-vzdelavani">Další vzdělávání</TabsTrigger>
                    <TabsTrigger value="spec-potreby">Speciální vzdělávací potřeby</TabsTrigger>
                    <TabsTrigger value="ucebni-plan">Učební plán</TabsTrigger>
                </TabsList>
                <TabsContent value="prob-vzdelavani" className="p-0">
                    <Tabs defaultValue="osobni-udaje">
                         <TabsList className="grid grid-cols-5 w-full bg-muted/60">
                            <TabsTrigger value="osobni-udaje">Osobní údaje</TabsTrigger>
                            <TabsTrigger value="adresy">Adresy</TabsTrigger>
                            <TabsTrigger value="bankovni-ucet">Bankovní účet</TabsTrigger>
                            <TabsTrigger value="zastupci">Zákonní zástupci</TabsTrigger>
                            <TabsTrigger value="predchozi-vzdelavani">Předchozí vzdělávání</TabsTrigger>
                        </TabsList>
                        <TabsContent value="osobni-udaje" className="border border-t-0 rounded-b-md p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                                <div className="space-y-1">
                                    <Label>Datum narození</Label>
                                    <Controller
                                        name="datumNarozeni"
                                        control={control}
                                        render={({ field }) => (
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {field.value ? format(field.value, 'dd.MM.yyyy') : <span>Vyberte datum</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={cs} />
                                            </PopoverContent>
                                        </Popover>
                                        )}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label>Pohlaví</Label>
                                     <Controller name="pohlavi" control={control} render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Muž">Muž</SelectItem><SelectItem value="Žena">Žena</SelectItem></SelectContent></Select>
                                     )}/>
                                </div>
                                 <div className="flex items-center space-x-2 pt-6">
                                     <Controller name="plnolety" control={control} render={({ field }) => (<Checkbox id="plnolety" checked={field.value} onCheckedChange={field.onChange} />)}/>
                                     <Label htmlFor="plnolety">Plnoletý</Label>
                                </div>
                                <div className="space-y-1">
                                    <Label>Rodné příjmení</Label>
                                    <Input {...register('rodnePrijmeni')}/>
                                </div>
                                <div className="space-y-1">
                                    <Label>Stav</Label>
                                     <Controller name="stav" control={control} render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Aktivní">Aktivní</SelectItem><SelectItem value="Neaktivní">Neaktivní</SelectItem></SelectContent></Select>
                                     )}/>
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
                                 <div className="space-y-1">
                                    <Label>Rodinný stav</Label>
                                    <Controller name="rodinnyStav" control={control} render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Svobodný/Svobodná">Svobodný/Svobodná</SelectItem><SelectItem value="Ženatý/Vdaná">Ženatý/Vdaná</SelectItem><SelectItem value="Rozvedený/Rozvedená">Rozvedený/Rozvedená</SelectItem></SelectContent></Select>
                                    )}/>
                                </div>
                                 <div className="space-y-1">
                                    <Label>Počet dětí</Label>
                                    <Input type="number" {...register('pocetDeti', { valueAsNumber: true })}/>
                                </div>
                                 <div className="space-y-1">
                                    <Label>Číslo OP</Label>
                                    <Input {...register('cisloOP')}/>
                                </div>
                                 <div className="space-y-1">
                                    <Label>Číslo pasu</Label>
                                    <Input {...register('cisloPasu')}/>
                                </div>
                                <div className="space-y-1">
                                    <Label>Osobní e-mail</Label>
                                    <Input {...register('osobniEmail')}/>
                                     {errors.osobniEmail && <p className="text-sm text-destructive">{errors.osobniEmail.message}</p>}
                                </div>
                                <div className="space-y-1">
                                    <Label>Školní e-mail</Label>
                                    <Input {...register('skolniEmail')}/>
                                     {errors.skolniEmail && <p className="text-sm text-destructive">{errors.skolniEmail.message}</p>}
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </TabsContent>
            </Tabs>
             <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Zrušit</Button></DialogClose>
                <Button type="submit">Uložit změny</Button>
            </DialogFooter>
        </form>
    );
}
