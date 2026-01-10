'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { DomaciUkol, User, Trida, Predmet } from '@/lib/types';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import { cs } from 'date-fns/locale';
import { CalendarIcon, PlusCircle, Trash2, BookOpen } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useSearchParams } from 'next/navigation';

const homeworkSchema = z.object({
  tridaId: z.string().min(1, "Vyberte třídu."),
  predmetId: z.string().min(1, "Vyberte předmět."),
  nazev: z.string().min(1, "Název úkolu je povinný."),
  popis: z.string().optional(),
  terminOdevzdani: z.date({ required_error: "Termín odevzdání je povinný." }),
});
type HomeworkFormData = z.infer<typeof homeworkSchema>;

function TeacherHomeworkForm() {
    const { user } = useAuth();
    const firestore = useFirestore();
    const { toast } = useToast();
    const searchParams = useSearchParams();

    // From query params
    const tridaIdParam = searchParams.get('tridaId');
    const predmetIdParam = searchParams.get('predmetId');
    const datumZadaniParam = searchParams.get('datumZadani');

    const { handleSubmit, control, reset, setValue, formState: { errors } } = useForm<HomeworkFormData>({
        resolver: zodResolver(homeworkSchema),
        defaultValues: {
            tridaId: tridaIdParam || '',
            predmetId: predmetIdParam || '',
            nazev: '',
            popis: '',
        }
    });

     useEffect(() => {
        setValue('tridaId', tridaIdParam || '');
        setValue('predmetId', predmetIdParam || '');
        if (datumZadaniParam) {
            // The date for deadline can be set to a week from the assignment date for example
            const deadline = new Date(datumZadaniParam);
            deadline.setDate(deadline.getDate() + 7);
            setValue('terminOdevzdani', deadline);
        }
    }, [tridaIdParam, predmetIdParam, datumZadaniParam, setValue]);

    const teacherClassesQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'tridy'), where('ucitelId', '==', user.id));
    }, [firestore, user]);
    const { data: teacherClasses } = useCollection<Trida>(teacherClassesQuery);
    
    const { data: predmety } = useCollection<Predmet>(useMemoFirebase(() => firestore ? collection(firestore, 'predmety') : null, [firestore]));

    const onSubmit = async (data: HomeworkFormData) => {
        if (!user) return;
        
        const newHomework: Omit<DomaciUkol, 'id'> = {
            ...data,
            ucitelId: user.id,
            datumZadani: format(new Date(), 'yyyy-MM-dd'),
            terminOdevzdani: format(data.terminOdevzdani, 'yyyy-MM-dd'),
        };

        await addDocumentNonBlocking(collection(firestore, 'ukoly'), newHomework);
        toast({ title: 'Domácí úkol zadán', description: `Úkol "${data.nazev}" byl úspěšně zadán.` });
        reset({ tridaId: '', predmetId: '', nazev: '', popis: '' });
    };
    
    return (
         <Card>
            <CardHeader>
                <CardTitle>Zadat nový domácí úkol</CardTitle>
            </CardHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
                <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                         <div className="grid gap-2">
                            <label>Třída</label>
                            <Controller name="tridaId" control={control} render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger><SelectValue placeholder="Vyberte třídu" /></SelectTrigger>
                                    <SelectContent>{teacherClasses?.map(c => <SelectItem key={c.id} value={c.id}>{c.nazev}</SelectItem>)}</SelectContent>
                                </Select>
                            )} />
                             {errors.tridaId && <p className="text-sm text-destructive">{errors.tridaId.message}</p>}
                        </div>
                        <div className="grid gap-2">
                            <label>Předmět</label>
                            <Controller name="predmetId" control={control} render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger><SelectValue placeholder="Vyberte předmět" /></SelectTrigger>
                                    <SelectContent>{predmety?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                </Select>
                            )} />
                            {errors.predmetId && <p className="text-sm text-destructive">{errors.predmetId.message}</p>}
                        </div>
                    </div>
                     <div className="grid gap-2">
                        <label>Název úkolu</label>
                        <Controller name="nazev" control={control} render={({ field }) => <Input {...field} placeholder="Např. Procvičování slovíček" />} />
                        {errors.nazev && <p className="text-sm text-destructive">{errors.nazev.message}</p>}
                    </div>
                    <div className="grid gap-2">
                        <label>Popis a zadání</label>
                        <Controller name="popis" control={control} render={({ field }) => <Textarea {...field} placeholder="Podrobnější popis úkolu..." />} />
                    </div>
                     <div className="grid gap-2">
                        <label>Termín odevzdání</label>
                         <Controller name="terminOdevzdani" control={control} render={({ field }) => (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {field.value ? format(field.value, 'd. M. yyyy') : <span>Vyberte datum</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} locale={cs} /></PopoverContent>
                            </Popover>
                         )} />
                         {errors.terminOdevzdani && <p className="text-sm text-destructive">{errors.terminOdevzdani.message}</p>}
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit"><PlusCircle className="mr-2 h-4 w-4" /> Zadat úkol</Button>
                </CardFooter>
            </form>
        </Card>
    )
}

