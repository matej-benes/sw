'use client'
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import type { Grading, User, Trida, Predmet } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Pencil, Trash2, Loader2, BarChart2 } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSearchParams } from 'next/navigation';


const gradingSchema = z.object({
  ziakId: z.string().min(1, 'Žák je povinný.'),
  predmetId: z.string().min(1, 'Předmět je povinný.'),
  znamka: z.coerce.number().min(1).max(5),
  vaha: z.coerce.number().min(0.1).max(10),
  komentar: z.string().optional(),
});

type GradingFormData = z.infer<typeof gradingSchema>;

function TeacherView() {
    const { user } = useAuth();
    const firestore = useFirestore();
    const { toast } = useToast();
    const searchParams = useSearchParams();

    const [gradings, setGradings] = useState<Grading[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingGrading, setEditingGrading] = useState<Grading | null>(null);
    const [deletingGrading, setDeletingGrading] = useState<Grading | null>(null);

    const { data: students, isLoading: studentsLoading } = useCollection<User>(useMemoFirebase(() => firestore ? query(collection(firestore, 'users'), where('roles', 'array-contains', 'ziak')) : null, [firestore]));
    const { data: predmety, isLoading: predmetyLoading } = useCollection<Predmet>(useMemoFirebase(() => firestore ? collection(firestore, 'predmety') : null, [firestore]));


    const { register, handleSubmit, control, reset, setValue, formState: { errors } } = useForm<GradingFormData>({
        resolver: zodResolver(gradingSchema),
        defaultValues: { vaha: 1.0 }
    });
    
    // Check for query params to pre-fill the form
    useEffect(() => {
        const tridaIdParam = searchParams.get('tridaId');
        const predmetIdParam = searchParams.get('predmetId');
        if (tridaIdParam && predmetIdParam) {
            handleOpenDialog(null); // Open a new dialog
            setValue('predmetId', predmetIdParam);
            // We don't have ziakId from params, so user still needs to select it
        }
    }, [searchParams, setValue]);

    useEffect(() => {
        if (!user || !firestore) return;
        setIsLoading(true);
        const q = query(collection(firestore, 'gradings'), where('ucitelId', '==', user.id), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grading));
            setGradings(data);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching gradings: ", error);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [user, firestore]);

    const handleOpenDialog = useCallback((grading: Grading | null) => {
        setEditingGrading(grading);
        if (grading) {
            setValue('ziakId', grading.ziakId);
            setValue('predmetId', grading.predmetId);
            setValue('znamka', grading.znamka);
            setValue('vaha', grading.vaha);
            setValue('komentar', grading.komentar);
        } else {
            reset({ vaha: 1.0, znamka: 1, predmetId: searchParams.get('predmetId') || '', ziakId: '', komentar: '' });
        }
        setIsDialogOpen(true);
    }, [reset, setValue, searchParams]);

    const handleSaveGrading = async (data: GradingFormData) => {
        if (!user || !firestore) return;
        const student = students?.find(s => s.id === data.ziakId);
        const predmet = predmety?.find(p => p.id === data.predmetId);
        if (!student || !predmet) {
            toast({ variant: 'destructive', title: 'Chyba', description: 'Vybraný žák nebo předmět nebyl nalezen.' });
            return;
        }

        const gradingData = {
            ...data,
            datum: format(new Date(), 'dd.MM.yyyy'),
            cas: format(new Date(), 'HH:mm'),
            ziakJmeno: student.name,
            predmet: predmet.name, // Store subject name for display
            ucitelId: user.id,
            createdAt: serverTimestamp(),
        };

        try {
            if (editingGrading) {
                await updateDocumentNonBlocking(doc(firestore, 'gradings', editingGrading.id), gradingData);
                toast({ title: 'Hodnocení upraveno', description: 'Změny byly úspěšně uloženy.' });
            } else {
                await addDocumentNonBlocking(collection(firestore, 'gradings'), gradingData);
                toast({ title: 'Hodnocení přidáno', description: 'Nové hodnocení bylo úspěšně uloženo.' });
            }
            setIsDialogOpen(false);
        } catch (error) {
            console.error("Error saving grading: ", error);
            toast({ variant: 'destructive', title: 'Chyba', description: 'Nepodařilo se uložit hodnocení.' });
        }
    };

    const handleDeleteGrading = async () => {
        if (!deletingGrading || !firestore) return;
        try {
            await deleteDocumentNonBlocking(doc(firestore, 'gradings', deletingGrading.id));
            toast({ title: 'Hodnocení smazáno' });
            setDeletingGrading(null);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Chyba při mazání' });
        }
    }
    
    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Klasifikace</h1>
                    <p className="text-muted-foreground">Chronologický přehled zadaného hodnocení.</p>
                </div>
                <Button onClick={() => handleOpenDialog(null)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Nové hodnocení
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Datum</TableHead>
                                <TableHead>Čas</TableHead>
                                <TableHead>Žák</TableHead>
                                <TableHead>Předmět</TableHead>
                                <TableHead>Známka</TableHead>
                                <TableHead>Váha</TableHead>
                                <TableHead>Komentář</TableHead>
                                <TableHead className="text-right">Akce</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={8} className="text-center h-24">Načítání hodnocení...</TableCell></TableRow>
                            ) : gradings.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="text-center h-24">Nebylo zadáno žádné hodnocení.</TableCell></TableRow>
                            ) : (
                                gradings.map(g => (
                                    <TableRow key={g.id}>
                                        <TableCell>{g.datum}</TableCell>
                                        <TableCell>{g.cas}</TableCell>
                                        <TableCell>{g.ziakJmeno}</TableCell>
                                        <TableCell>{g.predmet}</TableCell>
                                        <TableCell className="font-bold text-lg">{g.znamka}</TableCell>
                                        <TableCell>{g.vaha.toFixed(1)}</TableCell>
                                        <TableCell className="max-w-xs truncate">{g.komentar}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(g)}><Pencil className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" onClick={() => setDeletingGrading(g)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingGrading ? 'Upravit hodnocení' : 'Nové hodnocení'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit(handleSaveGrading)} className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Žák</Label>
                            <Controller name="ziakId" control={control} render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value} disabled={studentsLoading}>
                                    <SelectTrigger><SelectValue placeholder="Vyberte žáka" /></SelectTrigger>
                                    <SelectContent>{students?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                </Select>
                            )} />
                            {errors.ziakId && <p className="text-sm text-destructive">{errors.ziakId.message}</p>}
                        </div>
                        <div className="grid gap-2">
                             <Label>Předmět</Label>
                            <Controller name="predmetId" control={control} render={({ field }) => (
                                 <Select onValueChange={field.onChange} value={field.value} disabled={predmetyLoading}>
                                    <SelectTrigger><SelectValue placeholder="Vyberte předmět" /></SelectTrigger>
                                    <SelectContent>{predmety?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                </Select>
                            )} />
                             {errors.predmetId && <p className="text-sm text-destructive">{errors.predmetId.message}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Známka</Label>
                                <Controller name="znamka" control={control} render={({ field }) => (
                                    <Select onValueChange={(val) => field.onChange(Number(val))} value={String(field.value)}>
                                        <SelectTrigger><SelectValue placeholder="Známka" /></SelectTrigger>
                                        <SelectContent>{[1, 2, 3, 4, 5].map(z => <SelectItem key={z} value={String(z)}>{z}</SelectItem>)}</SelectContent>
                                    </Select>
                                )} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Váha</Label>
                                <Controller name="vaha" control={control} render={({ field }) => <Input type="number" step="0.1" {...field} />} />
                                {errors.vaha && <p className="text-sm text-destructive">{errors.vaha.message}</p>}
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Komentář</Label>
                            <Controller name="komentar" control={control} render={({ field }) => <Textarea {...field} placeholder="Doplňující komentář..." />} />
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="outline">Zrušit</Button></DialogClose>
                            <Button type="submit">Uložit</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            <AlertDialog open={!!deletingGrading} onOpenChange={() => setDeletingGrading(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Opravdu smazat hodnocení?</AlertDialogTitle><AlertDialogDescription>Tato akce je nevratná.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Zrušit</AlertDialogCancel><AlertDialogAction onClick={handleDeleteGrading}>Smazat</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function StudentParentView() {
    const { user } = useAuth();
    const firestore = useFirestore();
    const [gradings, setGradings] = useState<Grading[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const studentId = user?.roles.includes('ziak') ? user.id : user?.studentId;

    useEffect(() => {
        if (!studentId || !firestore) return;
        setIsLoading(true);
        const q = query(collection(firestore, 'gradings'), where('ziakId', '==', studentId), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grading));
            setGradings(data);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [studentId, firestore]);
    
    const gradesBySubject = useMemo(() => {
        return gradings.reduce((acc, g) => {
            if (!acc[g.predmet]) {
                acc[g.predmet] = [];
            }
            acc[g.predmet].push(g);
            return acc;
        }, {} as Record<string, Grading[]>);
    }, [gradings]);

    const subjectAverages = useMemo(() => {
        return Object.entries(gradesBySubject).map(([predmet, znamky]) => {
            const totalWeight = znamky.reduce((sum, g) => sum + g.vaha, 0);
            const weightedSum = znamky.reduce((sum, g) => sum + g.znamka * g.vaha, 0);
            const average = totalWeight > 0 ? (weightedSum / totalWeight) : 0;
            return {
                predmet,
                average: average.toFixed(2),
                count: znamky.length,
            };
        });
    }, [gradesBySubject]);

    if (isLoading) return <div>Načítání hodnocení...</div>;

    return (
        <div className="p-4 md:p-6 space-y-6">
            <h1 className="text-3xl font-bold">Klasifikace</h1>
            
            <Card>
                <CardHeader>
                    <CardTitle>Průběžné hodnocení</CardTitle>
                    <CardDescription>Seznam všech vašich známek seřazených od nejnovější.</CardDescription>
                </CardHeader>
                <CardContent>
                    {gradings.length === 0 ? <p>Nemáte žádné známky.</p> : (
                        <ul className="space-y-3">
                            {gradings.map(g => (
                                <li key={g.id} className="flex justify-between items-center p-3 border rounded-lg">
                                    <div>
                                        <p className="font-semibold">{g.predmet}</p>
                                        <p className="text-sm text-muted-foreground">{g.komentar || 'Bez komentáře'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-xl">{g.znamka}</p>
                                        <p className="text-xs text-muted-foreground">{g.datum}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Hodnocení podle předmětu</CardTitle>
                    <CardDescription>Souhrnný přehled s váženými průměry.</CardDescription>
                </CardHeader>
                <CardContent>
                     {subjectAverages.length === 0 ? <p>Zatím bez hodnocení.</p> : (
                         <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                             {subjectAverages.map(s => (
                                 <div key={s.predmet} className="flex justify-between items-center p-4 border rounded-lg">
                                      <div>
                                        <p className="font-semibold">{s.predmet}</p>
                                        <p className="text-sm text-muted-foreground">{s.count} známek</p>
                                    </div>
                                    <p className="text-2xl font-bold">{s.average}</p>
                                 </div>
                             ))}
                         </div>
                     )}
                </CardContent>
            </Card>
        </div>
    );
}

function HodnoceniPageContent() {
  const { user, loading, hasRole } = useAuth();
  
  if (loading) return <div className="flex h-full w-full items-center justify-center">Načítání...</div>;
  if (!user) return <div className="flex h-full w-full items-center justify-center">Přístup odepřen.</div>;

  if (hasRole('ucitel') || hasRole('administrator')) {
    return <TeacherView />;
  }

  if (hasRole('ziak') || hasRole('rodic')) {
    return <StudentParentView />;
  }

  return <div>Nemáte roli pro zobrazení této stránky.</div>;
}

export default function HodnoceniPage() {
    return (
        <React.Suspense fallback={<div>Načítání...</div>}>
            <HodnoceniPageContent />
        </React.Suspense>
    );
}
