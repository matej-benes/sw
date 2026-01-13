'use client';

import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Rozvrh, User } from '@/lib/types';
import { format, isSameDay, parseISO } from 'date-fns';
import { cs } from 'date-fns/locale';
import { MobileTimetableList } from '@/components/mobile-timetable-list';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { TimetableWidget } from '@/components/timetable-widget';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, subDays } from 'date-fns';

export default function RozvrhPage() {
  const { user, hasRole, loading: userLoading } = useAuth();
  const firestore = useFirestore();
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(new Date());

  const studentRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    const studentId = hasRole('ziak') ? user.id : user.studentId;
    if (!studentId) return null;
    return doc(firestore, 'users', studentId);
  }, [firestore, user, hasRole]);
  const { data: studentData, isLoading: studentLoading } = useDoc<User>(studentRef);

  const targetClassId = useMemo(() => {
    if (hasRole('ucitel')) return null; // Teacher view is handled differently, this page is for students/parents
    if (hasRole('ziak')) return user?.tridaId;
    if (hasRole('rodic')) return studentData?.tridaId;
    return undefined;
  }, [hasRole, user, studentData]);

  const scheduleId = useMemo(() => {
    if (!targetClassId) return null;
    return `${targetClassId}-${format(currentDate, 'yyyy-MM-dd')}`;
  }, [targetClassId, currentDate]);

  const scheduleRef = useMemoFirebase(() => {
    return scheduleId && firestore ? doc(firestore, 'rozvrhy', scheduleId) : null;
  }, [scheduleId, firestore]);
  const { data: scheduleData, isLoading: scheduleLoading } = useDoc<Rozvrh>(scheduleRef);

  const handlePrevDay = () => setCurrentDate(prev => subDays(prev, 1));
  const handleNextDay = () => setCurrentDate(prev => addDays(prev, 1));

  const isLoading = userLoading || studentLoading || scheduleLoading;

  const title = hasRole('rodic') ? 'Rozvrh dítěte' : 'Váš rozvrh';
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
                        {scheduleData.hodiny.map((lesson, index) => (
                             <tr key={index} className="border-t">
                                <td className="p-2 font-medium text-center">{index + 1}.</td>
                                <td className="p-2 text-muted-foreground">{scheduleData.timeSlots[index]}</td>
                                {lesson ? (
                                    <>
                                        <td className="p-2 font-semibold">{lesson.subjectName}</td>
                                        <td className="p-2">{lesson.teacherName}</td>
                                        <td className="p-2">{lesson.ucebnaName || '-'}</td>
                                    </>
                                ) : (
                                    <td colSpan={3} className="p-2 text-center text-muted-foreground italic">Volná hodina</td>
                                )}
                            </tr>
                        ))}
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
