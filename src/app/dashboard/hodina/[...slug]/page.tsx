'use client';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, User, Home, Clock, FileText, MoreVertical, VenetianMask, XCircle, Save, Pencil, PencilRuler } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useFirestore, useDoc, useMemoFirebase, useCollection, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, query, where, collection, getDocs, limit, writeBatch, Timestamp } from 'firebase/firestore';
import type { Rozvrh, LessonBlock, User as AppUser, Trida, ZapisHodiny, Substitution, Predmet, Grading } from '@/lib/types';
import { isSameDay, parseISO, format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { useAuth } from '@/hooks/use-auth';
import { useMemo, useState, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { MultiSelect } from '@/components/ui/multi-select';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

const gradingSchema = z.object({
  studentIds: z.array(z.string()).min(1, 'Je třeba vybrat alespoň jednoho žáka.'),
  znamka: z.coerce.number().min(1, 'Známka musí být od 1 do 5.').max(5, 'Známka musí být od 1 do 5.'),
  vaha: z.coerce.number().min(0.1, 'Váha musí být kladná.').max(10),
  komentar: z.string().optional(),
});
type GradingFormData = z.infer<typeof gradingSchema>;

function GradingDialog({
    isOpen,
    onOpenChange,
    lesson,
    students,
    subjects,
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    lesson: LessonBlock;
    students: AppUser[];
    subjects: Predmet[];
}) {
    const { user } = useAuth();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { register, handleSubmit, control, reset, formState: { errors } } = useForm<GradingFormData>({
        resolver: zodResolver(gradingSchema),
        defaultValues: { studentIds: [], vaha: 1.0, znamka: 1 }
    });

    useEffect(() => {
      if (!isOpen) {
        reset();
      }
    }, [isOpen, reset]);

    const onSubmit = async (data: GradingFormData) => {
        if (!firestore || !user || !user.organizationId || !lesson) return;

        const batch = writeBatch(firestore);
        const now = Timestamp.now();
        const selectedPredmet = subjects.find(p => p.id === lesson.subjectId);

        if (!selectedPredmet) {
            toast({ variant: 'destructive', title: 'Chyba', description: 'Předmět pro tuto hodinu nebyl nalezen.' });
            return;
        }
        
        for (const studentId of data.studentIds) {
            const studentData = students.find(s => s.id === studentId);
            if (!studentData) continue;

            const gradeData: Omit<Grading, 'id'> & { createdAt: Timestamp } = {
                organizationId: user.organizationId,
                tridaId: lesson.classId,
                ziakId: studentId,
                ziakJmeno: studentData.name,
                predmetId: lesson.subjectId,
                predmet: selectedPredmet.name,
                znamka: data.znamka,
                vaha: data.vaha,
                komentar: data.komentar || '',
                ucitelId: user.id,
                datum: format(now.toDate(), 'yyyy-MM-dd'),
                cas: format(now.toDate(), 'HH:mm'),
                createdAt: now,
            };

            const gradeRef = doc(collection(firestore, 'grades'));
            batch.set(gradeRef, gradeData);
        }

        try {
            await batch.commit();
            toast({
                title: 'Hodnocení uloženo',
                description: `Bylo uloženo ${data.studentIds.length} známek.`,
            });
            onOpenChange(false);
        } catch (e) {
            console.error(e);
            toast({
                variant: 'destructive',
                title: 'Chyba ukládání',
                description: 'Při ukládání hodnocení došlo k chybě.',
            });
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Nové hodnocení</DialogTitle>
                    <DialogDescription>
                        Známka pro předmět {lesson.subjectName}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid gap-2">
                        <Label>Žáci</Label>
                        <Controller
                            name="studentIds"
                            control={control}
                            render={({ field }) => (
                                <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
                                    {students.length === 0 ? <p>Nenalezeni žádní žáci pro tuto třídu.</p> : students.map(s => (
                                        <div key={s.id} className="flex items-center gap-2">
                                            <Checkbox
                                                id={`student-${s.id}`}
                                                checked={field.value.includes(s.id)}
                                                onCheckedChange={(checked) => {
                                                    const newValue = checked ? [...field.value, s.id] : field.value.filter(id => id !== s.id);
                                                    field.onChange(newValue);
                                                }}
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
                            <Label>Známka</Label>
                            <Controller name="znamka" control={control} render={({ field }) => (
                                <Select onValueChange={(val) => field.onChange(Number(val))} value={String(field.value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{[1,2,3,4,5].map(z=><SelectItem key={z} value={String(z)}>{z}</SelectItem>)}</SelectContent></Select>
                            )} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Váha</Label>
                            <Input type="number" step="0.1" {...register('vaha')} />
                        </div>
                    </div>
                     <div className="grid gap-2">
                        <Label>Komentář</Label>
                        <Textarea {...register('komentar')} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Zrušit</Button>
                        <Button type="submit">Uložit</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}


function SubstitutionDialog({
    isOpen,
    onOpenChange,
    lessonInfo,
    day,
    substitution,
    teachers,
    subjects,
    onSave,
}: {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    lessonInfo: { lesson: LessonBlock; period: number; classId: string; } | null;
    day: Date;
    substitution: Substitution | null;
    teachers: AppUser[];
    subjects: Predmet[];
    onSave: (subData: any) => void;
}) {
    const [subType, setSubType] = useState('suplovat');
    const [subTeacherIds, setSubTeacherIds] = useState<string[]>([]);
    const [subSubjectId, setSubSubjectId] = useState('');
    const [note, setNote] = useState('');

    useEffect(() => {
        if (isOpen && lessonInfo) {
             if (substitution) {
                const type = substitution.changes.type;
                const isCancelled = Array.isArray(type) ? type.includes('zruseno') : type === 'zruseno';
                setSubType(isCancelled ? 'odpada' : 'suplovat');
                setSubTeacherIds(substitution.changes.teacherIds || []);
                setSubSubjectId(substitution.changes.subjectId || lessonInfo.lesson.subjectId);
                setNote(substitution.changes.note || '');
            } else {
                setSubType('suplovat');
                setSubTeacherIds([lessonInfo.lesson.teacherId]);
                setSubSubjectId(lessonInfo.lesson.subjectId);
                setNote('');
            }
        }
    }, [isOpen, lessonInfo, substitution]);

    const handleSave = () => {
        if (!lessonInfo) return;

        let changes: any = {};
        let type: string[] = [];

        if (subType === 'odpada') {
            type.push('zruseno');
            changes = { type, note };
        } else {
            const originalTeacherIds = [lessonInfo.lesson.teacherId];
            const sortedOriginal = [...originalTeacherIds].sort();
            const sortedNew = [...subTeacherIds].sort();

            if (JSON.stringify(sortedOriginal) !== JSON.stringify(sortedNew)) {
                type.push('zmena-ucitele');
            }
            changes.teacherIds = subTeacherIds;
            
            if (subSubjectId && subSubjectId !== lessonInfo.lesson.subjectId) {
                changes.subjectId = subSubjectId;
                if (!type.includes('zmena-predmetu')) type.push('zmena-predmetu' as any);
            }
            if (note) changes.note = note;
            if (type.length === 0 && !changes.note && subSubjectId === lessonInfo.lesson.subjectId) {
                // No actual change
            } else {
                 changes.type = type;
            }
        }

        onSave({
            originalLesson: {
                day: format(day, 'EEEE', { locale: cs }),
                period: lessonInfo.period - 1,
                classId: lessonInfo.classId,
                lessonBlock: lessonInfo.lesson,
            },
            changes: changes,
            date: format(day, 'yyyy-MM-dd'),
        });
        onOpenChange(false);
    };

    if (!lessonInfo) return null;
    
    const { lesson, period } = lessonInfo;
    const teacherOptions = teachers.map(t => ({ value: t.id, label: t.name }));

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Zadat suplování</DialogTitle>
                    <DialogDescription>
                        Hodina: {lesson.subjectName} ({lesson.className}), {format(day, "d.M.yyyy")}, {period}. hodina
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <RadioGroup value={subType} onValueChange={setSubType}>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="odpada" id="odpada" />
                            <Label htmlFor="odpada">Hodina odpadá</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="suplovat" id="suplovat" />
                            <Label htmlFor="suplovat">Supluje se / mění se</Label>
                        </div>
                    </RadioGroup>

                    {subType === 'suplovat' && (
                        <div className="space-y-4 pt-4 border-t">
                            <div className="grid gap-2">
                                <Label>Suplující učitel/é</Label>
                                <MultiSelect
                                    options={teacherOptions}
                                    onValueChange={setSubTeacherIds}
                                    defaultValue={subTeacherIds}
                                    placeholder="Vyberte učitele..."
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Nový předmět (nepovinné)</Label>
                                 <Select value={subSubjectId} onValueChange={setSubSubjectId}>
                                    <SelectTrigger><SelectValue placeholder="Vyberte předmět" /></SelectTrigger>
                                    <SelectContent>
                                        {subjects.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name} ({s.shortcut})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                     <div className="grid gap-2">
                        <Label>Poznámka</Label>
                        <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Zadejte poznámku k suplování..." />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Zrušit</Button>
                    <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" /> Uložit suplování</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


export default function LessonDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { user, hasRole } = useAuth();
    const { toast } = useToast();
    const isTeacher = hasRole('ucitel') || hasRole('administrator');
    const slug = Array.isArray(params.slug) ? params.slug : [params.slug];
    const [dateStr, periodStr, classId, lessonId] = slug;

    const firestore = useFirestore();

    const rozvrhRef = useMemoFirebase(() => {
        if (!firestore || !dateStr || !classId) return null;
        return doc(firestore, 'rozvrhy', `${classId}-${dateStr}`);
    }, [firestore, dateStr, classId]);

    const { data: schedule, isLoading: scheduleLoading } = useDoc<Rozvrh>(rozvrhRef);

    // Fetch substitution
    const subId = `${classId}-${dateStr}-${parseInt(periodStr, 10)}`;
    const subRef = useMemoFirebase(() => {
        if (!firestore || !subId) return null;
        return doc(firestore, 'suplovani', subId);
    }, [firestore, subId]);
    const { data: substitution, isLoading: substitutionLoading } = useDoc<Substitution>(subRef);

    // Fetch all teachers and subjects to resolve names for substituted lesson
    const { data: allTeachers, isLoading: teachersLoading } = useCollection<AppUser>(
        useMemoFirebase(() => firestore ? query(collection(firestore, 'users'), where('roles', 'array-contains', 'ucitel')) : null, [firestore])
    );
    const { data: allSubjects, isLoading: subjectsLoading } = useCollection<Predmet>(
        useMemoFirebase(() => firestore ? collection(firestore, 'predmety') : null, [firestore])
    );
    
    // Fetch students for grading dialog
    const { data: students, isLoading: studentsLoading } = useCollection<AppUser>(
       useMemoFirebase(() => (firestore && classId) ? query(collection(firestore, 'users'), where('tridaId', '==', classId), where('roles', 'array-contains', 'ziak')) : null, [firestore, classId])
    );

    const lesson = useMemo<LessonBlock | null>(() => {
        const originalLesson = schedule?.hodiny[parseInt(periodStr, 10)];
        if (!originalLesson) return null;
        if (!substitution || !substitution.changes || (substitution.changes.type && Array.isArray(substitution.changes.type) && substitution.changes.type.includes('zruseno'))) {
            return originalLesson;
        }

        const newTeacherIds = substitution.changes.teacherIds;
        const newSubjectId = substitution.changes.subjectId;

        const substitutedLesson = { ...originalLesson };

        if (newTeacherIds && newTeacherIds.length > 0 && allTeachers) {
            substitutedLesson.teacherId = newTeacherIds[0];
            substitutedLesson.teacherName = newTeacherIds
                .map(id => allTeachers.find(t => t.id === id)?.name)
                .filter(Boolean)
                .join(', ');
        }

        if (newSubjectId && allSubjects) {
            const newSubject = allSubjects.find(s => s.id === newSubjectId);
            if (newSubject) {
                substitutedLesson.subjectId = newSubject.id;
                substitutedLesson.subjectName = newSubject.name;
                substitutedLesson.subjectShortcut = newSubject.shortcut;
            }
        }
        
        return substitutedLesson;

    }, [schedule, periodStr, substitution, allTeachers, allSubjects]);


    const zapisId = `${classId}-${dateStr}-${parseInt(periodStr, 10) + 1}`;
    const zapisRef = useMemoFirebase(() => {
        if (!firestore || !zapisId) return null;
        return doc(firestore, 'zapisyHodin', zapisId);
    }, [firestore, zapisId]);

    
    const { data: zapis, isLoading: zapisLoading } = useDoc<ZapisHodiny>(zapisRef);
    
    const timeSlot = schedule?.timeSlots[parseInt(periodStr, 10)];
    
    const classRef = useMemoFirebase(() => (firestore && classId) ? doc(firestore, 'tridy', classId) : null, [firestore, classId]);
    const {data: classData} = useDoc<Trida>(classRef);
    
    const isLoading = scheduleLoading || zapisLoading || substitutionLoading || teachersLoading || subjectsLoading || studentsLoading;

    // Dialog states
    const [isSubDialogOpen, setIsSubDialogOpen] = useState(false);
    const [deletingSubstitution, setDeletingSubstitution] = useState<Substitution | null>(null);
    const [isGradingDialogOpen, setIsGradingDialogOpen] = useState(false);


    // Handlers
    const handleSaveSubstitution = async (subData: any) => {
        if (!firestore || !user ) return;
        const subId = `${subData.originalLesson.classId}-${subData.date}-${subData.originalLesson.period}`;
        const subRef = doc(firestore, 'suplovani', subId);
        
        const orgsQuery = query(collection(firestore, 'organizations'), limit(1));
        const orgsSnap = await getDocs(orgsQuery);
         if (orgsSnap.empty) {
            toast({ variant: 'destructive', title: 'Chyba', description: 'V databázi neexistuje žádná organizace.' });
            return;
        }
        const organizationId = orgsSnap.docs[0].id;

        await setDocumentNonBlocking(subRef, { ...subData, id: subId, organizationId }, { merge: true });
        toast({ title: "Suplování uloženo." });
    };

    const handleDeleteSubstitution = async () => {
        if (!firestore || !deletingSubstitution) return;
        const subId = deletingSubstitution.id;
        await deleteDocumentNonBlocking(doc(firestore, 'suplovani', subId));
        toast({ title: 'Suplování zrušeno.' });
        setDeletingSubstitution(null);
    };

    const handleNavigation = (path: string, params: Record<string, string>) => {
        const query = new URLSearchParams(params).toString();
        router.push(`${path}?${query}`);
    }

    if (isLoading) {
        return (
            <div className="p-4 md:p-6">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <div className="text-center mt-8">Načítání...</div>
            </div>
        );
    }
    
    if (!lesson) {
        return (
            <div className="p-4 md:p-6">
                 <Button variant="ghost" size="icon" onClick={() => router.back()} className="mb-4">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="text-center mt-8 text-destructive">Detail hodiny nebyl nalezen.</div>
            </div>
        )
    }
    
    const day = parseISO(dateStr);
    const period = parseInt(periodStr, 10) + 1;

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                     <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                         <h1 className="text-3xl font-bold">{lesson.subjectName}</h1>
                         <p className="text-muted-foreground">{format(day, "EEEE, d. MMMM yyyy", { locale: cs })}</p>
                    </div>
                </div>

                {isTeacher && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon">
                                <MoreVertical />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => handleNavigation('/dashboard/tridni-kniha/zapis', {
                                tridaId: lesson.classId,
                                datum: format(day, 'yyyy-MM-dd'),
                                hodina: period.toString(),
                                predmetId: lesson.subjectId,
                            })}>
                                <Pencil className="mr-2 h-4 w-4"/>
                                Zapsat do třídní knihy
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setIsGradingDialogOpen(true)}>
                                <PencilRuler className="mr-2 h-4 w-4"/>
                                Zadat nové hodnocení
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => setIsSubDialogOpen(true)}>
                                <VenetianMask className="mr-2 h-4 w-4"/>
                                {substitution ? 'Upravit suplování' : 'Zadat suplování'}
                            </DropdownMenuItem>
                            {substitution && (
                                <DropdownMenuItem onSelect={() => setDeletingSubstitution(substitution)} className="text-destructive">
                                    <XCircle className="mr-2 h-4 w-4"/>
                                    Zrušit suplování
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Detail vyučovací hodiny</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4 text-lg">
                        <BookOpen className="h-6 w-6 text-primary" />
                        <span className="font-semibold">{lesson.subjectName} ({lesson.subjectShortcut})</span>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-base">
                        <div className="flex items-start gap-3">
                            <Clock className="h-5 w-5 mt-0.5 text-muted-foreground" />
                            <div>
                                <p className="text-muted-foreground">Čas</p>
                                <p className="font-medium">{timeSlot}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <User className="h-5 w-5 mt-0.5 text-muted-foreground" />
                            <div>
                                <p className="text-muted-foreground">Vyučující</p>
                                <p className="font-medium">{lesson.teacherName || 'N/A'}</p>
                            </div>
                        </div>
                         <div className="flex items-start gap-3">
                            <Home className="h-5 w-5 mt-0.5 text-muted-foreground" />
                            <div>
                                <p className="text-muted-foreground">Třída</p>
                                <p className="font-medium">{classData?.nazev || lesson.className}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Home className="h-5 w-5 mt-0.5 text-muted-foreground" />
                            <div>
                                <p className="text-muted-foreground">Učebna</p>
                                <p className="font-medium">{lesson.ucebnaName || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {(zapis?.topic || zapis?.note) && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Zápis z hodiny</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {zapis.topic && (
                            <div className="flex items-start gap-3">
                                <FileText className="h-5 w-5 mt-0.5 text-muted-foreground" />
                                <div>
                                    <p className="text-muted-foreground">Probírané učivo</p>
                                    <p className="font-medium">{zapis.topic}</p>
                                </div>
                            </div>
                        )}
                         {zapis.note && (
                            <div className="flex items-start gap-3">
                                <FileText className="h-5 w-5 mt-0.5 text-muted-foreground" />
                                <div>
                                    <p className="text-muted-foreground">Poznámka</p>
                                    <p className="font-medium">{zapis.note}</p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <SubstitutionDialog
                isOpen={isSubDialogOpen}
                onOpenChange={setIsSubDialogOpen}
                lessonInfo={{
                    lesson: schedule?.hodiny[parseInt(periodStr, 10)]!,
                    period: period,
                    classId: classId,
                }}
                day={day}
                substitution={substitution || null}
                teachers={allTeachers || []}
                subjects={allSubjects || []}
                onSave={handleSaveSubstitution}
            />
            <AlertDialog open={!!deletingSubstitution} onOpenChange={() => setDeletingSubstitution(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Opravdu chcete zrušit toto suplování?</AlertDialogTitle>
                        <AlertDialogDescription>Tato akce je nevratná.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Zpět</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteSubstitution} className="bg-destructive hover:bg-destructive/90">
                            Zrušit suplování
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {lesson && (
                <GradingDialog
                   isOpen={isGradingDialogOpen}
                   onOpenChange={setIsGradingDialogOpen}
                   lesson={lesson}
                   students={students || []}
                   subjects={allSubjects || []}
                />
            )}
        </div>
    );
}
