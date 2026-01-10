'use client';
import React, { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc, Timestamp } from 'firebase/firestore';
import type { Omluvenka, User, Trida } from '@/lib/types';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { CalendarIcon, PlusCircle, Check, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { DateRange } from 'react-day-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const omluvenkaSchema = z.object({
  datum: z.object({ from: z.date(), to: z.date() }),
  duvod: z.string().min(10, 'Důvod je příliš krátký.'),
});
type OmluvenkaFormData = z.infer<typeof omluvenkaSchema>;

function ParentExcuseForm() {
    const { user } = useAuth();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { handleSubmit, control, reset, formState: { errors } } = useForm<OmluvenkaFormData>({
        resolver: zodResolver(omluvenkaSchema),
    });

    const onSubmit = async (data: OmluvenkaFormData) => {
        if (!user || !user.studentId || !user.tridaId) {
            toast({ variant: 'destructive', title: 'Chyba', description: 'Nelze odeslat omluvenku, chybí údaje o studentovi.' });
            return;
        }
        
        const newOmluvenka: Omit<Omluvenka, 'id'> = {
            studentId: user.studentId,
            parentId: user.id,
            tridaId: user.tridaId,
            datumOd: format(data.datum.from, 'yyyy-MM-dd'),
            datumDo: format(data.datum.to, 'yyyy-MM-dd'),
            duvod: data.duvod,
            status: 'pending',
            datumPodani: Timestamp.now(),
        };

        await addDocumentNonBlocking(collection(firestore, 'omluvenky'), newOmluvenka);
        toast({ title: 'Omluvenka odeslána', description: 'Vaše žádost o omluvení byla odeslána třídnímu učiteli.' });
        reset();
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Nová omluvenka</CardTitle>
                <CardDescription>Zde můžete omluvit nepřítomnost svého dítěte.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <label>Datum nepřítomnosti</label>
                        <Controller
                            name="datum"
                            control={control}
                            render={({ field }) => (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {field.value?.from ? (
                                                field.value.to ? `${format(field.value.from, 'd.M.y')} - ${format(field.value.to, 'd.M.y')}` : format(field.value.from, 'd.M.y')
                                            ) : <span>Vyberte rozsah</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="range" selected={field.value} onSelect={field.onChange} locale={cs} />
                                    </PopoverContent>
                                </Popover>
                            )}
                        />
                         {errors.datum && <p className="text-sm text-destructive">Musíte vybrat rozsah datumů.</p>}
                    </div>
                    <div className="grid gap-2">
                        <label>Důvod nepřítomnosti</label>
                        <Controller
                            name="duvod"
                            control={control}
                            render={({ field }) => <Textarea {...field} placeholder="Např. z důvodu nemoci..." />}
                        />
                         {errors.duvod && <p className="text-sm text-destructive">{errors.duvod.message}</p>}
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit"><PlusCircle className="mr-2 h-4 w-4" /> Odeslat omluvenku</Button>
                </CardFooter>
            </form>
        </Card>
    );
}

function TeacherExcuseManagement() {
    const { user } = useAuth();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const teacherClassesQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'tridy'), where('ucitelId', '==', user.id));
    }, [firestore, user]);
    const { data: teacherClasses } = useCollection<Trida>(teacherClassesQuery);
    const teacherClassIds = useMemo(() => teacherClasses?.map(c => c.id) || [], [teacherClasses]);
    
    const omluvenkyQuery = useMemoFirebase(() => {
        if (!firestore || !teacherClassIds || teacherClassIds.length === 0) return null;
        return query(collection(firestore, 'omluvenky'), where('tridaId', 'in', teacherClassIds));
    }, [firestore, teacherClassIds]);
    const { data: omluvenky, isLoading: omluvenkyLoading } = useCollection<Omluvenka>(omluvenkyQuery);

    const { data: studentsData, isLoading: studentsLoading } = useCollection<User>(useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('roles', 'array-contains', 'ziak'));
    }, [firestore]));

    const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
        if (!firestore) return;
        await updateDocumentNonBlocking(doc(firestore, 'omluvenky', id), { status });
        toast({ title: `Omluvenka ${status === 'approved' ? 'schválena' : 'zamítnuta'}.` });
    };
    
    const getStudentName = (id: string) => studentsData?.find(s => s.id === id)?.name || 'Neznámý žák';

    const pendingOmluvenky = useMemo(() => omluvenky?.filter(o => o.status === 'pending') || [], [omluvenky]);
    const processedOmluvenky = useMemo(() => omluvenky?.filter(o => o.status !== 'pending') || [], [omluvenky]);
    
    const isLoading = omluvenkyLoading || studentsLoading;

    const statusBadge = (status: 'pending' | 'approved' | 'rejected') => {
        switch (status) {
            case 'approved': return <Badge variant="default" className="bg-green-500">Schváleno</Badge>;
            case 'rejected': return <Badge variant="destructive">Zamítnuto</Badge>;
            case 'pending': return <Badge variant="secondary">Čeká na vyřízení</Badge>;
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Správa omluvenek</CardTitle>
                <CardDescription>Přehled omluvenek od rodičů pro vaše třídy.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="pending">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="pending">Nové žádosti ({pendingOmluvenky.length})</TabsTrigger>
                        <TabsTrigger value="processed">Vyřízené</TabsTrigger>
                    </TabsList>
                    <TabsContent value="pending" className="mt-4">
                        <Table>
                             <TableHeader>
                                <TableRow>
                                    <TableHead>Žák</TableHead>
                                    <TableHead>Datum</TableHead>
                                    <TableHead>Důvod</TableHead>
                                    <TableHead className="text-right">Akce</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? <TableRow><TableCell colSpan={4}>Načítání...</TableCell></TableRow> : null}
                                {!isLoading && pendingOmluvenky.map(o => (
                                    <TableRow key={o.id}>
                                        <TableCell>{getStudentName(o.studentId)}</TableCell>
                                        <TableCell>{format(new Date(o.datumOd), 'd.M.y')} - {format(new Date(o.datumDo), 'd.M.y')}</TableCell>
                                        <TableCell className="max-w-xs truncate">{o.duvod}</TableCell>
                                        <TableCell className="text-right">
                                            <Button size="icon" variant="ghost" onClick={() => handleUpdateStatus(o.id, 'approved')} className="text-green-600"><Check className="h-4 w-4" /></Button>
                                            <Button size="icon" variant="ghost" onClick={() => handleUpdateStatus(o.id, 'rejected')} className="text-red-600"><X className="h-4 w-4" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TabsContent>
                     <TabsContent value="processed" className="mt-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Žák</TableHead>
                                    <TableHead>Datum</TableHead>
                                    <TableHead>Stav</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                {processedOmluvenky.map(o => (
                                    <TableRow key={o.id}>
                                        <TableCell>{getStudentName(o.studentId)}</TableCell>
                                        <TableCell>{format(new Date(o.datumOd), 'd.M.y')} - {format(new Date(o.datumDo), 'd.M.y')}</TableCell>
                                        <TableCell>{statusBadge(o.status)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    )
}

export default function OmluvenkyPage() {
    const { hasRole, loading } = useAuth();

    if (loading) {
        return <div>Načítání...</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Omluvenky</h1>
            {hasRole('rodic') && <ParentExcuseForm />}
            {(hasRole('ucitel') || hasRole('administrator')) && <TeacherExcuseManagement />}
            {(!hasRole('rodic') && !hasRole('ucitel') && !hasRole('administrator')) && (
                 <Card>
                    <CardHeader><CardTitle>Žádný obsah</CardTitle></CardHeader>
                    <CardContent><p>Tato stránka je určena pro rodiče a učitele.</p></CardContent>
                </Card>
            )}
        </div>
    );
}