function HomeworkList() {
    const { user, hasRole } = useAuth();
    const firestore = useFirestore();

    const homeworkQuery = useMemoFirebase(() => {
        if (!firestore || !user?.tridaId) return null;
        return query(collection(firestore, 'ukoly'), where('tridaId', '==', user.tridaId));
    }, [firestore, user?.tridaId]);

    const { data: homework, isLoading } = useCollection<DomaciUkol>(homeworkQuery);
    
    const { data: predmety } = useCollection<Predmet>(useMemoFirebase(() => firestore ? collection(firestore, 'predmety') : null, [firestore]));
    const { data: teachers } = useCollection<User>(useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]));

    const getSubjectName = (id: string) => predmety?.find(p => p.id === id)?.name || 'Neznámý předmět';
    const getTeacherName = (id: string) => teachers?.find(t => t.id === id)?.name || 'Neznámý učitel';
    
    const handleDelete = async (id: string) => {
        if (!firestore) return;
        await deleteDocumentNonBlocking(doc(firestore, 'ukoly', id));
    }
    
    const sortedHomework = useMemo(() => {
        return homework?.sort((a,b) => parseISO(b.datumZadani).getTime() - parseISO(a.datumZadani).getTime());
    }, [homework]);

    if (isLoading) return <p>Načítání úkolů...</p>

    return (
        <Card>
            <CardHeader>
                <CardTitle>Přehled domácích úkolů</CardTitle>
                <CardDescription>Zde najdete všechny zadané úkoly pro vaši třídu.</CardDescription>
            </CardHeader>
            <CardContent>
                {sortedHomework && sortedHomework.length > 0 ? (
                    <Accordion type="single" collapsible className="w-full">
                        {sortedHomework.map(ukol => (
                             <AccordionItem value={ukol.id} key={ukol.id}>
                                <AccordionTrigger>
                                    <div className='flex justify-between items-center w-full pr-4'>
                                        <div className='flex items-center gap-4'>
                                            <BookOpen className="h-5 w-5 text-primary"/>
                                            <div>
                                                <p className="font-semibold text-left">{ukol.nazev}</p>
                                                <p className="text-sm text-muted-foreground text-left">{getSubjectName(ukol.predmetId)}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm">Odevzdat do:</p>
                                            <p className="font-semibold">{format(parseISO(ukol.terminOdevzdani), 'd. M. yyyy')}</p>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pt-2 pb-4 space-y-3">
                                    <p className="whitespace-pre-wrap">{ukol.popis}</p>
                                    <p className="text-xs text-muted-foreground">Zadal: {getTeacherName(ukol.ucitelId)} dne {format(parseISO(ukol.datumZadani), 'd.M.yyyy')}</p>
                                     {hasRole('ucitel') && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" size="sm"><Trash2 className="mr-2 h-4 w-4"/>Smazat úkol</Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Opravdu smazat úkol?</AlertDialogTitle>
                                                    <AlertDialogDescription>Tato akce je nevratná.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Zrušit</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(ukol.id)}>Smazat</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                     )}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                ) : <p>Nejsou zadány žádné úkoly.</p>}
            </CardContent>
        </Card>
    )
}

function UkolyContent() {
    const { hasRole, loading } = useAuth();

    if (loading) {
        return <div>Načítání...</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Domácí úkoly</h1>
            {hasRole('ucitel') && <TeacherHomeworkForm />}
            {(hasRole('ziak') || hasRole('rodic') || hasRole('ucitel')) && <div className="pt-6"><HomeworkList /></div>}
        </div>
    );
}


export default function DomaciUkolyPage() {
    return (
        <React.Suspense fallback={<div>Načítání...</div>}>
            <UkolyContent />
        </React.Suspense>
    )
}
