'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { TimetableWidget } from '@/components/timetable-widget';
import {
  startOfWeek,
  addDays,
  format,
  subDays,
  isSameDay,
  isWithinInterval,
  parseISO,
  getDay,
} from 'date-fns';
import { cs } from 'date-fns/locale';

import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, getDoc, doc, writeBatch } from 'firebase/firestore';
import type {
  Trida,
  User,
  Rozvrh,
  Udalost,
  Substitution,
  ScheduleTemplate,
} from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';

export function MobileDashboard() {
  const firestore = useFirestore();
  const { user, hasRole, loading: isUserLoading } = useAuth();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>(undefined);

  // Fetch classes for teacher selector if the user is a teacher
  const teacherClassesQuery = useMemoFirebase(() => {
    if (!firestore || !user || !hasRole('ucitel')) return null;
    return query(
      collection(firestore, 'tridy'),
      where('ucitelId', '==', user.id)
    );
  }, [firestore, user, hasRole]);
  const { data: teacherClasses, isLoading: teacherClassesLoading } = useCollection<Trida>(teacherClassesQuery);
  
  // Determine the target class ID based on role
  const targetClassId = useMemo(() => {
    if (hasRole('ucitel')) {
      return selectedClassId;
    }
    return user?.tridaId;
  }, [hasRole, user?.tridaId, selectedClassId]);

  // Set default class for teachers
  useEffect(() => {
    if (hasRole('ucitel') && teacherClasses && teacherClasses.length > 0 && !selectedClassId) {
      setSelectedClassId(teacherClasses[0].id);
    }
  }, [hasRole, teacherClasses, selectedClassId]);

  // Set class for non-teachers
  useEffect(() => {
    if (!hasRole('ucitel') && user?.tridaId) {
      setSelectedClassId(user.tridaId);
    }
  }, [hasRole, user?.tridaId]);

  const schedulesQuery = useMemoFirebase(() => {
    if (!firestore || !targetClassId) return null;
    return query(collection(firestore, 'rozvrhy'), where('tridaId', '==', targetClassId));
  }, [firestore, targetClassId]);

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || !targetClassId) return null;
    return query(collection(firestore, 'udalosti'), where('tridyIds', 'array-contains', targetClassId));
  }, [firestore, targetClassId]);
  
  const substitutionsQuery = useMemoFirebase(() => {
    if (!firestore || !targetClassId) return null;
     return query(collection(firestore, 'suplovani'), where('originalLesson.classId', '==', targetClassId));
  }, [firestore, targetClassId]);

  const { data: schedulesData } = useCollection<Rozvrh>(schedulesQuery);
  const { data: eventsData } = useCollection<Udalost>(eventsQuery);
  const { data: substitutionsData } = useCollection<Substitution>(substitutionsQuery);

  useEffect(() => {
    const generateSchedulesForWeek = async () => {
        if (!firestore || !targetClassId || !schedulesData) return;

        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = addDays(weekStart, 6);

        const weekSchedulesExist = schedulesData.some(s => 
            s.tridaId === targetClassId &&
            isWithinInterval(parseISO(s.datum), { start: weekStart, end: weekEnd })
        );

        if (weekSchedulesExist) {
            return;
        }

        const templateRef = doc(firestore, 'scheduleTemplates', targetClassId);
        const templateSnap = await getDoc(templateRef);

        if (!templateSnap.exists()) return;

        const template = templateSnap.data() as ScheduleTemplate;
        const batch = writeBatch(firestore);

        for (let i = 0; i < 7; i++) {
            const dayDate = addDays(weekStart, i);
            const dayDateString = format(dayDate, 'yyyy-MM-dd');
            const templateDay = template.days.find(d => d.dayIndex === i);
            const dayLessons = templateDay ? templateDay.lessons : [];

            const rozvrhId = `${targetClassId}-${dayDateString}`;
            const rozvrhRef = doc(firestore, 'rozvrhy', rozvrhId);

            const newRozvrh: Omit<Rozvrh, 'id'> = {
                tridaId: targetClassId,
                datum: dayDateString,
                timeSlots: template.timeSlots,
                hodiny: dayLessons,
            };
            batch.set(rozvrhRef, newRozvrh);
        }
        await batch.commit();
    };

    if(targetClassId){
      generateSchedulesForWeek();
    }
  }, [firestore, targetClassId, currentDate, schedulesData]);

  const handlePrevDay = () => setCurrentDate(prev => subDays(prev, 1));
  const handleNextDay = () => setCurrentDate(prev => addDays(prev, 1));
  const handleSetToday = () => setCurrentDate(new Date());

  const isDataLoading = !schedulesData || !eventsData || !substitutionsData || isUserLoading || (hasRole('ucitel') && teacherClassesLoading);

  if (isDataLoading) {
    return <div className="flex h-full w-full items-center justify-center">Načítání...</div>;
  }
   if (!user) {
     return <div className="flex h-full w-full items-center justify-center">Uživatel nenalezen.</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Rozvrh</CardTitle>
          <CardDescription>Váš denní přehled.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-2 mb-4">
            <Button variant="outline" size="icon" onClick={handlePrevDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="flex-grow" onClick={handleSetToday}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(currentDate, 'EEEE, d. MMMM', { locale: cs })}
            </Button>
            <Button variant="outline" size="icon" onClick={handleNextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {hasRole('ucitel') && (
            <div className="mb-4">
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte třídu" />
                </SelectTrigger>
                <SelectContent>
                  {teacherClasses?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nazev}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <TimetableWidget
            schedules={schedulesData || []}
            eventsData={eventsData || []}
            substitutionsData={substitutionsData || []}
            isTeacher={hasRole('ucitel')}
            userId={user.id}
            userClassId={targetClassId}
            days={[currentDate]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
