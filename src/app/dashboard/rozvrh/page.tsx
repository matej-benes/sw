
'use client';

import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import type { Rozvrh, User, Substitution, Predmet, User as AppUser, LessonBlock } from '@/lib/types';
import { format, isSameDay, parseISO } from 'date-fns';
import { cs } from 'date-fns/locale';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, XCircle } from 'lucide-react';
import { addDays, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default function RozvrhPage() {
  const { user, hasRole, loading: userLoading, activeStudentId } = useAuth();
  const firestore = useFirestore();
  const [currentDate, setCurrentDate] = useState(new Date());

  const targetStudentId = hasRole('rodic') ? activeStudentId : (hasRole('ziak') ? user?.id : null);

  const studentRef = useMemoFirebase(() => {
    if (!firestore || !targetStudentId) return null;
    return doc(firestore, 'users', targetStudentId);
  }, [firestore, targetStudentId]);
  const { data: studentData, isLoading: studentLoading } = useDoc<User>(studentRef);

  const targetClassId = useMemo(() => {
    if (hasRole('ucitel')) return null;
    return studentData?.tridaId;
  }, [hasRole, studentData]);

  const scheduleId = useMemo(() => {
    if (!targetClassId) return null;
    return `${targetClassId}-${format(currentDate, 'yyyy-MM-dd')}`;
  }, [targetClassId, currentDate]);

  const scheduleRef = useMemoFirebase(() => {
    return scheduleId && firestore ? doc(firestore, 'rozvrhy', scheduleId) : null;
  }, [scheduleId, firestore]);
  const { data: scheduleData, isLoading: scheduleLoading } = useDoc<Rozvrh>(scheduleRef);

  const substitutionsQuery = useMemoFirebase(() => {
    if (!firestore || !targetClassId) return null;
    return query(collection(firestore, 'suplovani'), where('originalLesson.classId', '==', targetClassId));
  }, [firestore, targetClassId]);
  const { data: substitutionsData } = useCollection<Substitution>(substitutionsQuery);

  const staffQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('roles', 'array-contains-any', ['ucitel', 'administrator']));
  }, [firestore]);
  const { data: allStaff } = useCollection<AppUser>(staffQuery);

  const subjectsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'predmety');
  }, [firestore]);
  const { data: allSubjects } = useCollection<Predmet>(subjectsQuery);

  const handlePrevDay = () => setCurrentDate(prev => subDays(prev, 1));
  const handleNextDay = () => setCurrentDate(prev => addDays(prev, 1));

  const isLoading = userLoading || studentLoading || scheduleLoading || !substitutionsData || !allStaff || !allSubjects;

  const title = hasRole('rodic') ? `Rozvrh (${studentData?.name || '...'})` : 'Váš rozvrh';
  const description = 'Přehled vyučovacích hodin.';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
                <CardTitle>{format(currentDate, 'EEEE', { locale: cs })}</CardTitle>
                <CardDescription>{format(currentDate, 'd. MMMM yyyy', { locale: cs })}</CardDescription>
            </div>
            <Button variant="outline" size="icon" onClick={handleNextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-10">Načítání rozvrhu...</div>
          ) : scheduleData ? (
             <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-muted/50">
                            <th className="p-2 text-left font-semibold w-24">Hodina</th>
                            <th className="p-2 text-left font-semibold w-24">Čas</th>
                            <th className="p-2 text-left font-semibold">Předmět</th>
                            <th className="p-2 text-left font-semibold">Učitel</th>
                            <th className="p-2 text-left font-semibold">Učebna</th>
                        </tr>
                    </thead>
                    <tbody>
                        {scheduleData.hodiny.map((originalLesson, index) => {
                            const sub = substitutionsData.find(s => 
                                s.date === scheduleData.datum && 
                                s.originalLesson.period === index && 
                                s.originalLesson.classId === targetClassId
                            );

                            const isCancelled = sub && (Array.isArray(sub.changes.type) ? sub.changes.type.includes('zruseno') : sub.changes.type === 'zruseno');
                            
                            let displayLesson: LessonBlock | null = originalLesson;
                            let isSubstituted = false;

                            if (sub && !isCancelled) {
                                isSubstituted = true;
                                if (originalLesson) {
                                    displayLesson = { ...originalLesson };
                                    if (sub.changes.teacherIds && sub.changes.teacherIds.length > 0) {
                                        displayLesson.teacherName = sub.changes.teacherIds
                                            .map(id => allStaff.find(s => s.id === id)?.name)
                                            .filter(Boolean)
                                            .join(', ');
                                    }
                                    if (sub.changes.subjectId) {
                                        const newSubj = allSubjects.find(s => s.id === sub.changes.subjectId);
                                        if (newSubj) {
                                            displayLesson.subjectName = newSubj.name;
                                            displayLesson.subjectShortcut = newSubj.shortcut;
                                        }
                                    }
                                }
                            }

                            return (
                                <tr key={index} className={cn("border-t", isSubstituted && "bg-destructive/10")}>
                                    <td className="p-2 font-medium text-center">{index + 1}.</td>
                                    <td className="p-2 text-muted-foreground">{scheduleData.timeSlots[index]}</td>
                                    {isCancelled ? (
                                        <td colSpan={3} className="p-2 text-center text-destructive font-bold">
                                            <div className="flex items-center justify-center gap-2">
                                                <XCircle className="h-4 w-4" /> Odpadá ({originalLesson?.subjectShortcut})
                                            </div>
                                        </td>
                                    ) : displayLesson ? (
                                        <>
                                            <td className="p-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold">{displayLesson.subjectName}</span>
                                                    {isSubstituted && <Badge variant="destructive" className="text-[10px] h-4">SUPL</Badge>}
                                                </div>
                                            </td>
                                            <td className="p-2">{displayLesson.teacherName}</td>
                                            <td className="p-2">{displayLesson.ucebnaName || '-'}</td>
                                        </>
                                    ) : (
                                        <td colSpan={3} className="p-2 text-center text-muted-foreground italic">Volná hodina</td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              Pro tento den nebyl nalezen žádný rozvrh.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
