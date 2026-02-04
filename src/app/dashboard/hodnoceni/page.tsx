
'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, writeBatch, getDocs, limit, Timestamp, getDoc, documentId, Query as FirestoreQuery, DocumentData } from 'firebase/firestore';
import type { Grading, User, Trida, Predmet } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Pencil, Trash2, Loader2, BarChart2, BookOpen, Star, Type, Award, MoreHorizontal } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
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
import { useSearchParams, useRouter } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const gradingSchema = z.object({
  studentIds: z.array(z.string()).min(1, 'Je třeba vybrat alespoň jednoho žáka.'),
  predmetId: z.string().min(1, 'Předmět je povinný.'),
  znamka: z.coerce.number().min(1).max(5),
  vaha: z.coerce.number().min(0.1).max(10),
  komentar: z.string().optional(),
});

type GradingFormData = z.infer<typeof gradingSchema>;

export default function HodnoceniPage() {
    const { user, loading: userLoading, hasRole, isSuperAdmin, activeStudentId } = useAuth();
    const firestore = useFirestore();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    // --- Component State ---
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingGrading, setEditingGrading] = useState<Grading | null>(null);
    const [deletingGrading, setDeletingGrading] = useState<Grading | null>(null);
    const [selectedClassId, setSelectedClassId] = useState<string | null>(searchParams.get('tridaId'));

    // --- Data States ---
    const [gradings, setGradings] = useState<Grading[]>([]);
    const [gradingsLoading, setGradingsLoading] = useState(true);
    const [teacherClasses, setTeacherClasses] = useState<Trida[]>([]);
    const [classesLoading, setClassesLoading] = useState(true);
    const [students, setStudents] = useState<User[]>([]);
    const [studentsLoading, setStudentsLoading] = useState(true);
    const [predmety, setPredmety] = useState<Predmet[]>([]);
    const [predmetyLoading, setPredmetyLoading] = useState(true);
    const [allTeachers, setAllTeachers] = useState<User[]>([]);
    const [teachersLoading, setTeachersLoading] = useState(true);

    const { register, handleSubmit, control, reset, setValue, watch, formState: { errors } } = useForm<GradingFormData>({
        resolver: zodResolver(gradingSchema),
        defaultValues: { studentIds: [], vaha: 1.0, znamka: 1 }
    });

    const tridaIdFromParams = searchParams.get('tridaId');
    const predmetIdFromParams = searchParams.get('predmetId');
    
    // Fetch classes based on role
    useEffect(() => {
        if (!firestore || !user) {
            setClassesLoading(false);
            return;
        }

        let q: FirestoreQuery<DocumentData> | null = null;
        
        if (hasRole('administrator') && user.organizationId) {
            q = query(collection(firestore, 'tridy'), where('organizationId', '==', user.organizationId));
        } else if (hasRole('ucitel')) {
            q = query(collection(firestore, 'tridy'), where('ucitelId', '==', user.id));
        } else {
             setClassesLoading(false);
             return;
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const results = snapshot.docs.map(doc => ({...doc.data(), id: doc.id})) as Trida[];
            setTeacherClasses(results);
            setClassesLoading(false);
        }, (error) => {
            console.error("Error fetching classes: ", error);
            setClassesLoading(false);
        });
        return () => unsubscribe();
    }, [firestore, user, hasRole]);
    
    // Fetch subjects
    useEffect(() => {
        if (!firestore || !user) {
            setPredmetyLoading(false);
            return;
        }
        
        let q;
        if (isSuperAdmin()) {
            q = query(collection(firestore, 'predmety'));
        } else if (user.organizationId) {
            q = query(collection(firestore, 'predmety'), where('organizationId', '==', user.organizationId));
        } else {
            setPredmety([]);
            setPredmetyLoading(false);
            return;
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const results = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Predmet[];
            setPredmety(results);
            setPredmetyLoading(false);
        }, (error) => {
            console.error("Error fetching subjects: ", error);
            setPredmetyLoading(false);
        });
        return () => unsubscribe();
    }, [firestore, user, isSuperAdmin]);

    // Fetch grades based on role
    useEffect(() => {
        if (!firestore || !user) {
            setGradingsLoading(false);
            return;
        }

        let q: FirestoreQuery | null = null;
        
        if (hasRole('ucitel')) {
             q = query(collection(firestore, 'grades'), where('ucitelId', '==', user.id), limit(50));
        } else if (hasRole('administrator') && user.organizationId) {
            q = query(collection(firestore, 'grades'), where('organizationId', '==', user.organizationId), limit(50));
        } else if (hasRole('ziak') && user.id) {
             q = query(collection(firestore, 'grades'), where('ziakId', '==', user.id));
        } else if (hasRole('rodic') && activeStudentId) {
            q = query(collection(firestore, 'grades'), where('ziakId', '==', activeStudentId));
        } else {
             setGradingsLoading(false);
             return;
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const results = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Grading[];
            setGradings(results);
            setGradingsLoading(false);
        }, (error) => {
            console.error("Error fetching gradings: ", error);
            setGradingsLoading(false);
        });

        return () => unsubscribe();
    }, [firestore, user, hasRole, activeStudentId]);

    // Fetch students when a class is selected
    useEffect(() => {
        if (!firestore || !selectedClassId) {
            setStudentsLoading(false);
            setStudents([]);
            return;
        }
        const q = query(collection(firestore, 'users'), where('tridaId', '==', selectedClassId), where('roles', 'array-contains', 'ziak'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const results = snapshot.docs.map(doc => ({...doc.data(), id: doc.id})) as User[];
            setStudents(results);
            setStudentsLoading(false);
        });
        return () => unsubscribe();
    }, [firestore, selectedClassId]);

    // Fetch all teachers for displaying names
    useEffect(() => {
        if (!firestore) {
            setTeachersLoading(false);
            return;
        }
        const q = query(collection(firestore, 'users'), where('roles', 'array-contains', 'ucitel'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const results = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as User[];
            setAllTeachers(results);
            setTeachersLoading(false);
        });
        return () => unsubscribe();
    }, [firestore]);


    const handleOpenDialog = useCallback((grading: Grading | null) => {
        setEditingGrading(grading);
        if (grading) {
            setValue('studentIds', [grading.ziakId]);
            setValue('predmetId', grading.predmetId);
            setValue('znamka', grading.znamka);
            setValue('vaha', grading.vaha);
            setValue('komentar', grading.komentar || '');
            const studentClassId = students?.find(s => s.id === grading.ziakId)?.tridaId;
            if(studentClassId) {
                setSelectedClassId(studentClassId);
            } else {
                getDoc(doc(firestore, 'users', grading.ziakId)).then(docSnap => {
                    if (docSnap.exists()) {
                        setSelectedClassId(docSnap.data().tridaId || null);
                    }
                });
            }
        } else {
            reset({
                studentIds: [],
                vaha: 1.0,
                znamka: 1,
                predmetId: predmetIdFromParams || '',
                komentar: ''
            });
            if (tridaIdFromParams) {
                setSelectedClassId(tridaIdFromParams);
            }
        }
        setIsDialogOpen(true);
    }, [reset, setValue, tridaIdFromParams, predmetIdFromParams, students, firestore]);


    useEffect(() => {
        if (tridaIdFromParams) {
            setSelectedClassId(tridaIdFromParams);
        } else if (teacherClasses && teacherClasses.length > 0 && !selectedClassId) {
            setSelectedClassId(teacherClasses[0].id);
        }
    }, [teacherClasses, selectedClassId, tridaIdFromParams]);
    
    const handleDelete = async () => {
        if (!deletingGrading || !firestore) return;
        try {
            await deleteDocumentNonBlocking(doc(firestore, 'grades', deletingGrading.id));
            toast({ title: 'Hodnocení smazáno' });
            setDeletingGrading(null);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Chyba', description: 'Nepodařilo se smazat hodnocení.' });
        }
    };
    
    const onSubmit = async (data: GradingFormData) => {
        if (!firestore || !user || !user.organizationId) return;

        const batch = writeBatch(firestore);
        const now = Timestamp.now();
        const selectedPredmet = predmety.find(p => p.id === data.predmetId);

        if (!selectedPredmet) {
            toast({ variant: 'destructive', title: 'Chyba', description: 'Vybraný předmět nebyl nalezen.' });
            return;
        }

        if (editingGrading) {
            const studentData = students.find(s => s.id === editingGrading.ziakId);
            if (!studentData) {
                toast({ variant: 'destructive', title: 'Chyba', description: 'Upravovaný žák nebyl nalezen.'});
                return;
            }
            const gradeRef = doc(firestore, 'grades', editingGrading.id);
            const updatedData = {
                predmetId: data.predmetId,
                predmet: selectedPredmet.name,
                znamka: data.znamka,
                vaha: data.vaha,
                komentar: data.komentar || '',
                updatedAt: now,
            };
            batch.update(gradeRef, updatedData);
        } else {
            for (const studentId of data.studentIds) {
                const studentData = students.find(s => s.id === studentId);
                if (!studentData) continue;

                const gradeData: Omit<Grading, 'id' | 'createdAt'> = {
                    organizationId: user.organizationId,
                    tridaId: studentData.tridaId || '',
                    ziakId: studentId,
                    ziakJmeno: studentData.name,
                    predmetId: data.predmetId,
                    predmet: selectedPredmet.name,
                    znamka: data.znamka,
                    vaha: data.vaha,
                    komentar: data.komentar || '',
                    ucitelId: user.id,
                    datum: format(now.toDate(), 'yyyy-MM-dd'),
                    cas: format(now.toDate(), 'HH:mm'),
                };

                const gradeRef = doc(collection(firestore, 'grades'));
                batch.set(gradeRef, { ...gradeData, createdAt: now });
            }
        }

        try {
            await batch.commit();
            toast({
                title: editingGrading ? 'Hodnocení upraveno' : 'Hodnocení uloženo',
                description: `Změny byly úspěšně uloženy.`,
            });
            setIsDialogOpen(false);
        } catch (e) {
            console.error(e);
            toast({
                variant: 'destructive',
                title: 'Chyba ukládání',
                description: 'Při ukládání hodnocení došlo k chybě.',
            });
        }
    };
    
    // Client-side sorting for teacher/admin view
    const sortedGradings = useMemo(() => {
        if (!gradings) return [];
        return [...gradings].sort((a, b) => {
            const dateA = a.datum ? parseISO(a.datum).getTime() : 0;
            const dateB = b.datum ? parseISO(b.datum).getTime() : 0;
            return dateB - dateA;
        });
    }, [gradings]);


    const isDataLoading = userLoading || gradingsLoading || classesLoading || studentsLoading || predmetyLoading || teachersLoading;

    if (userLoading) {
       return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    
    const showTeacherAdminView = hasRole('ucitel') || hasRole('administrator');
    const showStudentParentView = hasRole('ziak') || hasRole('rodic');

    if (showTeacherAdminView) {
        return (
            <div className="p-4 md:p-6 space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold">Klasifikace</h1>
                        <p className="text-muted-foreground">Chronologický přehled zadaného hodnocení.</p>
                    </div>
                     <Button onClick={() => handleOpenDialog(null)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Nové hodnocení
                    </Button>
                </div>

                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Datum</TableHead>
                                    <TableHead>Žák</TableHead>
                                    <TableHead>Předmět</TableHead>
                                    <TableHead>Známka</TableHead>
                                    <TableHead>Váha</TableHead>
                                    <TableHead>Komentář</TableHead>
                                    <TableHead className="text-right">Akce</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isDataLoading ? (
                                    <TableRow><TableCell colSpan={7} className="text-center h-24">Načítání hodnocení...</TableCell></TableRow>
                                ) : sortedGradings?.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="text-center h-24">Nebylo zadáno žádné hodnocení.</TableCell></TableRow>
                                ) : (
                                    sortedGradings?.map(g => (
                                        <TableRow key={g.id} onClick={() => router.push(`/dashboard/hodnoceni/${g.id}`)} className="cursor-pointer">
                                            <TableCell>{format(parseISO(g.datum), 'd.M.yyyy')}</TableCell>
                                            <TableCell>{g.ziakJmeno}</TableCell>
                                            <TableCell>{g.predmet}</TableCell>
                                            <TableCell className="font-bold text-lg">{g.znamka}</TableCell>
                                            <TableCell>{(typeof g.vaha === 'number' && !isNaN(g.vaha) ? g.vaha : 1.0).toFixed(1)}</TableCell>
                                            <TableCell className="max-w-xs truncate">{g.komentar}</TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleOpenDialog(g)}>
                                                            <Pencil className="mr-2 h-4 w-4" /> Upravit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive" onClick={() => setDeletingGrading(g)}>
                                                            <Trash2 className="mr-2 h-4 w-4" /> Smazat
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
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
                        <DialogHeader><DialogTitle>{editingGrading ? 'Upravit hodnocení' : 'Nové hodnocení'}</DialogTitle></DialogHeader>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="grid gap-2">
                                <Label>Třída</Label>
                                <Select onValueChange={setSelectedClassId} value={selectedClassId || ''} disabled={classesLoading || !!editingGrading}>
                                    <SelectTrigger><SelectValue placeholder="Vyberte třídu" /></SelectTrigger>
                                    <SelectContent>{teacherClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.nazev}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Žáci</Label>
                                <Controller
                                    name="studentIds"
                                    control={control}
                                    render={({ field }) => (
                                        <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
                                            {studentsLoading ? <p>Načítání žáků...</p> : students.map(s => (
                                                <div key={s.id} className="flex items-center gap-2">
                                                    <Checkbox
                                                        id={`student-${s.id}`}
                                                        checked={field.value.includes(s.id)}
                                                        onCheckedChange={(checked) => {
                                                            const newValue = checked ? [...field.value, s.id] : field.value.filter(id => id !== s.id);
                                                            field.onChange(newValue);
                                                        }}
                                                        disabled={!!editingGrading}
                                                    />
                                                    <Label htmlFor={`student-${s.id}`}>{s.name}</Label>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                />
                                {errors.studentIds && <p className="text-sm text-destructive">{errors.studentIds.message}</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Předmět</Label>
                                    <Controller name="predmetId" control={control} render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value} disabled={predmetyLoading || !!editingGrading}><SelectTrigger><SelectValue placeholder="Předmět"/></SelectTrigger><SelectContent>{predmety.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                                    )} />
                                    {errors.predmetId && <p className="text-sm text-destructive">{errors.predmetId.message}</p>}
                                </div>
                                 <div className="grid gap-2">
                                    <Label>Známka</Label>
                                    <Controller name="znamka" control={control} render={({ field }) => (
                                        <Select onValueChange={(val) => field.onChange(Number(val))} value={String(field.value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{[1,2,3,4,5].map(z=><SelectItem key={z} value={String(z)}>{z}</SelectItem>)}</SelectContent></Select>
                                    )} />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label>Váha</Label>
                                <Input type="number" step="0.1" {...register('vaha')} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Komentář</Label>
                                <Textarea {...register('komentar')} />
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button variant="outline">Zrušit</Button></DialogClose>
                                <Button type="submit">Uložit</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
                
                 {deletingGrading && (
                    <AlertDialog open={!!deletingGrading} onOpenChange={() => setDeletingGrading(null)}>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Smazat hodnocení?</AlertDialogTitle><AlertDialogDescription>Tato akce je nevratná.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Zrušit</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Smazat</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                 )}
            </div>
        );
    }
    
     if (showStudentParentView) {
        const gradesBySubject = useMemo(() => {
            if (!gradings) return {};
            return gradings.reduce((acc, g) => {
                if (g && g.predmet) {
                    if (!acc[g.predmet]) acc[g.predmet] = [];
                    acc[g.predmet].push(g);
                }
                return acc;
            }, {} as Record<string, Grading[]>);
        }, [gradings]);

        const subjectAverages = useMemo(() => {
            return Object.keys(gradesBySubject).reduce((acc, subject) => {
                const grades = gradesBySubject[subject];
                const weightedSum = grades.reduce((sum, g) => sum + (g.znamka * (Number.isFinite(g.vaha) ? g.vaha : 1)), 0);
                const totalWeight = grades.reduce((sum, g) => sum + (Number.isFinite(g.vaha) ? g.vaha : 1), 0);
                acc[subject] = totalWeight > 0 ? (weightedSum / totalWeight).toFixed(2) : 'N/A';
                return acc;
            }, {} as Record<string, string>);
        }, [gradesBySubject]);

        return (
            <div className="p-4 md:p-6 space-y-8">
                 <h1 className="text-3xl font-bold">Klasifikace</h1>
                 {isDataLoading ? <div>Načítání známek...</div> : Object.keys(gradesBySubject).length === 0 ? <p>Nebyly nalezeny žádné známky.</p> : Object.keys(gradesBySubject).map(subject => (
                    <Card key={subject}>
                        <CardHeader className="flex flex-row justify-between items-center">
                            <div>
                                <CardTitle>{subject}</CardTitle>
                                <CardDescription>Průměr: {subjectAverages[subject]}</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Datum</TableHead>
                                        <TableHead>Známka</TableHead>
                                        <TableHead>Váha</TableHead>
                                        <TableHead>Komentář</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {gradesBySubject[subject]
                                        .sort((a, b) => parseISO(b.datum).getTime() - parseISO(a.datum).getTime())
                                        .map(g => (
                                        <TableRow key={g.id} onClick={() => router.push(`/dashboard/hodnoceni/${g.id}`)} className="cursor-pointer">
                                            <TableCell>{format(parseISO(g.datum), 'd. M. yyyy')}</TableCell>
                                            <TableCell className="font-bold text-2xl">{g.znamka}</TableCell>
                                            <TableCell>{(Number.isFinite(g.vaha) ? g.vaha : 1.0).toFixed(1)}</TableCell>
                                            <TableCell>{g.komentar}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                 ))}
            </div>
        );
    }

    return <div>Nemáte roli pro zobrazení této stránky.</div>;
}
