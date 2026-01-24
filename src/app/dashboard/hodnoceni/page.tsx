'use client'
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, writeBatch, limit, getDocs, Timestamp, getDoc, documentId } from 'firebase/firestore';
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


const gradingSchema = z.object({
  studentIds: z.array(z.string()).min(1, 'Je třeba vybrat alespoň jednoho žáka.'),
  predmetId: z.string().min(1, 'Předmět je povinný.'),
  znamka: z.coerce.number().min(1).max(5),
  vaha: z.coerce.number().min(0.1).max(10),
  komentar: z.string().optional(),
});

type GradingFormData = z.infer<typeof gradingSchema>;

function TeacherView() {
    const { user, hasRole } = useAuth();
    const firestore = useFirestore();
    const { toast } = useToast();
    const searchParams = useSearchParams();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingGrading, setEditingGrading] = useState<Grading | null>(null);
    const [deletingGrading, setDeletingGrading] = useState<Grading | null>(null);

    // Params from URL for pre-filling
    const tridaIdFromParams = searchParams.get('tridaId');
    const predmetIdFromParams = searchParams.get('predmetId');

    const gradingsQuery = useMemoFirebase(() => {
        if (!user?.id || !firestore) return null;
        
        const gradesCollection = collection(firestore, 'grades');

        if (hasRole('administrator')) {
            // Admin sees all grades in their organization
            if (!user.organizationId) return null; // Safety check
            return query(gradesCollection, where('organizationId', '==', user.organizationId), orderBy('createdAt', 'desc'));
        }
        
        // Teacher sees only their own grades
        return query(gradesCollection, where('ucitelId', '==', user.id), orderBy('createdAt', 'desc'));
    }, [firestore, user, hasRole]);

    const { data: gradings, isLoading } = useCollection<Grading>(gradingsQuery);

    const teacherClassesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        // Query for classes where the user is the main teacher, a substitute, or an assistant.
        return query(collection(firestore, 'tridy'), where('ucitelId', '==', user.id));
    }, [firestore, user]);
    const { data: teacherClasses, isLoading: classesLoading } = useCollection<Trida>(teacherClassesQuery);
    
    // The class ID to be used for displaying students. Prioritize URL param.
    const [selectedClassId, setSelectedClassId] = useState<string | null>(tridaIdFromParams);

    const studentsQuery = useMemoFirebase(() => {
        if (!firestore || !selectedClassId) return null;
        return query(collection(firestore, 'users'), where('tridaId', '==', selectedClassId), where('roles', 'array-contains', 'ziak'))
    }, [firestore, selectedClassId]);
    const { data: students, isLoading: studentsLoading } = useCollection<User>(studentsQuery);

    const { register, handleSubmit, control, reset, setValue, watch, formState: { errors } } = useForm<GradingFormData>({
        resolver: zodResolver(gradingSchema),
        defaultValues: { studentIds: [], vaha: 1.0, znamka: 1 }
    });
    
    const predmetyQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return collection(firestore, 'predmety');
    }, [firestore]);
    const { data: predmety, isLoading: predmetyLoading } = useCollection<Predmet>(predmetyQuery);
    

    const handleOpenDialog = useCallback((grading: Grading | null) => {
        setEditingGrading(grading);
        
        if (grading) { // Edit mode
            setValue('studentIds', [grading.ziakId]);
            setValue('predmetId', grading.predmetId);
            setValue('znamka', grading.znamka);
            setValue('vaha', grading.vaha);
            setValue('komentar', grading.komentar || '');
            // Find student to set the selected class
            const studentClassId = students?.find(s => s.id === grading.ziakId)?.tridaId;
            if(studentClassId) setSelectedClassId(studentClassId);

        } else { // New mode
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
    }, [reset, setValue, tridaIdFromParams, predmetIdFromParams, students]);

    // Set default class or class from params
    useEffect(() => {
        if (tridaIdFromParams) {
            setSelectedClassId(tridaIdFromParams);
        } else if (teacherClasses && teacherClasses.length > 0 && !selectedClassId) {
            setSelectedClassId(teacherClasses[0].id);
        }
    }, [teacherClasses, selectedClassId, tridaIdFromParams]);

    // Open dialog if params are present
    useEffect(() => {
        if (tridaIdFromParams || predmetIdFromParams) {
            handleOpenDialog(null);
        }
    }, [tridaIdFromParams, predmetIdFromParams, handleOpenDialog]);

    const handleSaveGrading = async (data: GradingFormData) => {
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: 'Chyba', description: 'Nekompletní data pro uložení.' });
            return;
        }

        try {
            const classDocRef = doc(firestore, 'tridy', selectedClassId || data.tridaId);
            const classDocSnap = await getDoc(classDocRef);
            let organizationId: string | undefined;

            if (classDocSnap.exists()) {
                organizationId = classDocSnap.data().organizationId;
            }

            if (!organizationId) {
                // Fallback to user's organizationId if class doesn't have one
                organizationId = user.organizationId;
            }
            
            if (!organizationId) {
                toast({ variant: 'destructive', title: 'Chyba', description: 'Data o třídě nebo organizaci nebyla nalezena.' });
                return;
            }

            if (editingGrading) {
                const studentDoc = await getDoc(doc(firestore, 'users', data.studentIds[0]));
                 if(!studentDoc.exists()) {
                    toast({ variant: 'destructive', title: 'Chyba', description: 'Vybraný student nebyl nalezen.' });
                    return;
                }
                const student = studentDoc.data() as User;
                
                if (!student.tridaId) {
                    toast({ variant: 'destructive', title: 'Chyba', description: 'Student není přiřazen k žádné třídě.' });
                    return;
                }
                
                const predmetDoc = await getDoc(doc(firestore, 'predmety', data.predmetId));
                if (!predmetDoc.exists()) {
                    toast({ variant: 'destructive', title: 'Chyba', description: 'Vybraný předmět nebyl nalezen.' });
                    return;
                }
                const predmet = predmetDoc.data() as Predmet;
                
                const gradingData: Partial<Grading> = {
                    ...data,
                    organizationId: organizationId,
                    predmetId: predmetDoc.id,
                    tridaId: student.tridaId,
                    ziakId: student.id,
                    datum: format(new Date(), 'dd.MM.yyyy'),
                    cas: format(new Date(), 'HH:mm'),
                    ziakJmeno: student.name,
                    predmet: predmet.name,
                    ucitelId: user.id,
                    updatedAt: Timestamp.now(),
                };
                delete (gradingData as any).studentIds;
                await updateDoc(doc(firestore, 'grades', editingGrading.id), gradingData);
                toast({ title: 'Hodnocení upraveno', description: 'Změny byly úspěšně uloženy.' });
            } else {
                // Batch create
                if (!selectedClassId) {
                    toast({ variant: 'destructive', title: 'Chyba', description: 'Není vybrána žádná třída.' });
                    return;
                }

                const predmetDoc = await getDoc(doc(firestore, 'predmety', data.predmetId));
                if (!predmetDoc.exists()) {
                    toast({ variant: 'destructive', title: 'Chyba', description: 'Vybraný předmět nebyl nalezen.' });
                    return;
                }
                const predmet = predmetDoc.data() as Predmet;

                const studentsQuery = query(collection(firestore, 'users'), where(documentId(), 'in', data.studentIds));
                const studentDocs = await getDocs(studentsQuery);
                const studentsData = studentDocs.docs.map(d => ({id: d.id, ...d.data()}) as User);

                if (studentsData.length === 0) {
                     toast({ variant: 'destructive', title: 'Chyba', description: 'Vybraní studenti nebyli nalezeni.' });
                    return;
                }

                const batch = writeBatch(firestore);
                studentsData.forEach(student => {
                    const newGradingDoc = doc(collection(firestore, 'grades'));
                    const gradingData: Omit<Grading, 'id'> = {
                        organizationId: organizationId!,
                        predmetId: predmetDoc.id,
                        tridaId: student.tridaId || '',
                        ziakId: student.id,
                        znamka: data.znamka,
                        vaha: data.vaha,
                        komentar: data.komentar || '',
                        datum: format(new Date(), 'dd.MM.yyyy'),
                        cas: format(new Date(), 'HH:mm'),
                        ziakJmeno: student.name,
                        predmet: predmet.name,
                        ucitelId: user.id,
                        createdAt: Timestamp.now(),
                    };
                    batch.set(newGradingDoc, gradingData);
                });
                await batch.commit();
                toast({ title: 'Hodnocení přidáno', description: `Nové hodnocení bylo úspěšně uloženo pro ${data.studentIds.length} žáků.` });
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
            await deleteDoc(doc(firestore, 'grades', deletingGrading.id));
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
                            ) : gradings?.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="text-center h-24">Nebylo zadáno žádné hodnocení.</TableCell></TableRow>
                            ) : (
                                gradings?.map(g => (
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
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl">{editingGrading ? 'Upravit hodnocení' : 'Nové hodnocení'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit(handleSaveGrading)} className="space-y-6 pt-4">
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2">
                                <div className="grid gap-2">
                                     <Label>Třída</Label>
                                     <Select 
                                        onValueChange={(val) => {
                                            setSelectedClassId(val);
                                            setValue('studentIds', []); // Reset student selection on class change
                                        }} 
                                        value={selectedClassId || ''}
                                        disabled={!!tridaIdFromParams || editingGrading !== null}
                                     >
                                         <SelectTrigger>
                                             <SelectValue placeholder="Vyberte třídu" />
                                         </SelectTrigger>
                                         <SelectContent>
                                            {teacherClasses?.map(c => <SelectItem key={c.id} value={c.id}>{c.nazev}</SelectItem>)}
                                         </SelectContent>
                                     </Select>
                                 </div>
                                 <Controller name="studentIds" control={control} render={({ field }) => (
                                     <div className="mt-4 border rounded-lg max-h-60 overflow-y-auto">
                                         <Table>
                                             <TableHeader>
                                                 <TableRow>
                                                    <TableHead className="w-12"><Checkbox 
                                                        checked={students ? field.value.length === students.length && students.length > 0 : false}
                                                        onCheckedChange={(checked) => {
                                                            if(checked) {
                                                                field.onChange(students?.map(s => s.id) || []);
                                                            } else {
                                                                field.onChange([]);
                                                            }
                                                        }}
                                                        disabled={editingGrading !== null}
                                                    /></TableHead>
                                                     <TableHead>Příjmení a jméno</TableHead>
                                                 </TableRow>
                                             </TableHeader>
                                             <TableBody>
                                                 {studentsLoading ? (
                                                    <TableRow><TableCell colSpan={2} className="text-center h-24">Načítání žáků...</TableCell></TableRow>
                                                 ) : students?.map(student => (
                                                     <TableRow key={student.id} data-state={field.value.includes(student.id) ? 'selected' : ''}>
                                                         <TableCell><Checkbox 
                                                            checked={field.value.includes(student.id)}
                                                            onCheckedChange={(checked) => {
                                                                if (editingGrading) return; // Disable changing student in edit mode
                                                                if(checked) {
                                                                    field.onChange([...field.value, student.id]);
                                                                } else {
                                                                    field.onChange(field.value.filter(id => id !== student.id));
                                                                }
                                                            }}
                                                            disabled={editingGrading !== null}
                                                         /></TableCell>
                                                         <TableCell>{student.name}</TableCell>
                                                     </TableRow>
                                                 ))}
                                             </TableBody>
                                         </Table>
                                     </div>
                                 )} />
                                 {errors.studentIds && <p className="text-sm text-destructive mt-1">{errors.studentIds.message}</p>}
                            </div>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label>Předmět</Label>
                                    <Controller name="predmetId" control={control} render={({ field }) => (
                                        <Select 
                                            onValueChange={field.onChange} 
                                            value={field.value} 
                                            disabled={predmetyLoading || !!predmetIdFromParams || editingGrading !== null}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Vyberte předmět" /></SelectTrigger>
                                            <SelectContent>{predmety?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                    )} />
                                    {errors.predmetId && <p className="text-sm text-destructive">{errors.predmetId.message}</p>}
                                </div>
                                 <div className="space-y-3">
                                   <Label>Známka</Label>
                                   <Controller name="znamka" control={control} render={({ field }) => (
                                      <ToggleGroup type="single" value={String(field.value)} onValueChange={(val) => val && field.onChange(Number(val))} className="grid grid-cols-5 gap-2">
                                        {[1, 2, 3, 4, 5].map(z => (
                                            <ToggleGroupItem key={z} value={String(z)} className="h-12 w-full text-xl font-bold border data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                                              {z}
                                            </ToggleGroupItem>
                                        ))}
                                      </ToggleGroup>
                                    )}/>
                                </div>
                                <div className="space-y-3">
                                     <Label htmlFor="vaha">Váha</Label>
                                     <div className="flex items-center gap-2">
                                         <Star className="text-muted-foreground" />
                                         <Controller name="vaha" control={control} render={({ field }) => <Input id="vaha" type="number" step="0.1" {...field} className="text-lg" />} />
                                     </div>
                                    {errors.vaha && <p className="text-sm text-destructive">{errors.vaha.message}</p>}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="komentar">Komentář / Název hodnocení</Label>
                            <div className="flex items-center gap-2">
                                <Type className="text-muted-foreground" />
                                <Controller name="komentar" control={control} render={({ field }) => <Textarea id="komentar" {...field} placeholder="Např. Test z novověku, aktivita v hodině..." />} />
                            </div>
                        </div>

                        <DialogFooter className="pt-4">
                            <DialogClose asChild><Button type="button" variant="outline">Zrušit</Button></DialogClose>
                            <Button type="submit">Uložit hodnocení</Button>
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
    const { user, hasRole } = useAuth();
    const firestore = useFirestore();
    const router = useRouter();

    const studentId = hasRole('ziak') ? user?.id : user?.studentId;

    const gradesQuery = useMemoFirebase(() => {
        if (!firestore || !studentId) {
            return null;
        }
        return query(collection(firestore, 'grades'), where('ziakId', '==', studentId), orderBy('createdAt', 'desc'));
    }, [firestore, studentId]);

    const { data: gradings, isLoading } = useCollection<Grading>(gradesQuery);
    
    const { data: teachers, isLoading: teachersLoading } = useCollection<User>(useMemoFirebase(() => firestore ? query(collection(firestore, 'users'), where('roles', 'array-contains', 'ucitel')) : null, [firestore]));

    const getTeacherName = useCallback((teacherId: string) => {
        return teachers?.find(t => t.id === teacherId)?.name || 'Neznámý';
    }, [teachers]);

    const gradesBySubject = useMemo(() => {
        if (!gradings) return {};
        return gradings.reduce((acc, g) => {
            if (!acc[g.predmet]) {
                acc[g.predmet] = [];
            }
            acc[g.predmet].push(g);
            return acc;
        }, {} as Record<string, Grading[]>);
    }, [gradings]);
    
     const subjectAverages = useMemo(() => {
        const averages: { [key: string]: string } = {};
        for (const subject in gradesBySubject) {
            const grades = gradesBySubject[subject];
            const totalWeight = grades.reduce((sum, g) => sum + g.vaha, 0);
            const weightedSum = grades.reduce((sum, g) => sum + g.znamka * g.vaha, 0);
            if (totalWeight > 0) {
                averages[subject] = (weightedSum / totalWeight).toFixed(2);
            } else {
                averages[subject] = 'N/A';
            }
        }
        return averages;
    }, [gradesBySubject]);
    
    if (isLoading || teachersLoading) {
        return <div className="p-6 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;
    }

    if (!user) {
        return <div className="p-6 text-center">Uživatel nenalezen.</div>;
    }

    return (
        <div className="p-4 md:p-6 space-y-8">
             <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Klasifikace</h1>
                    <p className="text-muted-foreground">Přehled vašich známek podle předmětů a průběžné hodnocení.</p>
                </div>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Průměry podle předmětů</CardTitle>
                </CardHeader>
                <CardContent>
                    {Object.keys(gradesBySubject).length === 0 && !isLoading ? (
                        <p className="text-muted-foreground">Nebylo nalezeno žádné hodnocení.</p>
                    ) : (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {Object.keys(gradesBySubject).sort().map(subject => (
                                <Card key={subject} className="flex flex-col">
                                    <CardHeader>
                                        <CardTitle className="flex justify-between items-center">
                                            <span>{subject}</span>
                                            <Badge className="text-lg">{subjectAverages[subject]}</Badge>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="flex-grow">
                                        <div className="flex flex-wrap gap-2">
                                            {gradesBySubject[subject].map(g => (
                                                <div key={g.id} className="relative cursor-pointer group" onClick={() => router.push(`/dashboard/hodnoceni/${g.id}`)}>
                                                    <div className="flex items-center justify-center h-12 w-12 rounded-full border-2 border-primary bg-primary/10 transition-transform group-hover:scale-110">
                                                        <span className="text-xl font-bold text-primary">{g.znamka}</span>
                                                    </div>
                                                    {g.komentar && (
                                                        <div className="absolute -top-1 -right-1">
                                                            <Award className="h-5 w-5 text-amber-500 fill-amber-300" />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Průběžné hodnocení</CardTitle>
                    <CardDescription>Chronologický přehled všech vašich známek.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Datum</TableHead>
                                <TableHead>Předmět</TableHead>
                                <TableHead>Známka (váha)</TableHead>
                                <TableHead>Učitel</TableHead>
                                <TableHead>Komentář</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {gradings.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">Nebyly nalezeny žádné známky.</TableCell>
                                </TableRow>
                            ) : (
                                gradings.map(g => (
                                    <TableRow key={g.id} onClick={() => router.push(`/dashboard/hodnoceni/${g.id}`)} className="cursor-pointer">
                                        <TableCell>{g.datum}</TableCell>
                                        <TableCell>{g.predmet}</TableCell>
                                        <TableCell>
                                            <span className="font-bold text-lg mr-2">{g.znamka}</span>
                                            <Badge variant="outline">Váha: {g.vaha.toFixed(1)}</Badge>
                                        </TableCell>
                                        <TableCell>{getTeacherName(g.ucitelId)}</TableCell>
                                        <TableCell className="max-w-xs truncate">{g.komentar}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

        </div>
    );
}


function HodnoceniPageContent() {
  const { user, loading, hasRole } = useAuth();
  
  if (loading) return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
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
