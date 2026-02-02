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
import { collection, query, where, getDoc, doc, writeBatch, getDocs } from 'firebase/firestore';
import type {
  Trida,
  User,
  Rozvrh,
  Udalost,
  Substitution,
  ScheduleTemplate,
  ZapisHodiny,
  Predmet,
  LessonBlock,
} from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';

const defaultTimeSlots = [
    "07:55-08:40", "08:55-09:40", "09:55-10:40", "10:45-11:30",
    "11:35-12:20", "12:30-13:15", "13:20-14:05", "14:15-15:00",
    "15:05-15:50", "15:55-16:40"
];

export function MobileDashboard() {
  const firestore = useFirestore();
  const { user, hasRole, isSuperAdmin, loading: isUserLoading } = useAuth();
  
  const isTeacherView = hasRole('ucitel') && !isSuperAdmin();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  const [teacherDailySchedule, setTeacherDailySchedule] = useState<Rozvrh | null>(null);
  const [teacherScheduleLoading, setTeacherScheduleLoading] = useState(false);

  const studentRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    const studentId = hasRole('ziak') ? user.id : user.studentId;
    if (!studentId) return null;
    return doc(firestore, 'users', studentId);
  }, [firestore, user, hasRole]);
  const { data: studentData, isLoading: studentLoading } = useDoc<User>(studentRef);

  // Determine the target class ID based on role
  const targetClassId = useMemo(() => {
    if (isTeacherView) return undefined;
    if (hasRole('ucitel') || hasRole('administrator')) {
      return selectedClassId;
    }
    if (hasRole('ziak')) return user?.tridaId;
    if (hasRole('rodic')) return studentData?.tridaId;
    return undefined;
  }, [hasRole, user, studentData, selectedClassId, isTeacherView]);

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
    if (selectedClassId) return; // Already have a class, do nothing

    if ((hasRole('ucitel') || hasRole('administrator')) && !isTeacherView) {
        if (teacherClasses && teacherClasses.length > 0) {
            setSelectedClassId(teacherClasses[0].id);
        }
    } else if (!isTeacherView) { // Student or Parent
        const classId = hasRole('ziak') ? user?.tridaId : studentData?.tridaId;
        if (classId) {
            setSelectedClassId(classId);
        }
    }
  }, [hasRole, user, studentData, teacherClasses, selectedClassId, isTeacherView]);

  // Fetch and aggregate schedule for teacher view
  useEffect(() => {
    if (!isTeacherView || !firestore || !user?.id) return;

    const fetchAndAggregate = async () => {
        setTeacherScheduleLoading(true);

        const dayStr = format(currentDate, 'yyyy-MM-dd');
        const q = query(collection(firestore, 'rozvrhy'), where('datum', '==', dayStr));
        const querySnapshot = await getDocs(q);
        const schedulesForDay = querySnapshot.docs.map(d => d.data() as Rozvrh);
        
        let resolvedTimeSlots = defaultTimeSlots;
        if (schedulesForDay.length > 0 && schedulesForDay[0].timeSlots.length > 0) {
            resolvedTimeSlots = schedulesForDay[0].timeSlots;
        }

        const teacherDayLessons: (LessonBlock | null)[] = Array(resolvedTimeSlots.length).fill(null);

        for (const schedule of schedulesForDay) {
            schedule.hodiny.forEach((lesson, index) => {
                if (lesson && lesson.teacherId === user.id) {
                    teacherDayLessons[index] = lesson;
                }
            });
        }

        setTeacherDailySchedule({
            id: `teacher-schedule-${dayStr}`,
            tridaId: user.id,
            organizationId: user.organizationId || '',
            datum: dayStr,
            timeSlots: resolvedTimeSlots,
            hodiny: teacherDayLessons,
        });
        setTeacherScheduleLoading(false);
    };

    fetchAndAggregate();
  }, [isTeacherView, firestore, currentDate, user?.id, user?.organizationId]);


  const dailySchedule = useDoc<Rozvrh>(useMemoFirebase(() => {
    if (isTeacherView || !firestore || !targetClassId) return null;
    const scheduleId = `${targetClassId}-${format(currentDate, 'yyyy-MM-dd')}`;
    return doc(firestore, 'rozvrhy', scheduleId);
  }, [firestore, targetClassId, currentDate, isTeacherView]));
  
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
  
  const scheduleToRender = isTeacherView ? teacherDailySchedule : dailySchedule.data;
  const isDataLoading = isUserLoading || studentLoading || teachersLoading || subjectsLoading || eventsLoading || subsLoading || zapisyLoading || (isTeacherView ? teacherScheduleLoading : (dailySchedule.isLoading || (canManage && teacherClassesLoading)));

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
          
          {canManage && !isTeacherView && (
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

          <MobileTimetableList
            dailySchedule={scheduleToRender}
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
