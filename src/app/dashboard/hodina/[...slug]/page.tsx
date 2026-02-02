'use client';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, User, Home, Clock, FileText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, query, where, collection } from 'firebase/firestore';
import type { Rozvrh, LessonBlock, User as AppUser, Trida, ZapisHodiny, Substitution, Predmet } from '@/lib/types';
import { isSameDay, parseISO } from 'date-fns';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { useAuth } from '@/hooks/use-auth';
import { useMemo } from 'react';

export default function LessonDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { user } = useAuth();
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
    
    const isLoading = scheduleLoading || zapisLoading || substitutionLoading || teachersLoading || subjectsLoading;

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

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex items-center gap-4">
                 <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                     <h1 className="text-3xl font-bold">{lesson.subjectName}</h1>
                     <p className="text-muted-foreground">{format(parseISO(dateStr), "EEEE, d. MMMM yyyy", { locale: cs })}</p>
                </div>
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
        </div>
    );
}
