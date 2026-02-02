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
import { MobileTimetableList } from '@/components/mobile-timetable-list';
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
  ZapisHodiny,
  Predmet,
} from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';

export function MobileDashboard() {
  const firestore = useFirestore();
  const { user, hasRole, loading: isUserLoading } = useAuth();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>(undefined);

  const studentRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    const studentId = hasRole('ziak') ? user.id : user.studentId;
    if (!studentId) return null;
    return doc(firestore, 'users', studentId);
  }, [firestore, user, hasRole]);
  const { data: studentData, isLoading: studentLoading } = useDoc<User>(studentRef);

  // Determine the target class ID based on role
  const targetClassId = useMemo(() => {
    if (hasRole('ucitel') || hasRole('administrator')) {
      return selectedClassId;
    }
    if (hasRole('ziak')) return user?.tridaId;
    if (hasRole('rodic')) return studentData?.tridaId;
    return undefined;
  }, [hasRole, user, studentData, selectedClassId]);

  const teacherClassesQuery = useMemoFirebase(() => {
    if (!firestore || !user ) return null;
     if (hasRole('administrator')) {
      return collection(firestore, 'tridy');
    }
    if (hasRole('ucitel')) {
        return query(collection(firestore, 'tridy'), where('ucitelId', '==', user.id));
    }
    return null;
  }, [firestore, user, hasRole]);
  const { data: teacherClasses, isLoading: teacherClassesLoading } = useCollection<Trida>(teacherClassesQuery);
    
  // Set default class for teachers/admins or the user's class
  useEffect(() => {
    if (hasRole('ucitel') || hasRole('administrator')) {
      if (teacherClasses && teacherClasses.length > 0 && !selectedClassId) {
        setSelectedClassId(teacherClasses[0].id);
      }
    } else { 
      const classId = hasRole('ziak') ? user?.tridaId : studentData?.tridaId;
      if (classId) {
        setSelectedClassId(classId);
      }
    }
  }, [hasRole, user, studentData, teacherClasses, selectedClassId]);


  const dailySchedule = useDoc<Rozvrh>(useMemoFirebase(() => {
    if (!firestore || !targetClassId) return null;
    const scheduleId = `${targetClassId}-${format(currentDate, 'yyyy-MM-dd')}`;
    return doc(firestore, 'rozvrhy', scheduleId);
  }, [firestore, targetClassId, currentDate]));
  
  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || !targetClassId) return null;
    return query(collection(firestore, 'udalosti'), where('tridyIds', 'array-contains', targetClassId));
  }, [firestore, targetClassId]);
  
  const substitutionsQuery = useMemoFirebase(() => {
    if (!firestore || !targetClassId) return null;
     return query(collection(firestore, 'suplovani'), where('originalLesson.classId', '==', targetClassId));
  }, [firestore, targetClassId]);
  
  const zapisyQuery = useMemoFirebase(() => {
    if (!firestore || !targetClassId) return null;
    return query(collection(firestore, 'zapisyHodin'), where('tridaId', '==', targetClassId));
  }, [firestore, targetClassId]);

  const { data: eventsData, isLoading: eventsLoading } = useCollection<Udalost>(eventsQuery);
  const { data: substitutionsData, isLoading: subsLoading } = useCollection<Substitution>(substitutionsQuery);
  const { data: zapisyData, isLoading: zapisyLoading } = useCollection<ZapisHodiny>(zapisyQuery);
  
  const { data: teachers, isLoading: teachersLoading } = useCollection<User>(useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "users"), where("roles", "array-contains", "ucitel"));
  }, [firestore]));

  const { data: subjects, isLoading: subjectsLoading } = useCollection<Predmet>(useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'predmety');
  }, [firestore]));

  const handlePrevDay = () => setCurrentDate(prev => subDays(prev, 1));
  const handleNextDay = () => setCurrentDate(prev => addDays(prev, 1));
  const handleSetToday = () => setCurrentDate(new Date());

  const canManage = hasRole('ucitel') || hasRole('administrator');
  const isDataLoading = dailySchedule.isLoading || eventsLoading || subsLoading || zapisyLoading || isUserLoading || studentLoading || (canManage && teacherClassesLoading) || teachersLoading || subjectsLoading;

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
          
          {canManage && (
            <div className="mb-4">
              <Select value={selectedClassId || ''} onValueChange={setSelectedClassId}>
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

          <MobileTimetableList
            dailySchedule={dailySchedule.data}
            eventsData={eventsData || []}
            substitutionsData={substitutionsData || []}
            zapisyData={zapisyData || []}
            isTeacher={canManage}
            userId={user.id}
            userClassId={targetClassId}
            day={currentDate}
            teachers={teachers || []}
            subjects={subjects || []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
