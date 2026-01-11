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
import { useUnreadMessages } from '@/hooks/use-unread-messages';

export function MobileDashboard() {
  const firestore = useFirestore();
  const { user, hasRole, loading: isUserLoading } = useAuth();
  
  const [currentDate, setCurrentDate] = useState(new Date());

  const schedulesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.tridaId) return null;
    return query(collection(firestore, 'rozvrhy'), where('tridaId', '==', user.tridaId));
  }, [firestore, user?.tridaId]);

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.tridaId) return null;
    return query(collection(firestore, 'udalosti'), where('tridyIds', 'array-contains', user.tridaId));
  }, [firestore, user?.tridaId]);
  
  const substitutionsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.tridaId) return null;
     return query(collection(firestore, 'suplovani'), where('originalLesson.classId', '==', user.tridaId));
  }, [firestore, user?.tridaId]);

  const { data: schedulesData } = useCollection<Rozvrh>(schedulesQuery);
  const { data: eventsData } = useCollection<Udalost>(eventsQuery);
  const { data: substitutionsData } = useCollection<Substitution>(substitutionsQuery);

  useEffect(() => {
    const generateSchedulesForWeek = async () => {
        if (!firestore || !user?.tridaId || !schedulesData) return;

        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = addDays(weekStart, 6);

        const weekSchedulesExist = schedulesData.some(s => 
            s.tridaId === user.tridaId &&
            isWithinInterval(parseISO(s.datum), { start: weekStart, end: weekEnd })
        );

        if (weekSchedulesExist) {
            return;
        }

        const templateRef = doc(firestore, 'scheduleTemplates', user.tridaId);
        const templateSnap = await getDoc(templateRef);

        if (!templateSnap.exists()) return;

        const template = templateSnap.data() as ScheduleTemplate;
        const batch = writeBatch(firestore);

        for (let i = 0; i < 7; i++) {
            const dayDate = addDays(weekStart, i);
            const dayDateString = format(dayDate, 'yyyy-MM-dd');
            const templateDay = template.days.find(d => d.dayIndex === i);
            const dayLessons = templateDay ? templateDay.lessons : [];

            const rozvrhId = `${user.tridaId}-${dayDateString}`;
            const rozvrhRef = doc(firestore, 'rozvrhy', rozvrhId);

            const newRozvrh: Omit<Rozvrh, 'id'> = {
                tridaId: user.tridaId,
                datum: dayDateString,
                timeSlots: template.timeSlots,
                hodiny: dayLessons,
            };
            batch.set(rozvrhRef, newRozvrh);
        }
        await batch.commit();
    };

    if(user?.tridaId){
      generateSchedulesForWeek();
    }
  }, [firestore, user?.tridaId, currentDate, schedulesData]);

  const handlePrevDay = () => setCurrentDate(prev => subDays(prev, 1));
  const handleNextDay = () => setCurrentDate(prev => addDays(prev, 1));
  const handleSetToday = () => setCurrentDate(new Date());

  const isDataLoading = !schedulesData || !eventsData || !substitutionsData || isUserLoading;

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

          <TimetableWidget
            schedules={schedulesData || []}
            eventsData={eventsData || []}
            substitutionsData={substitutionsData || []}
            isTeacher={hasRole('ucitel')}
            userId={user.id}
            userClassId={user.tridaId}
            days={[currentDate]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
