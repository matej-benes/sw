
'use client';
import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc, Timestamp, documentId, getDoc } from 'firebase/firestore';
import type { Omluvenka, User, Trida, Rozvrh } from '@/lib/types';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parse, differenceInYears, eachDayOfInterval, parseISO } from 'date-fns';
import { cs } from 'date-fns/locale';
import { CalendarIcon, PlusCircle, Check, X, AlertTriangle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const omluvenkaSchema = z.object({
  datum: z.object({ from: z.date(), to: z.date() }),
  duvod: z.string().min(10, 'Důvod je příliš krátký.'),
});
type OmluvenkaFormData = z.infer<typeof omluvenkaSchema>;

function ParentExcuseForm() {
    const { user } = useAuth();
    const firestore = useFirestore();
    const { toast } = useToast();

    const studentRef = useMemoFirebase(() => {
        if (!firestore || !user?.studentId) return null;
        return doc(firestore, 'users', user.studentId);
    }, [firestore, user?.studentId]);
    const { data: student } = useCollection<User>(useMemoFirebase(() => {
        if(!firestore || !user?.studentId) return null;
        return query(collection(firestore, 'users'), where(documentId(), '==', user.studentId));
    }, [firestore, user?.studentId]));

    const { handleSubmit, control, reset, formState: { errors } } = useForm<OmluvenkaFormData>({
        resolver: zodResolver(omluvenkaSchema),
    });

    const onSubmit = async (data: OmluvenkaFormData) => {
        const activeStudent = student?.[0];
        if (!user || !activeStudent?.tridaId) {
            toast({ variant: 'destructive', title: 'Chyba', description: 'Nelze odeslat omluvenku, chybí údaje o studentovi.' });
            return;
        }
        
        const newOmluvenka: Omit<Omluvenka, 'id'> = {
            studentId: activeStudent.id,
            parentId: user.id,
            tridaId: activeStudent.tridaId,
            datumOd: format(data.datum.from, 'yyyy-MM-dd'),
            datumDo: format(data.datum.to, 'yyyy-MM-dd'),
            duvod: data.duvod,
            status: 'pending',
            datumPodani: Timestamp.now(),
            organizationId: activeStudent.organizationId || '',
        };

        await addDocumentNonBlocking(collection(firestore, 'omluvenky'), newOmluvenka);
        toast({ title: 'Omluvenka odeslána' });
        reset();
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Nová omluvenka</CardTitle>
                <CardDescription>Omluvte nepřítomnost žáka: {student?.[0]?.name}</CardDescription>
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
                         {errors.datum && <p className="text-sm text-destructive">Vyberte rozsah datumů.</p>}
                    </div>
                    <div className="grid gap-2">
                        <label>Důvod nepřítomnosti</label>
                        <Controller
                            name="duvod"
                            control={control}
                            render={({ field }) => <Textarea {...field} placeholder="Zadejte důvod..." />}
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

function StudentExcuseForm() {
    const { user } = useAuth();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [age, setAge] = React.useState<number | null>(null);

    React.useEffect(() => {
        if(user?.datumNarozeni) {
            try {
                const birthDate = parse(user.datumNarozeni, 'dd.MM.yyyy', new Date());
                setAge(differenceInYears(new Date(), birthDate));
            } catch (e) { setAge(null); }
        }
    }, [user]);

    const { handleSubmit, control, reset, formState: { errors } } = useForm<OmluvenkaFormData>({
        resolver: zodResolver(omluvenkaSchema),
    });

    const onSubmit = async (data: OmluvenkaFormData) => {
        if (!user || !user.tridaId || !user.organizationId) return;
        const newOmluvenka: Omit<Omluvenka, 'id'> = {
            studentId: user.id,
            tridaId: user.tridaId,
            datumOd: format(data.datum.from, 'yyyy-MM-dd'),
            datumDo: format(data.datum.to, 'yyyy-MM-dd'),
            duvod: data.duvod,
            status: 'pending',
            datumPodani: Timestamp.now(),
            organizationId: user.organizationId,
        };
        await addDocumentNonBlocking(collection(firestore, 'omluvenky'), newOmluvenka);
        toast({ title: 'Omluvenka odeslána' });
        reset();
    };

    if (age === null || age < 13) {
        return (
             <Card>
                <CardHeader className="flex-row items-center gap-4">
                    <AlertTriangle className="h-8 w-8 text-destructive"/>
                    <div>
                        <CardTitle>Zadání omluvenky není možné</CardTitle>
                         <CardDescription>Omluvenku mohou zadávat pouze žáci starší 13 let.</CardDescription>
                    </div>
                </CardHeader>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader><CardTitle>Nová omluvenka</CardTitle></CardHeader>
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
                    </div>
                    <div className="grid gap-2">
                        <label>Důvod</label>
                        <Controller name="duvod" control={control} render={({ field }) => <Textarea {...field} />} />
                    </div>
                </CardContent>
                <CardFooter><Button type="submit">Odeslat</Button></CardFooter>
            </form>
        </Card>
    );
}

function TeacherExcuseManagement() {
    const { user } = useAuth();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [approvingExcuse, setApprovingExcuse] = React.useState<Omluvenka | null>(null);

    const { data: teacherClasses } = useCollection<Trida>(useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'tridy'), where('ucitelId', '==', user.id));
    }, [firestore, user]));

    const classIds = teacherClasses?.map(c => c.id) || [];
    
    const { data: omluvenky } = useCollection<Omluvenka>(useMemoFirebase(() => {
        if (!firestore || classIds.length === 0) return null;
        return query(collection(firestore, 'omluvenky'), where('tridaId', 'in', classIds));
    }, [firestore, classIds]));

    const { data: studentsData } = useCollection<User>(useMemoFirebase(() => {
        if (!firestore || classIds.length === 0) return null;
        return query(collection(firestore, 'users'), where('tridaId', 'in', classIds));
    }, [firestore, classIds]));

    const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
        if (!firestore) return;
        await updateDocumentNonBlocking(doc(firestore, 'omluvenky', id), { status });
        toast({ title: `Omluvenka vyřízena.` });
    };

    const pendingOmluvenky = omluvenky?.filter(o => o.status === 'pending') || [];
    const processedOmluvenky = omluvenky?.filter(o => o.status !== 'pending') || [];

    return (
        <Card>
            <CardHeader><CardTitle>Správa omluvenek</CardTitle></CardHeader>
            <CardContent>
                <Tabs defaultValue="pending">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="pending">Nové ({pendingOmluvenky.length})</TabsTrigger>
                        <TabsTrigger value="processed">Vyřízené</TabsTrigger>
                    </TabsList>
                    <TabsContent value="pending" className="mt-4">
                        <Table>
                            <TableHeader><TableRow><TableHead>Žák</TableHead><TableHead>Datum</TableHead><TableHead className="text-right">Akce</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {pendingOmluvenky.map(o => (
                                    <TableRow key={o.id}>
                                        <TableCell>{studentsData?.find(s => s.id === o.studentId)?.name}</TableCell>
                                        <TableCell>{format(new Date(o.datumOd), 'd.M.')} - {format(new Date(o.datumDo), 'd.M.')}</TableCell>
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
                            <TableHeader><TableRow><TableHead>Žák</TableHead><TableHead>Datum</TableHead><TableHead>Stav</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {processedOmluvenky.map(o => (
                                    <TableRow key={o.id}>
                                        <TableCell>{studentsData?.find(s => s.id === o.studentId)?.name}</TableCell>
                                        <TableCell>{format(new Date(o.datumOd), 'd.M.')} - {format(new Date(o.datumDo), 'd.M.')}</TableCell>
                                        <TableCell><Badge variant={o.status === 'approved' ? 'default' : 'destructive'}>{o.status}</Badge></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}

export default function OmluvenkyPage() {
    const { hasRole, loading } = useAuth();
    if (loading) return <div>Načítání...</div>;
    
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Omluvenky</h1>
            {hasRole('ucitel') ? <TeacherExcuseManagement /> : hasRole('rodic') ? <ParentExcuseForm /> : hasRole('ziak') ? <StudentExcuseForm /> : null}
        </div>
    );
}
