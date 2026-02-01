'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, writeBatch, limit, getDocs, Timestamp, getDoc, documentId, Query } from 'firebase/firestore';
import type { Grading, User, Trida, Predmet } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Pencil, Trash2, Loader2, BarChart2, BookOpen, Star, Type, Award } from 'lucide-react';
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
import { useMemoFirebase } from '@/firebase';


const gradingSchema = z.object({
  studentIds: z.array(z.string()).min(1, 'Je třeba vybrat alespoň jednoho žáka.'),
  predmetId: z.string().min(1, 'Předmět je povinný.'),
  znamka: z.coerce.number().min(1).max(5),
  vaha: z.coerce.number().min(0.1).max(10),
  komentar: z.string().optional(),
});

type GradingFormData = z.infer<typeof gradingSchema>;

export default function HodnoceniPage() {
    const { user, loading: userLoading, hasRole } = useAuth();
    const firestore = useFirestore();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    // --- Component State ---
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingGrading, setEditingGrading] = useState<Grading | null>(null);
    const [deletingGrading, setDeletingGrading] = useState<Grading | null>(null);
    const [selectedClassId, setSelectedClassId] = useState<string | null>(searchParams.get('tridaId'));
    const [gradings, setGradings] = useState<Grading[] | null>(null);
    const [gradingsLoading, setGradingsLoading] = useState(true);

    // --- Data Fetching ---
    const teacherClassesQuery = useMemoFirebase(() => {
        if (!user || !firestore || !hasRole('ucitel')) return null;
        return query(collection(firestore, 'tridy'), where('ucitelId', '==', user.id));
    }, [firestore, user, hasRole]);
    const { data: teacherClasses, isLoading: classesLoading } = useCollection<Trida>(teacherClassesQuery);

    const studentsQuery = useMemoFirebase(() => {
        if (!firestore || !selectedClassId || !(hasRole('ucitel') || hasRole('administrator'))) return null;
        return query(collection(firestore, 'users'), where('tridaId', '==', selectedClassId), where('roles', 'array-contains', 'ziak'));
    }, [firestore, selectedClassId, hasRole]);
    const { data: students, isLoading: studentsLoading } = useCollection<User>(studentsQuery);

    const predmetyQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'predmety');
    }, [firestore]);
    const { data: predmety, isLoading: predmetyLoading } = useCollection<Predmet>(predmetyQuery);

    const { data: allTeachers, isLoading: teachersLoading } = useCollection<User>(useMemoFirebase(() => {
        if(!firestore || !(hasRole('ziak') || hasRole('rodic'))) return null;
        return query(collection(firestore, 'users'), where('roles', 'array-contains', 'ucitel'))
    }, [firestore, hasRole]));

    // --- Manual Data Fetching for Gradings ---
    useEffect(() => {
        if (userLoading || !user || !firestore) {
            return;
        }

        setGradingsLoading(true);

        const isAdmin = hasRole('administrator');
        const isTeacher = hasRole('ucitel');
        const isStudentOrParent = hasRole('ziak') || hasRole('rodic');
        const gradesCollection = collection(firestore, 'grades');
        let q: Query | null = null;

        if (isAdmin) {
            if (!user.organizationId) {
                setGradingsLoading(false);
                setGradings([]);
                return;
            }
            q = query(gradesCollection, where('organizationId', '==', user.organizationId), orderBy('createdAt', 'desc'));
        } else if (isTeacher) {
            q = query(gradesCollection, where('ucitelId', '==', user.id), orderBy('createdAt', 'desc'));
        } else if (isStudentOrParent) {
            const studentId = hasRole('ziak') ? user.id : user.studentId;
            if (!studentId) {
                setGradingsLoading(false);
                setGradings([]);
                return;
            }
            q = query(gradesCollection, where('ziakId', '==', studentId), orderBy('createdAt', 'desc'));
        }

        if (!q) {
            setGradingsLoading(false);
            setGradings([]);
            return;
        }

        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const results = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Grading[];
                setGradings(results);
                setGradingsLoading(false);
            },
            (error) => {
                console.error("Error fetching gradings:", error);
                toast({ variant: 'destructive', title: 'Chyba načítání dat', description: 'Nepodařilo se načíst data o klasifikaci.' });
                setGradings(null);
                setGradingsLoading(false);
            }
        );

        return () => unsubscribe();
    }, [firestore, user, userLoading, hasRole, toast]);


    // --- Form Handling ---
    const { register, handleSubmit, control, reset, setValue, watch } = useForm<GradingFormData>({
        resolver: zodResolver(gradingSchema),
        defaultValues: { studentIds: [], vaha: 1.0, znamka: 1 }
    });

    // --- Effects ---
    const tridaIdFromParams = searchParams.get('tridaId');
    const predmetIdFromParams = searchParams.get('predmetId');

    const handleOpenDialog = useCallback((grading: Grading | null) => {
        setEditingGrading(grading);
        if (grading) {
            setValue('studentIds', [grading.ziakId]);
            setValue('predmetId', grading.predmetId);
            setValue('znamka', grading.znamka);
            setValue('vaha', grading.vaha);
            setValue('komentar', grading.komentar || '');
            const studentClassId = students?.find(s => s.id === grading.ziakId)?.tridaId;
            if(studentClassId) setSelectedClassId(studentClassId);
            else if (allTeachers) {
                 const studentUser = allTeachers.find(u => u.id === grading.ziakId);
                 if (studentUser?.tridaId) setSelectedClassId(studentUser.tridaId);
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
    }, [reset, setValue, tridaIdFromParams, predmetIdFromParams, students, allTeachers]);


    useEffect(() => {
        if (tridaIdFromParams) {
            setSelectedClassId(tridaIdFromParams);
        } else if (teacherClasses && teacherClasses.length > 0 && !selectedClassId) {
            setSelectedClassId(teacherClasses[0].id);
        }
    }, [teacherClasses, selectedClassId, tridaIdFromParams]);

    useEffect(() => {
        if (tridaIdFromParams || predmetIdFromParams) {
            handleOpenDialog(null);
        }
    }, [tridaIdFromParams, predmetIdFromParams, handleOpenDialog]);

    // === RENDER LOGIC ===
    const isDataReady = !userLoading && user;
    const showTeacherAdminView = isDataReady && (hasRole('ucitel') || hasRole('administrator'));
    const showStudentParentView = isDataReady && (hasRole('ziak') || hasRole('rodic'));

    if (!isDataReady) {
       return (
            <div className="flex h-full w-full items-center justify-center p-4">
                <Card className="max-w-lg w-full">
                    <CardHeader>
                        <CardTitle>Načítání dat...</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4">
                             <Loader2 className="h-8 w-8 animate-spin" />
                             <p>Ověřování oprávnění a příprava modulu klasifikace...</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    if (!user) return <div className="flex h-full w-full items-center justify-center">Přístup odepřen.</div>;

    if (showTeacherAdminView) {
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
                                    <TableHead>Žák</TableHead>
                                    <TableHead>Předmět</TableHead>
                                    <TableHead>Známka</TableHead>
                                    <TableHead>Váha</TableHead>
                                    <TableHead>Komentář</TableHead>
                                    <TableHead className="text-right">Akce</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {gradingsLoading ? (
                                    <TableRow><TableCell colSpan={7} className="text-center h-24">Načítání hodnocení...</TableCell></TableRow>
                                ) : gradings?.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="text-center h-24">Nebylo zadáno žádné hodnocení.</TableCell></TableRow>
                                ) : (
                                    gradings?.map(g => (
                                        <TableRow key={g.id} onClick={() => router.push(`/dashboard/hodnoceni/${g.id}`)} className="cursor-pointer">
                                            <TableCell>{format(parseISO(g.datum), 'd.M.yyyy')}</TableCell>
                                            <TableCell>{g.ziakJmeno}</TableCell>
                                            <TableCell>{g.predmet}</TableCell>
                                            <TableCell className="font-bold text-lg">{g.znamka}</TableCell>
                                            <TableCell>{(typeof g.vaha === 'number' && !isNaN(g.vaha) ? g.vaha : 1.0).toFixed(1)}</TableCell>
                                            <TableCell className="max-w-xs truncate">{g.komentar}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleOpenDialog(g); }}><Pencil className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeletingGrading(g); }} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Dialogs need to be here */}
            </div>
        );
    }
    
     if (showStudentParentView) {
        const getTeacherName = (teacherId: string) => allTeachers?.find(t => t.id === teacherId)?.name || 'Neznámý';
        
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
                const weightedSum = grades.reduce((sum, g) => sum + (g.znamka * (g.vaha || 1)), 0);
                const totalWeight = grades.reduce((sum, g) => sum + (g.vaha || 1), 0);
                acc[subject] = totalWeight > 0 ? (weightedSum / totalWeight).toFixed(2) : 'N/A';
                return acc;
            }, {} as Record<string, string>);
        }, [gradesBySubject]);

        return (
            <div className="p-4 md:p-6 space-y-8">
                 <h1 className="text-3xl font-bold">Klasifikace</h1>
                 {gradingsLoading && <div>Načítání známek...</div>}
                 {!gradingsLoading && Object.keys(gradesBySubject).map(subject => (
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
                                    {gradesBySubject[subject].map(g => (
                                        <TableRow key={g.id} onClick={() => router.push(`/dashboard/hodnoceni/${g.id}`)} className="cursor-pointer">
                                            <TableCell>{format(parseISO(g.datum), 'd. M. yyyy')}</TableCell>
                                            <TableCell className="font-bold text-2xl">{g.znamka}</TableCell>
                                            <TableCell>{(typeof g.vaha === 'number' && !isNaN(g.vaha) ? g.vaha : 1.0).toFixed(1)}</TableCell>
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
