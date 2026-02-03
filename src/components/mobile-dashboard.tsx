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
  
  const isTeacher = hasRole('ucitel');
  const isAdmin = hasRole('administrator') || isSuperAdmin();
  
  const [viewMode, setViewMode] = useState(isTeacher ? 'muj-rozvrh' : 'tridy');
  const isPersonalView = viewMode === 'muj-rozvrh';

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>(undefined);

  const [teacherDailySchedule, setTeacherDailySchedule] = useState<Rozvrh | null>(null);
  const [teacherScheduleLoading, setTeacherScheduleLoading] = useState(false);

  const studentRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    const studentId = hasRole('ziak') ? user.id : user.studentId;
    if (!studentId) return null;
    return doc(firestore, 'users', studentId);
  }, [firestore, user, hasRole]);
  const { data: studentData, isLoading: studentLoading } = useDoc<User>(studentRef);

  const targetClassId = useMemo(() => {
    if (isPersonalView) return undefined;
    if (isAdmin) {
      return selectedClassId;
    }
    if (hasRole('ziak')) return user?.tridaId;
    if (hasRole('rodic')) return studentData?.tridaId;
    return undefined;
  }, [isAdmin, user, studentData, selectedClassId, isPersonalView, hasRole]);

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
    
  useEffect(() => {
    if (selectedClassId) return;

    if (isAdmin && !isPersonalView) {
        if (teacherClasses && teacherClasses.length > 0) {
            setSelectedClassId(teacherClasses[0].id);
        }
    } else if (!isPersonalView) { 
        const classId = hasRole('ziak') ? user?.tridaId : studentData?.tridaId;
        if (classId) {
            setSelectedClassId(classId);
        }
    }
  }, [isAdmin, user, studentData, teacherClasses, selectedClassId, isPersonalView, hasRole]);

  const substitutionsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.organizationId) return null;
    if (isPersonalView) {
        return query(collection(firestore, 'suplovani'), where('organizationId', '==', user.organizationId));
    }
    if (!targetClassId) return null;
    return query(collection(firestore, 'suplovani'), where('originalLesson.classId', '==', targetClassId));
  }, [firestore, targetClassId, isPersonalView, user?.organizationId]);

  const { data: substitutionsData } = useCollection<Substitution>(substitutionsQuery);

  const { data: subjects } = useCollection<Predmet>(useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'predmety');
  }, [firestore]));

  const { data: allStaff } = useCollection<User>(useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "users"), where("roles", "array-contains-any", ["ucitel", "asistent pedagoga", "vedouci pracovnik", "administrator"]));
  }, [firestore]));

  useEffect(() => {
    if (!isPersonalView || !firestore || !user?.id || !substitutionsData) return;

    const fetchAndAggregate = async () => {
        setTeacherScheduleLoading(true);

        const dayStr = format(currentDate, 'yyyy-MM-dd');
        // Fetch all schedules for the date. We'll filter by teacher in memory.
        const q = query(
            collection(firestore, 'rozvrhy'), 
            where('datum', '==', dayStr)
        );
        const querySnapshot = await getDocs(q);
        const schedulesForDay = querySnapshot.docs.map(d => d.data() as Rozvrh);
        
        let resolvedTimeSlots = defaultTimeSlots;
        if (schedulesForDay.length > 0 && schedulesForDay[0].timeSlots.length > 0) {
            resolvedTimeSlots = schedulesForDay[0].timeSlots;
        }

        const teacherDayLessons: (LessonBlock | null)[] = Array(resolvedTimeSlots.length).fill(null);
        const subsToday = substitutionsData.filter(s => s.date === dayStr);

        for (const schedule of schedulesForDay) {
            schedule.hodiny.forEach((lesson, index) => {
                if (!lesson) return;

                const sub = subsToday.find(s => 
                    s.originalLesson.classId === schedule.tridaId && 
                    s.originalLesson.period === index
                );

                let shouldInclude = false;
                let finalLesson = { ...lesson };

                if (sub) {
                    const isAssignedToMe = sub.changes.teacherIds?.includes(user.id);
                    const isCancelled = Array.isArray(sub.changes.type) 
                        ? sub.changes.type.includes('zruseno') 
                        : sub.changes.type === 'zruseno';
                    
                    if (isAssignedToMe && !isCancelled) {
                        shouldInclude = true;
                        finalLesson = {
                            ...lesson,
                            teacherId: user.id,
                            teacherName: user.name,
                            isSubstitution: true,
                        };
                        if (sub.changes.subjectId && subjects) {
                            const newSubj = subjects.find(s => s.id === sub.changes.subjectId);
                            if (newSubj) {
                                finalLesson.subjectId = newSubj.id;
                                finalLesson.subjectName = newSubj.name;
                                finalLesson.subjectShortcut = newSubj.shortcut;
                            }
                        }
                    } else if (lesson.teacherId === user.id && !isCancelled) {
                        const isReplaced = sub.changes.teacherIds && sub.changes.teacherIds.length > 0 && !sub.changes.teacherIds.includes(user.id);
                        if (!isReplaced) {
                            shouldInclude = true;
                        }
                    }
                } else if (lesson.teacherId === user.id) {
                    shouldInclude = true;
                }

                if (shouldInclude) {
                    teacherDayLessons[index] = finalLesson;
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
  }, [isPersonalView, firestore, currentDate, user?.id, user?.organizationId, substitutionsData, subjects]);


  const dailySchedule = useDoc<Rozvrh>(useMemoFirebase(() => {
    if (isPersonalView || !firestore || !targetClassId) return null;
    const scheduleId = `${targetClassId}-${format(currentDate, 'yyyy-MM-dd')}`;
    return doc(firestore, 'rozvrhy', scheduleId);
  }, [firestore, targetClassId, currentDate, isPersonalView]));
  
  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || !targetClassId) return null;
    return query(collection(firestore, 'udalosti'), where('tridyIds', 'array-contains', targetClassId));
  }, [firestore, targetClassId]);
  
  const zapisyQuery = useMemoFirebase(() => {
    if (!firestore || !targetClassId) return null;
    return query(collection(firestore, 'zapisyHodin'), where('tridaId', '==', targetClassId));
  }, [firestore, targetClassId]);

  const { data: eventsData, isLoading: eventsLoading } = useCollection<Udalost>(eventsQuery);
  const { data: zapisyData, isLoading: zapisyLoading } = useCollection<ZapisHodiny>(zapisyQuery);
  
  const handlePrevDay = () => setCurrentDate(prev => subDays(prev, 1));
  const handleNextDay = () => setCurrentDate(prev => addDays(prev, 1));
  const handleSetToday = () => setCurrentDate(new Date());

  const scheduleToRender = isPersonalView ? teacherDailySchedule : dailySchedule.data;
  const isDataLoading = isUserLoading || studentLoading || (subjects === null) || eventsLoading || zapisyLoading || (isPersonalView ? teacherScheduleLoading : (dailySchedule.isLoading || (isAdmin && teacherClassesLoading)));

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
          
          {isAdmin && (
            <div className="mb-4">
              <Select value={viewMode} onValueChange={setViewMode}>
                <SelectTrigger>
                  <SelectValue placeholder="Zobrazit..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tridy">Třídy</SelectItem>
                  {isTeacher && <SelectItem value="muj-rozvrh">Můj rozvrh</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          )}

          {viewMode === 'tridy' && isAdmin && (
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
            dailySchedule={scheduleToRender}
            eventsData={eventsData || []}
            substitutionsData={substitutionsData || []}
            zapisyData={zapisyData || []}
            isTeacher={isAdmin || isTeacher}
            userId={user.id}
            userClassId={targetClassId}
            day={currentDate}
            teachers={allStaff || []}
            subjects={subjects || []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
